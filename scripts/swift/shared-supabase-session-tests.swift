import Foundation

// MARK: - Test doubles

final class InMemorySharedSessionStore: SharedSessionStore, @unchecked Sendable {
    var bytes: Data?
    var writeCount = 0
    var deleteCount = 0
    var writeShouldFail = false

    func readRaw() throws -> Data? { bytes }
    func writeRaw(_ data: Data) throws {
        if writeShouldFail { throw SharedSessionError.storeFailure }
        bytes = data
        writeCount += 1
    }
    func deleteRaw() throws {
        deleteCount += 1
        bytes = nil
    }
}

final class RecordingSessionLogger: SharedSessionLogger, @unchecked Sendable {
    private(set) var events: [SharedSessionLogEvent] = []
    func log(_ event: SharedSessionLogEvent) { events.append(event) }
}

actor RecordedHTTPClient: SupabaseHTTPClient {
    struct Entry { let bearer: String? }
    private let bodies: [Data]
    private let statuses: [Int]
    private var requestBearers: [String?] = []

    init(statuses: [Int], bodies: [Data] = []) {
        self.statuses = statuses
        self.bodies = bodies
    }

    init(status: Int, body: Data = Data()) {
        self.init(statuses: [status], bodies: [body])
    }

    func send(_ request: URLRequest) async throws -> (Int, Data) {
        let bearer = request.value(forHTTPHeaderField: "Authorization")
        requestBearers.append(bearer)
        let index = requestBearers.count - 1
        let status = statuses[min(index, statuses.count - 1)]
        let body = bodies.indices.contains(index) ? bodies[index] : Data()
        return (status, body)
    }

    func recordedRequests() -> [Entry] {
        requestBearers.map { Entry(bearer: $0) }
    }
}

actor RecordedRefreshClient: SupabaseRefreshClient {
    let response: String?
    let thrownError: Error?
    let delayNanoseconds: UInt64
    private var callCountValue = 0

    init(response: String? = nil, error: Error? = nil, delayNanoseconds: UInt64 = 0) {
        self.response = response
        self.thrownError = error
        self.delayNanoseconds = delayNanoseconds
    }

    func refresh(refreshToken: String, config: SupabaseEndpointConfig) async throws -> String {
        callCountValue += 1
        if delayNanoseconds > 0 {
            try await Task.sleep(nanoseconds: delayNanoseconds)
        }
        if let thrownError { throw thrownError }
        guard let response else { throw SharedSessionError.refreshRejected }
        return response
    }

    func callCount() -> Int { callCountValue }
}

final class InspectingLock: CrossProcessSessionLock, @unchecked Sendable {
    var onAcquired: (@Sendable () -> Void)?
    func withLock<T>(_ body: @escaping @Sendable () async throws -> T) async throws -> T {
        onAcquired?()
        return try await body()
    }
}

final class MutexLock: CrossProcessSessionLock, @unchecked Sendable {
    private actor State {
        var locked = false
        var waiters: [CheckedContinuation<Void, Never>] = []
        func acquire() async {
            if !locked { locked = true; return }
            await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                waiters.append(continuation)
            }
        }
        func release() {
            if let next = waiters.first {
                waiters.removeFirst()
                next.resume()
            } else {
                locked = false
            }
        }
    }
    private let state = State()
    func withLock<T>(_ body: @escaping @Sendable () async throws -> T) async throws -> T {
        await state.acquire()
        do {
            let result = try await body()
            await state.release()
            return result
        } catch {
            await state.release()
            throw error
        }
    }
}

func requireSession(_ condition: @autoclosure () throws -> Bool, _ message: String, file: StaticString = #file, line: UInt = #line) {
    do {
        if try !condition() { fatalError(message, file: file, line: line) }
    } catch {
        fatalError("\(message): threw \(error)", file: file, line: line)
    }
}

private enum TestSessionError: Error { case stop }

@main
enum SharedSupabaseSessionTests {
    static func main() async throws {
        Self.testEnvelopeCodecAndVaultCAS()
        Self.testLineageExtraction()
        Self.testRefreshResponseMerging()
        await Self.testTransportFreshTokenSingleSend()
        await Self.testTransport401RenewsAndRetriesOnce()
        await Self.testTransport401AdoptsConcurrentRotation()
        await Self.testTransportRefreshFailureLogsAndThrows()
        await Self.testTransportRetry401ReturnsOnce()
        await Self.testTransportMissingSessionLogsAndThrows()
        await Self.testConcurrentRedemptionRedeemsOnce()
        print("PASS: Shared Supabase session renewal core")
    }

    // MARK: - Slice 1

    static func testEnvelopeCodecAndVaultCAS() {
        let store = InMemorySharedSessionStore()
        let vault = SharedSessionVault(store: store)

        requireSession((try vault.read()) == nil, "fresh vault reported a session")

        let sessionJson = Self.sessionJson(accessToken: "access-1", refreshToken: "refresh-1")
        let first = SharedSessionEnvelopeV1(version: 1, revision: 1, lineage: "lineage-a", session: sessionJson)
        let installed = try! vault.replace(expectedRevision: nil, first)
        requireSession(installed.revision == 1, "initial install lost its revision")
        requireSession((try vault.read()) == first, "vault did not round-trip the installed envelope")
        requireSession(store.writeCount == 1, "initial install wrote more than once")

        do {
            _ = try vault.replace(expectedRevision: 5, first)
            fatalError("stale expectedRevision did not reject a concurrent write")
        } catch SharedSessionError.sessionChanged {
            // expected
        } catch {
            fatalError("unexpected error: \(error)")
        }

        let rotated = SharedSessionEnvelopeV1(
            version: 1,
            revision: 2,
            lineage: "lineage-a",
            session: Self.sessionJson(accessToken: "access-2", refreshToken: "refresh-2")
        )
        let bumped = try! vault.replace(expectedRevision: 1, rotated)
        requireSession(bumped.revision == 2, "rotated envelope lost its revision")
        requireSession((try vault.read()?.session.contains("access-2")) == true, "vault kept the stale pair")

        try! vault.remove()
        requireSession((try vault.read()) == nil, "remove left a session behind")
        requireSession(store.deleteCount == 1, "remove did not delete the raw item")
    }

    // MARK: - Slice 2

    static func testLineageExtraction() {
        let token = Self.jwt(payload: ["session_id": "lineage-a", "sub": "user-1"])
        let lineage = SupabaseSessionLineage.extract(fromAccessToken: token)
        requireSession(lineage == "lineage-a", "session_id was not extracted from the access token")

        let plainToken = Self.jwt(payload: ["sub": "user-1"])
        requireSession(SupabaseSessionLineage.extract(fromAccessToken: plainToken) == nil, "missing session_id produced a lineage")
        requireSession(SupabaseSessionLineage.extract(fromAccessToken: "not-a-jwt") == nil, "garbage token produced a lineage")
    }

    // MARK: - Slice 3

    static func testRefreshResponseMerging() {
        let response = Self.refreshResponseJson(
            accessToken: Self.jwt(payload: ["session_id": "lineage-a", "sub": "user-1"]),
            refreshToken: "refresh-2",
            expiresIn: 3600
        )
        let merged = try! RefreshedSessionBuilder.build(fromResponseBody: response)
        let session = try! JSONSerialization.jsonObject(with: Data(merged.sessionJson.utf8)) as! [String: Any]
        requireSession(merged.lineage == "lineage-a", "refresh response did not preserve the session lineage")
        requireSession(session["access_token"] != nil && session["refresh_token"] as? String == "refresh-2", "refresh response did not carry the renewed pair")
        requireSession(session["expires_at"] != nil, "refresh response did not derive an absolute expiry")
    }

    // MARK: - Slice 4

    static func testTransportFreshTokenSingleSend() async {
        let store = InMemorySharedSessionStore()
        store.bytes = Self.encodedEnvelope(revision: 1, accessToken: Self.lineageToken("lineage-a"), refreshToken: "refresh-1", lineage: "lineage-a")
        let vault = SharedSessionVault(store: store)
        let http = RecordedHTTPClient(status: 200, body: Data("snapshot".utf8))
        let logger = RecordingSessionLogger()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: ImmediateLock(),
            refreshClient: RecordedRefreshClient(response: Self.refreshResponseJson(accessToken: "unused", refreshToken: "x", expiresIn: 3600)),
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: logger
        )
        let (status, body) = try! await transport.send { token in Self.bearerRequest(token: token) }
        requireSession(status == 200, "fresh token did not pass through")
        requireSession(String(data: body, encoding: .utf8) == "snapshot", "fresh body was not returned")
        let requests = await http.recordedRequests()
        requireSession(requests.count == 1, "fresh path sent more than one request")
        requireSession(requests.first?.bearer == "Bearer \(Self.lineageToken("lineage-a"))", "fresh request did not use the stored access token")
        requireSession(logger.events.isEmpty, "fresh path logged a session event")
        requireSession(store.writeCount == 0, "fresh path wrote the vault")
    }

    // MARK: - Slice 5

    static func testTransport401RenewsAndRetriesOnce() async {
        let store = InMemorySharedSessionStore()
        store.bytes = Self.encodedEnvelope(revision: 3, accessToken: Self.lineageToken("lineage-a"), refreshToken: "refresh-1", lineage: "lineage-a")
        let vault = SharedSessionVault(store: store)
        let refreshedToken = Self.jwt(payload: ["session_id": "lineage-a", "sub": "user-1"])
        let refreshClient = RecordedRefreshClient(
            response: Self.refreshResponseJson(accessToken: refreshedToken, refreshToken: "refresh-2", expiresIn: 3600)
        )
        let http = RecordedHTTPClient(statuses: [401, 200], bodies: [Data(), Data("fresh".utf8)])
        let logger = RecordingSessionLogger()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: ImmediateLock(),
            refreshClient: refreshClient,
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: logger
        )
        let (status, body) = try! await transport.send { token in Self.bearerRequest(token: token) }
        requireSession(status == 200, "renewal did not retry with the fresh token")
        requireSession(String(data: body, encoding: .utf8) == "fresh", "retry body was not returned")
        let requests = await http.recordedRequests()
        let refreshCalls = await refreshClient.callCount()
        requireSession(requests.count == 2, "renewal did not send exactly two requests")
        requireSession(requests.last?.bearer == "Bearer \(refreshedToken)", "retry did not use the renewed access token")
        requireSession(refreshCalls == 1, "renewal redeemed the refresh token more than once")
        requireSession(store.writeCount == 1, "renewal did not persist the rotated pair")
        let written = try! vault.read()!
        requireSession(written.revision == 4, "renewal did not bump the envelope revision")
        requireSession(written.lineage == "lineage-a", "renewal changed the session lineage")
        requireSession(written.session.contains("refresh-2"), "renewal did not persist the refreshed refresh token")
        requireSession(logger.events.isEmpty, "successful renewal logged a session event")
    }

    // MARK: - Slice 6

    static func testTransport401AdoptsConcurrentRotation() async {
        let store = InMemorySharedSessionStore()
        store.bytes = Self.encodedEnvelope(revision: 3, accessToken: Self.lineageToken("lineage-a"), refreshToken: "refresh-1", lineage: "lineage-a")
        let vault = SharedSessionVault(store: store)
        let refreshClient = RecordedRefreshClient(response: Self.refreshResponseJson(accessToken: "unused", refreshToken: "x", expiresIn: 3600))
        let winningToken = Self.lineageToken("lineage-a")
        let http = RecordedHTTPClient(statuses: [401, 200], bodies: [Data(), Data("adopted".utf8)])
        let lock = InspectingLock()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: lock,
            refreshClient: refreshClient,
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: RecordingSessionLogger()
        )
        lock.onAcquired = {
            store.bytes = Self.encodedEnvelope(revision: 4, accessToken: winningToken, refreshToken: "refresh-9", lineage: "lineage-a")
        }
        let (status, body) = try! await transport.send { token in Self.bearerRequest(token: token) }
        requireSession(status == 200, "concurrent rotation was not adopted")
        requireSession(String(data: body, encoding: .utf8) == "adopted", "adopted rotation did not return its body")
        let requests = await http.recordedRequests()
        let refreshCalls = await refreshClient.callCount()
        requireSession(requests.last?.bearer == "Bearer \(winningToken)", "retry did not use the concurrently-rotated token")
        requireSession(refreshCalls == 0, "a concurrently-rotated token was redeemed anyway")
    }

    // MARK: - Slice 7

    static func testTransportRefreshFailureLogsAndThrows() async {
        let store = InMemorySharedSessionStore()
        store.bytes = Self.encodedEnvelope(revision: 1, accessToken: Self.lineageToken("lineage-a"), refreshToken: "refresh-1", lineage: "lineage-a")
        let vault = SharedSessionVault(store: store)
        let refreshClient = RecordedRefreshClient(error: TestSessionError.stop)
        let http = RecordedHTTPClient(status: 401)
        let logger = RecordingSessionLogger()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: ImmediateLock(),
            refreshClient: refreshClient,
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: logger
        )
        do {
            _ = try await transport.send { token in Self.bearerRequest(token: token) }
            fatalError("refresh failure did not surface")
        } catch is SharedSessionError {
            // expected
        } catch {
            fatalError("refresh failure threw an unexpected error type")
        }
        let requests = await http.recordedRequests()
        requireSession(requests.count == 1, "refresh failure retried the original request")
        requireSession(store.writeCount == 0, "refresh failure mutated the stored pair")
        requireSession(logger.events.count == 1, "refresh failure did not log exactly one session event")
        requireSession(logger.events.first?.kind == .refreshRejected, "refresh failure logged the wrong kind")
    }

    // MARK: - Slice 8

    static func testTransportRetry401ReturnsOnce() async {
        let store = InMemorySharedSessionStore()
        store.bytes = Self.encodedEnvelope(revision: 1, accessToken: Self.lineageToken("lineage-a"), refreshToken: "refresh-1", lineage: "lineage-a")
        let vault = SharedSessionVault(store: store)
        let refreshedToken = Self.jwt(payload: ["session_id": "lineage-a", "sub": "user-1"])
        let refreshClient = RecordedRefreshClient(
            response: Self.refreshResponseJson(accessToken: refreshedToken, refreshToken: "refresh-2", expiresIn: 3600)
        )
        let http = RecordedHTTPClient(statuses: [401, 401])
        let logger = RecordingSessionLogger()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: ImmediateLock(),
            refreshClient: refreshClient,
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: logger
        )
        let (status, _) = try! await transport.send { token in Self.bearerRequest(token: token) }
        requireSession(status == 401, "a second 401 was not surfaced to the caller")
        let requests = await http.recordedRequests()
        let refreshCalls = await refreshClient.callCount()
        requireSession(requests.count == 2, "a second 401 triggered a third request")
        requireSession(refreshCalls == 1, "a second 401 triggered a second redemption")
    }

    // MARK: - Slice 9

    static func testTransportMissingSessionLogsAndThrows() async {
        let store = InMemorySharedSessionStore()
        let vault = SharedSessionVault(store: store)
        let http = RecordedHTTPClient(status: 200)
        let logger = RecordingSessionLogger()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: ImmediateLock(),
            refreshClient: RecordedRefreshClient(),
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: logger
        )
        do {
            _ = try await transport.send { token in Self.bearerRequest(token: token) }
            fatalError("missing session did not surface")
        } catch SharedSessionError.missingSession {
            // expected
        } catch {
            fatalError("missing session threw an unexpected error type")
        }
        let requests = await http.recordedRequests()
        requireSession(requests.isEmpty, "missing session sent a request")
        requireSession(logger.events.count == 1, "missing session did not log exactly one event")
        requireSession(logger.events.first?.kind == .missingSession, "missing session logged the wrong kind")
    }

    // MARK: - Slice 10

    static func testConcurrentRedemptionRedeemsOnce() async {
        let store = InMemorySharedSessionStore()
        store.bytes = Self.encodedEnvelope(revision: 1, accessToken: Self.lineageToken("lineage-a"), refreshToken: "refresh-1", lineage: "lineage-a")
        let vault = SharedSessionVault(store: store)
        let refreshedToken = Self.jwt(payload: ["session_id": "lineage-a", "sub": "user-1"])
        let refreshClient = RecordedRefreshClient(
            response: Self.refreshResponseJson(accessToken: refreshedToken, refreshToken: "refresh-2", expiresIn: 3600),
            delayNanoseconds: 20_000_000
        )
        let sharedHTTP = RecordedHTTPClient(statuses: [401, 401, 200, 200], bodies: [Data(), Data(), Data("a".utf8), Data("b".utf8)])
        let logger = RecordingSessionLogger()
        let config = SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon")
        let lock = MutexLock()
        let firstTransport = WidgetSupabaseTransport(vault: vault, lock: lock, refreshClient: refreshClient, httpClient: sharedHTTP, config: config, logger: logger)
        let secondTransport = WidgetSupabaseTransport(vault: vault, lock: lock, refreshClient: refreshClient, httpClient: sharedHTTP, config: config, logger: logger)
        async let first = firstTransport.send { token in Self.bearerRequest(token: token) }
        async let second = secondTransport.send { token in Self.bearerRequest(token: token) }
        let (one, two) = try! await (first, second)
        requireSession(one.0 == 200 && two.0 == 200, "concurrent callers did not both succeed")
        let refreshCalls = await refreshClient.callCount()
        requireSession(refreshCalls == 1, "concurrent callers redeemed the refresh token more than once")
        requireSession(store.writeCount == 1, "concurrent callers wrote the rotated pair more than once")
    }

    // MARK: - Fixtures

    static func sessionJson(accessToken: String, refreshToken: String, expiresIn: Int = 3600) -> String {
        let object: [String: Any] = [
            "access_token": accessToken,
            "refresh_token": refreshToken,
            "expires_in": expiresIn,
            "token_type": "bearer",
            "user": ["id": "user-1"]
        ]
        return String(data: try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), encoding: .utf8)!
    }

    static func encodedEnvelope(revision: Int, accessToken: String, refreshToken: String, lineage: String) -> Data {
        let envelope = SharedSessionEnvelopeV1(
            version: 1,
            revision: revision,
            lineage: lineage,
            session: sessionJson(accessToken: accessToken, refreshToken: refreshToken)
        )
        return try! JSONEncoder().encode(envelope)
    }

    static func refreshResponseJson(accessToken: String, refreshToken: String, expiresIn: Int) -> String {
        let object: [String: Any] = [
            "access_token": accessToken,
            "refresh_token": refreshToken,
            "expires_in": expiresIn,
            "token_type": "bearer",
            "user": ["id": "user-1"]
        ]
        return String(data: try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), encoding: .utf8)!
    }

    static func lineageToken(_ lineage: String) -> String {
        Self.jwt(payload: ["session_id": lineage, "sub": "user-1"])
    }

    static func jwt(payload: [String: Any]) -> String {
        let header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}"
        let payloadData = try! JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
        return Self.base64UrlEncode(Data(header.utf8)) + "." + Self.base64UrlEncode(payloadData) + ".signature"
    }

    static func base64UrlEncode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func bearerRequest(token: String) -> URLRequest {
        var request = URLRequest(url: URL(string: "https://example.supabase.co/rest/v1/rpc/get_baby_activity_snapshot")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }
}