import Foundation

final class InMemoryWatchSessionStore: WatchSessionStore, @unchecked Sendable {
    var bytes: Data?
    var writeCount = 0
    var deleteCount = 0

    func readRaw() throws -> Data? { bytes }

    func writeRaw(_ data: Data) throws {
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

actor RecordedWatchRefreshClient: WatchSupabaseRefreshClient {
    private let response: String
    private var calls = 0

    init(response: String) {
        self.response = response
    }

    func refresh(refreshToken: String, config: WatchSupabaseEndpointConfig) async throws -> String {
        calls += 1
        return response
    }

    func callCount() -> Int { calls }
}

struct FailingWatchRefreshClient: WatchSupabaseRefreshClient {
    func refresh(refreshToken: String, config: WatchSupabaseEndpointConfig) async throws -> String {
        throw WatchSessionError.refreshRejected
    }
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
        try await testUnauthorizedRequestRenewsAndRetriesOnce()
        try await testRefreshFailureIsLoggedWithoutRetry()
        try await testSecondUnauthorizedResponseIsLoggedWithoutThirdSend()
        print("PASS: Watch Supabase session renewal core")
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

    static func testUnauthorizedRequestRenewsAndRetriesOnce() async throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 7,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))
        store.writeCount = 0
        let renewedToken = Self.jwt(lineage: "lineage-a", marker: 2)
        let refresh = RecordedWatchRefreshClient(response: Self.refreshResponse(
            accessToken: renewedToken,
            refreshToken: "refresh-2"
        ))
        let http = RecordedWatchHTTPClient(
            statuses: [401, 200],
            bodies: [Data(), Data("fresh".utf8)]
        )
        let logger = RecordingWatchSessionLogger()
        let transport = WatchSupabaseTransport(
            vault: vault,
            refreshClient: refresh,
            httpClient: http,
            logger: logger
        )

        let (status, body) = try await transport.send(
            config: WatchSupabaseEndpointConfig(
                supabaseUrl: "https://example.supabase.co",
                anonKey: "anon"
            )
        ) { token in
            var request = URLRequest(url: URL(string: "https://example.supabase.co/rest/v1/items")!)
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            return request
        }

        requireWatchSession(status == 200, "Watch did not return the retry response")
        requireWatchSession(String(data: body, encoding: .utf8) == "fresh", "Watch lost the retry body")
        let bearers = await http.recordedBearers()
        let refreshCalls = await refresh.callCount()
        requireWatchSession(bearers.count == 2, "Watch did not retry exactly once")
        requireWatchSession(bearers.last == "Bearer \(renewedToken)", "Watch retry used the stale bearer")
        requireWatchSession(refreshCalls == 1, "Watch redeemed more than once")
        requireWatchSession(store.writeCount == 1, "Watch did not replace the credential pair once")
        let stored = try vault.read()
        requireWatchSession(stored?.revision == 8, "Watch did not advance the local capsule revision")
        requireWatchSession(stored?.session.contains("refresh-2") == true, "Watch did not persist the rotated refresh token")
        requireWatchSession(logger.events.isEmpty, "Successful renewal emitted a failure log")
    }

    static func testRefreshFailureIsLoggedWithoutRetry() async throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 2,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))
        store.writeCount = 0
        let http = RecordedWatchHTTPClient(statuses: [401])
        let logger = RecordingWatchSessionLogger()
        let transport = WatchSupabaseTransport(
            vault: vault,
            refreshClient: FailingWatchRefreshClient(),
            httpClient: http,
            logger: logger
        )

        do {
            _ = try await transport.send(config: Self.config, buildRequest: Self.bearerRequest)
            fatalError("Watch swallowed the renewal failure")
        } catch WatchSessionError.refreshRejected {
            // Expected public failure.
        }

        let bearers = await http.recordedBearers()
        requireWatchSession(bearers.count == 1, "Watch retried after refresh-token redemption failed")
        requireWatchSession(store.writeCount == 0, "Watch replaced the pair after failed redemption")
        requireWatchSession(
            logger.events == [WatchSessionLogEvent(kind: .refreshRejected)],
            "Watch did not log the renewal failure exactly once"
        )
    }

    static func testSecondUnauthorizedResponseIsLoggedWithoutThirdSend() async throws {
        let store = InMemoryWatchSessionStore()
        let vault = WatchSessionVault(store: store)
        try vault.install(capsuleJson: Self.capsule(
            revision: 2,
            accessToken: Self.jwt(lineage: "lineage-a", marker: 1),
            refreshToken: "refresh-1"
        ))
        let refresh = RecordedWatchRefreshClient(response: Self.refreshResponse(
            accessToken: Self.jwt(lineage: "lineage-a", marker: 2),
            refreshToken: "refresh-2"
        ))
        let http = RecordedWatchHTTPClient(statuses: [401, 401])
        let logger = RecordingWatchSessionLogger()
        let transport = WatchSupabaseTransport(
            vault: vault,
            refreshClient: refresh,
            httpClient: http,
            logger: logger
        )

        let (status, _) = try await transport.send(
            config: Self.config,
            buildRequest: Self.bearerRequest
        )

        let bearers = await http.recordedBearers()
        let refreshCalls = await refresh.callCount()
        requireWatchSession(status == 401, "Watch hid the retry's unauthorized response")
        requireWatchSession(bearers.count == 2, "Watch sent more than one retry")
        requireWatchSession(refreshCalls == 1, "Watch redeemed more than once")
        requireWatchSession(
            logger.events == [WatchSessionLogEvent(kind: .retryUnauthorized)],
            "Watch did not log the failed retry exactly once"
        )
    }

    static func capsule(revision: Int, accessToken: String, refreshToken: String) -> String {
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
                "lineage": "lineage-a",
                "session": session,
            ], options: [.sortedKeys]),
            encoding: .utf8
        )!
    }

    static func refreshResponse(accessToken: String, refreshToken: String) -> String {
        String(
            data: try! JSONSerialization.data(withJSONObject: [
                "access_token": accessToken,
                "refresh_token": refreshToken,
                "expires_in": 3600,
                "token_type": "bearer",
                "user": ["id": "user-1"],
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

    static func base64Url(_ value: String) -> String {
        value
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
