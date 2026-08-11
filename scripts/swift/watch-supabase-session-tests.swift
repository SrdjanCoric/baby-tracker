import Foundation

final class InMemoryWatchSessionStore: WatchSessionStore, @unchecked Sendable {
    var bytes: Data?
    var writeCount = 0
    var deleteCount = 0
    var failWrites = false

    func readRaw() throws -> Data? { bytes }

    func writeRaw(_ data: Data) throws {
        if failWrites { throw WatchSessionError.storeFailure }
        bytes = data
        writeCount += 1
    }

    func deleteRaw() throws {
        bytes = nil
        deleteCount += 1
    }
}

actor RecordedWatchHTTPClient: WatchSupabaseHTTPClient {
    private let statuses: [Int]
    private let bodies: [Data]
    private var bearers: [String?] = []

    init(statuses: [Int], bodies: [Data] = []) {
        self.statuses = statuses
        self.bodies = bodies
    }

    func send(_ request: URLRequest) async throws -> (Int, Data) {
        bearers.append(request.value(forHTTPHeaderField: "Authorization"))
        let index = bearers.count - 1
        return (
            statuses[min(index, statuses.count - 1)],
            bodies.indices.contains(index) ? bodies[index] : Data()
        )
    }

    func recordedBearers() -> [String?] { bearers }
}

final class RecordingWatchSessionLogger: WatchSessionLogger, @unchecked Sendable {
    private(set) var events: [WatchSessionLogEvent] = []
    func log(_ event: WatchSessionLogEvent) { events.append(event) }
}

func requireWatchSession(
    _ condition: @autoclosure () throws -> Bool,
    _ message: String,
    file: StaticString = #file,
    line: UInt = #line
) {
    do {
        if try !condition() { fatalError(message, file: file, line: line) }
    } catch {
        fatalError("\(message): threw \(error)", file: file, line: line)
    }
}

@main
enum WatchSupabaseSessionTests {
    static func main() async throws {
        try testVersionedCapsuleInstallsInWatchLocalStore()
        try testStalePhoneCapsuleCannotReplaceNewerWatchCapsule()
        try testEqualRevisionReplayIsIdempotent()
        try testNewerPhoneCapsuleReplacesStoredCapsule()
        try testNewAccountLineageCanRestartRevisionCounter()
        try await testUnauthorizedRequestDoesNotRedeemSharedPhoneSession()
        try await testConcurrentUnauthorizedRequestsDoNotRotateSharedSession()
        try await testMissingSessionReturnsUnauthorizedWithoutNetworkRequest()
        try await testUnauthorizedRequestCannotLoseSessionToPersistenceFailure()
        try await testUnknownPhoneLineageAcceptsTokenWithoutSessionId()
        try testSpecificLineageStillRejectsTokenWithoutSessionId()
        print("PASS: Watch Supabase session safety core")
    }

    static func testStalePhoneCapsuleCannotReplaceNewerWatchCapsule() throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 8,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 2),
            refreshToken: "refresh-2"
        ))

        try vault.install(capsuleJson: Self.capsule(
            revision: 7,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))

        let installed = try vault.read()
        requireWatchSession(installed?.revision == 8, "Watch replayed an older phone capsule")
        requireWatchSession(
            installed?.session.contains("refresh-2") == true,
            "Watch replaced the current pair with a spent refresh token"
        )
        requireWatchSession(store.writeCount == 1, "Watch rewrote Keychain for a stale capsule")
    }

    static func testEqualRevisionReplayIsIdempotent() throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 8,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 2),
            refreshToken: "refresh-2"
        ))

        try vault.install(capsuleJson: Self.capsule(
            revision: 8,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 3),
            refreshToken: "conflicting-refresh"
        ))

        let installed = try vault.read()
        requireWatchSession(installed?.session.contains("refresh-2") == true, "Watch rewrote an equal revision")
        requireWatchSession(store.writeCount == 1, "Watch persisted an equal-revision replay")
    }

    static func testNewerPhoneCapsuleReplacesStoredCapsule() throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 7,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))

        try vault.install(capsuleJson: Self.capsule(
            revision: 8,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 2),
            refreshToken: "refresh-2"
        ))

        let installed = try vault.read()
        requireWatchSession(installed?.revision == 8, "Watch ignored a newer phone capsule")
        requireWatchSession(installed?.session.contains("refresh-2") == true, "Watch kept the older pair")
        requireWatchSession(store.writeCount == 2, "Watch did not persist the newer capsule")
    }

    static func testNewAccountLineageCanRestartRevisionCounter() throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 8,
            lineage: "lineage-a",
            accessToken: Self.jwt(lineage: "lineage-a", marker: 2),
            refreshToken: "refresh-a"
        ))

        try vault.install(capsuleJson: Self.capsule(
            revision: 1,
            lineage: "lineage-b",
            accessToken: Self.jwt(lineage: "lineage-b", marker: 1),
            refreshToken: "refresh-b"
        ))

        let installed = try vault.read()
        requireWatchSession(installed?.revision == 1, "Watch rejected a new account's revision counter")
        requireWatchSession(installed?.lineage == "lineage-b", "Watch kept the previous account lineage")
        requireWatchSession(store.writeCount == 2, "Watch did not persist the new account capsule")
    }

    static func testVersionedCapsuleInstallsInWatchLocalStore() throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        let capsule = Self.capsule(
            revision: 7,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        )

        try vault.install(capsuleJson: capsule)

        let installed = try vault.read()
        requireWatchSession(installed?.revision == 7, "Watch changed the phone capsule revision")
        requireWatchSession(installed?.lineage == "lineage-a", "Watch changed the phone capsule lineage")
        requireWatchSession(installed?.session.contains("refresh-1") == true, "Watch lost the renewable pair")
        requireWatchSession(store.writeCount == 1, "Watch did not atomically install the capsule once")

        try vault.remove()
        requireWatchSession(try vault.read() == nil, "Watch sign-out left the capsule behind")
        requireWatchSession(store.deleteCount == 1, "Watch did not delete its local capsule")
    }

    static func testUnauthorizedRequestDoesNotRedeemSharedPhoneSession() async throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 7,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))
        store.writeCount = 0
        let http = RecordedWatchHTTPClient(statuses: [401])
        let logger = RecordingWatchSessionLogger()
        let transport = WatchSupabaseTransport(
            vault: vault,
            httpClient: http,
            logger: logger
        )

        let (status, _) = try await transport.send(
            config: WatchSupabaseEndpointConfig(
                supabaseUrl: "https://example.supabase.co",
                anonKey: "anon"
            )
        ) { token in
            var request = URLRequest(url: URL(string: "https://example.supabase.co/rest/v1/items")!)
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            return request
        }

        requireWatchSession(status == 401, "Watch hid the phone-session expiry")
        let bearers = await http.recordedBearers()
        requireWatchSession(bearers.count == 1, "Watch retried with the shared phone session")
        requireWatchSession(store.writeCount == 0, "Watch changed the shared phone credential pair")
        let stored = try vault.read()
        requireWatchSession(stored?.revision == 7, "Watch advanced the phone capsule revision")
        requireWatchSession(stored?.session.contains("refresh-1") == true, "Watch replaced the phone refresh token")
        requireWatchSession(logger.events.isEmpty, "Shared-session expiry emitted a renewal log")
    }

    static func testConcurrentUnauthorizedRequestsDoNotRotateSharedSession() async throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 7,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))
        store.writeCount = 0
        let http = RecordedWatchHTTPClient(statuses: [401, 401])
        let transport = WatchSupabaseTransport(
            vault: vault,
            httpClient: http,
            logger: RecordingWatchSessionLogger()
        )

        async let first = transport.send(config: Self.config, buildRequest: Self.bearerRequest)
        async let second = transport.send(config: Self.config, buildRequest: Self.bearerRequest)
        let (firstResult, secondResult) = try await (first, second)

        requireWatchSession(firstResult.0 == 401, "First concurrent request hid unauthorized")
        requireWatchSession(secondResult.0 == 401, "Second concurrent request hid unauthorized")
        let bearers = await http.recordedBearers()
        requireWatchSession(bearers.count == 2, "Concurrent requests sent an unexpected retry")
        requireWatchSession(store.writeCount == 0, "Concurrent 401s rotated the shared phone session")
        let stored = try vault.read()
        requireWatchSession(stored?.revision == 7, "Concurrent 401s advanced the capsule revision")
        requireWatchSession(stored?.session.contains("refresh-1") == true, "Concurrent 401s replaced the refresh token")
    }

    static func testMissingSessionReturnsUnauthorizedWithoutNetworkRequest() async throws {
        let http = RecordedWatchHTTPClient(statuses: [200])
        let logger = RecordingWatchSessionLogger()
        let transport = WatchSupabaseTransport(
            vault: WatchSessionVault(store: InMemoryWatchSessionStore()),
            httpClient: http,
            logger: logger
        )

        let (status, body) = try await transport.send(
            config: Self.config,
            buildRequest: Self.bearerRequest
        )

        requireWatchSession(status == 401, "Missing session did not surface as unauthorized")
        requireWatchSession(body.isEmpty, "Missing session returned a synthetic response body")
        let bearers = await http.recordedBearers()
        requireWatchSession(bearers.isEmpty, "Missing session reached the network")
        requireWatchSession(
            logger.events == [WatchSessionLogEvent(kind: .missingSession)],
            "Missing session was not logged exactly once"
        )
    }

    static func testUnauthorizedRequestCannotLoseSessionToPersistenceFailure() async throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 7,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))
        store.failWrites = true
        store.writeCount = 0
        let transport = WatchSupabaseTransport(
            vault: vault,
            httpClient: RecordedWatchHTTPClient(statuses: [401]),
            logger: RecordingWatchSessionLogger()
        )

        let (status, _) = try await transport.send(
            config: Self.config,
            buildRequest: Self.bearerRequest
        )

        requireWatchSession(status == 401, "Keychain state changed the unauthorized result")
        requireWatchSession(store.writeCount == 0, "Watch tried to persist a replacement after 401")
        let stored = try vault.read()
        requireWatchSession(stored?.revision == 7, "Watch lost the original capsule after 401")
        requireWatchSession(stored?.session.contains("refresh-1") == true, "Watch discarded the original pair")
    }

    static func testUnknownPhoneLineageAcceptsTokenWithoutSessionId() async throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        let accessToken = Self.jwtWithoutSessionId(marker: 1)
        try vault.install(capsuleJson: Self.capsule(
            revision: 1,
            lineage: "unknown",
            accessToken: accessToken,
            refreshToken: "refresh-1"
        ))
        let http = RecordedWatchHTTPClient(statuses: [200])
        let transport = WatchSupabaseTransport(
            vault: vault,
            httpClient: http,
            logger: RecordingWatchSessionLogger()
        )

        let (status, _) = try await transport.send(
            config: Self.config,
            buildRequest: Self.bearerRequest
        )

        requireWatchSession(status == 200, "Watch rejected the phone's unknown-lineage convention")
        let bearers = await http.recordedBearers()
        requireWatchSession(bearers == ["Bearer \(accessToken)"], "Watch did not use the unknown-lineage access token")
    }

    static func testSpecificLineageStillRejectsTokenWithoutSessionId() throws {
        let vault = WatchSessionVault(store: InMemoryWatchSessionStore())
        do {
            try vault.install(capsuleJson: Self.capsule(
                revision: 1,
                lineage: "lineage-a",
                accessToken: Self.jwtWithoutSessionId(marker: 1),
                refreshToken: "refresh-1"
            ))
            fatalError("Watch accepted missing session_id for a specific lineage")
        } catch WatchSessionError.identityMismatch {
            // Expected: only the phone's explicit "unknown" convention is accepted.
        }
    }

    static func capsule(
        revision: Int,
        lineage: String = "lineage-a",
        accessToken: String,
        refreshToken: String
    ) -> String {
        let session = String(
            data: try! JSONSerialization.data(withJSONObject: [
                "access_token": accessToken,
                "refresh_token": refreshToken,
                "expires_in": 3600,
                "token_type": "bearer",
                "user": ["id": "user-1"],
            ], options: [.sortedKeys]),
            encoding: .utf8
        )!
        return String(
            data: try! JSONSerialization.data(withJSONObject: [
                "version": 1,
                "revision": revision,
                "lineage": lineage,
                "session": session,
            ], options: [.sortedKeys]),
            encoding: .utf8
        )!
    }

    static let config = WatchSupabaseEndpointConfig(
        supabaseUrl: "https://example.supabase.co",
        anonKey: "anon"
    )

    static let bearerRequest: @Sendable (String) -> URLRequest = { token in
        var request = URLRequest(url: URL(string: "https://example.supabase.co/rest/v1/items")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }

    static func jwt(lineage: String, marker: Int) -> String {
        let header = Data("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".utf8).base64EncodedString()
        let payload = try! JSONSerialization.data(withJSONObject: [
            "session_id": lineage,
            "sub": "user-1",
            "iat": marker,
        ]).base64EncodedString()
        return "\(base64Url(header)).\(base64Url(payload)).signature"
    }

    static func jwtWithoutSessionId(marker: Int) -> String {
        let header = Data("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".utf8).base64EncodedString()
        let payload = try! JSONSerialization.data(withJSONObject: [
            "sub": "user-1",
            "iat": marker,
        ]).base64EncodedString()
        return "\(base64Url(header)).\(base64Url(payload)).signature"
    }

    static func base64Url(_ value: String) -> String {
        value
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
