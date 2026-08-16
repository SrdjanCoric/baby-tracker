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
    func withLock<T>(
        _ body: @escaping @Sendable (CrossProcessLockLease) async throws -> T
    ) async throws -> T {
        onAcquired?()
        return try await body(CrossProcessLockLease())
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
    func withLock<T>(
        _ body: @escaping @Sendable (CrossProcessLockLease) async throws -> T
    ) async throws -> T {
        await state.acquire()
        do {
            let result = try await body(CrossProcessLockLease())
            await state.release()
            return result
        } catch {
            await state.release()
            throw error
        }
    }
}

final class LeaseBox: @unchecked Sendable {
    private let mutex = NSLock()
    private var stored: CrossProcessLockLease?
    var lease: CrossProcessLockLease? {
        get { mutex.lock(); defer { mutex.unlock() }; return stored }
        set { mutex.lock(); stored = newValue; mutex.unlock() }
    }
}

/// Lock that publishes each critical section's lease so a test can revoke it
/// mid-body, simulating a forced release on imminent suspension.
final class LeasePublishingLock: CrossProcessSessionLock, @unchecked Sendable {
    let box: LeaseBox
    init(box: LeaseBox) { self.box = box }
    func withLock<T>(
        _ body: @escaping @Sendable (CrossProcessLockLease) async throws -> T
    ) async throws -> T {
        let lease = CrossProcessLockLease()
        box.lease = lease
        return try await body(lease)
    }
}

/// Refresh client that revokes the published lease while the redemption is on
/// the network — the exact moment a suspension-forced release interrupts it.
actor LeaseRevokingRefreshClient: SupabaseRefreshClient {
    let box: LeaseBox
    let response: String
    private var callCountValue = 0

    init(box: LeaseBox, response: String) {
        self.box = box
        self.response = response
    }

    func refresh(refreshToken: String, config: SupabaseEndpointConfig) async throws -> String {
        callCountValue += 1
        box.lease?.revoke()
        return response
    }

    func callCount() -> Int { callCountValue }
}

/// Polling async gate for deterministic cross-task ordering without timers.
final class TestGate: @unchecked Sendable {
    private let mutex = NSLock()
    private var opened = false

    func open() {
        mutex.lock()
        opened = true
        mutex.unlock()
    }

    func isOpen() -> Bool {
        mutex.lock()
        defer { mutex.unlock() }
        return opened
    }

    func wait() async {
        while !isOpen() {
            try? await Task.sleep(nanoseconds: 5_000_000)
        }
    }
}

/// Suspension guard the test drives by hand: records begin/end pairing and can
/// fire every registered expiration handler, simulating the system expiring the
/// assertion right before suspending the process.
final class ManualSuspensionGuard: SuspensionGuarding, @unchecked Sendable {
    private let mutex = NSLock()
    private var handlers: [@Sendable () -> Void] = []
    private var beginCountValue = 0
    private var endCountValue = 0
    private let onBegin: (@Sendable () -> Void)?

    init(onBegin: (@Sendable () -> Void)? = nil) {
        self.onBegin = onBegin
    }

    func begin(
        reason: String,
        onExpiration: @escaping @Sendable () -> Void
    ) -> @Sendable () -> Void {
        mutex.lock()
        beginCountValue += 1
        handlers.append(onExpiration)
        mutex.unlock()
        onBegin?()
        return { [self] in
            mutex.lock()
            endCountValue += 1
            mutex.unlock()
        }
    }

    func expireAll() {
        mutex.lock()
        let snapshot = handlers
        mutex.unlock()
        for handler in snapshot {
            handler()
        }
    }

    func beginCount() -> Int {
        mutex.lock()
        defer { mutex.unlock() }
        return beginCountValue
    }

    func endCount() -> Int {
        mutex.lock()
        defer { mutex.unlock() }
        return endCountValue
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
        await Self.testTransportFallsBackToLegacyAppGroupTokenWhenCapsuleAbsent()
        await Self.testConcurrentRedemptionRedeemsOnce()
        await Self.testRevokedLeasePersistsRedeemedPairUnderFreshLock()
        Self.testAppLockExpirationDuringAcquireReleasesResourcesOnce()
        Self.testAppLockRevocationIsScopedToItsIssuedHandle()
        Self.testAppLockExpirationWaitsForCapsuleMutation()
        Self.testLeaseRevocationWaitsForHeldMutation()
        await Self.testPosixLockNormalSectionHoldsAssertionAndReleases()
        await Self.testPosixLockExpirationForceReleasesAndRevokesLease()
        await Self.testPosixLockCancellationDuringAcquireReleasesDescriptor()
        await Self.testPosixLockExpirationDuringAcquireAborts()
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

    static func testTransportFallsBackToLegacyAppGroupTokenWhenCapsuleAbsent() async {
        let store = InMemorySharedSessionStore()
        // No capsule written; simulates the post-app-update, pre-first-launch
        // window the widget must survive without a Keychain envelope.
        let vault = SharedSessionVault(store: store)
        let http = RecordedHTTPClient(status: 200, body: Data("snapshot".utf8))
        let refreshClient = RecordedRefreshClient()
        let logger = RecordingSessionLogger()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: ImmediateLock(),
            refreshClient: refreshClient,
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: logger,
            legacyAccessTokenProvider: { "legacy-bearer-token" }
        )
        let (status, body) = try! await transport.send { token in Self.bearerRequest(token: token) }
        requireSession(status == 200, "legacy fallback did not pass through 200")
        requireSession(String(data: body, encoding: .utf8) == "snapshot", "legacy fallback did not return the body")
        let requests = await http.recordedRequests()
        requireSession(requests.count == 1, "legacy fallback sent more than one request")
        requireSession(requests.first?.bearer == "Bearer legacy-bearer-token", "legacy fallback did not use the App Group bearer")
        let refreshCalls = await refreshClient.callCount()
        requireSession(refreshCalls == 0, "legacy path redeemed the refresh token (should be refresh-less)")
        requireSession(store.writeCount == 0, "legacy fallback wrote the vault")
        requireSession(logger.events.isEmpty, "legacy fallback logged a session event")
    }

    // MARK: - Slice 11

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

    // MARK: - Slice 12

    static func testRevokedLeasePersistsRedeemedPairUnderFreshLock() async {
        let store = InMemorySharedSessionStore()
        store.bytes = Self.encodedEnvelope(revision: 1, accessToken: Self.lineageToken("lineage-a"), refreshToken: "refresh-1", lineage: "lineage-a")
        let vault = SharedSessionVault(store: store)
        let refreshedToken = Self.jwt(payload: ["session_id": "lineage-a", "sub": "user-1"])
        let box = LeaseBox()
        let refreshClient = LeaseRevokingRefreshClient(
            box: box,
            response: Self.refreshResponseJson(accessToken: refreshedToken, refreshToken: "refresh-2", expiresIn: 3600)
        )
        let http = RecordedHTTPClient(
            statuses: [401, 200],
            bodies: [Data(), Data("recovered".utf8)]
        )
        let logger = RecordingSessionLogger()
        let transport = WidgetSupabaseTransport(
            vault: vault,
            lock: LeasePublishingLock(box: box),
            refreshClient: refreshClient,
            httpClient: http,
            config: SupabaseEndpointConfig(supabaseUrl: "https://example.supabase.co", anonKey: "anon"),
            logger: logger
        )
        let result = try! await transport.send { token in Self.bearerRequest(token: token) }
        requireSession(result.0 == 200, "revoked-lease recovery did not retry the request")
        requireSession(
            String(data: result.1, encoding: .utf8) == "recovered",
            "revoked-lease recovery did not return the retry body"
        )
        let revokedRefreshCalls = await refreshClient.callCount()
        requireSession(revokedRefreshCalls == 1, "revoked-lease path did not redeem exactly once")
        requireSession(store.writeCount == 1, "revoked-lease recovery did not persist exactly once")
        let recovered = try! vault.read()!
        requireSession(recovered.revision == 2, "revoked-lease recovery did not bump the revision")
        requireSession(recovered.session.contains("refresh-2"), "revoked-lease recovery lost the redeemed refresh token")
        requireSession(logger.events.isEmpty, "successful revoked-lease recovery logged a refresh failure")
    }

    // MARK: - Slice 13

    static func testAppLockExpirationDuringAcquireReleasesResourcesOnce() {
        let mutex = NSLock()
        var releasedDescriptors: [Int32] = []
        var endedAssertions = 0
        let coordinator = AppSharedSessionLockCoordinator(
            tryDescriptorAcquire: { _ in false },
            releaseDescriptor: { descriptor in
                mutex.lock()
                releasedDescriptors.append(descriptor)
                mutex.unlock()
            }
        )

        coordinator.prepare(handle: "waiting")
        requireSession(
            coordinator.attachAssertion(handle: "waiting") {
                mutex.lock()
                endedAssertions += 1
                mutex.unlock()
            },
            "app acquire did not attach its assertion"
        )
        requireSession(
            coordinator.attachDescriptor(handle: "waiting", descriptor: 41),
            "app acquire did not register its in-flight descriptor"
        )
        requireSession(
            coordinator.tryAcquire(handle: "waiting") == .busy,
            "contended app descriptor unexpectedly acquired"
        )

        requireSession(
            coordinator.forceRelease(handle: "waiting"),
            "expiration did not revoke the in-flight app acquire"
        )
        requireSession(
            coordinator.tryAcquire(handle: "waiting") == .revoked,
            "expired app acquire did not observe revocation"
        )
        requireSession(
            releasedDescriptors == [41],
            "expiration did not close the in-flight app descriptor exactly once"
        )
        requireSession(
            endedAssertions == 1,
            "expiration did not end the in-flight app assertion exactly once"
        )
        coordinator.abandon(handle: "waiting")
        requireSession(
            releasedDescriptors == [41] && endedAssertions == 1,
            "acquire unwind released app resources more than once"
        )
    }

    static func testAppLockRevocationIsScopedToItsIssuedHandle() {
        let coordinator = AppSharedSessionLockCoordinator(
            tryDescriptorAcquire: { _ in true },
            releaseDescriptor: { _ in }
        )
        for (handle, descriptor) in [("revoked", Int32(51)), ("healthy", Int32(52))] {
            coordinator.prepare(handle: handle)
            requireSession(
                coordinator.attachAssertion(handle: handle, end: {}),
                "app handle did not attach its assertion"
            )
            requireSession(
                coordinator.attachDescriptor(handle: handle, descriptor: descriptor),
                "app handle did not attach its descriptor"
            )
            requireSession(
                coordinator.tryAcquire(handle: handle) == .acquired && coordinator.issue(handle: handle),
                "app handle was not issued"
            )
        }

        coordinator.forceRelease(handle: "revoked")
        var healthyMutationRan = false
        requireSession(
            coordinator.withHeldHandle(handle: "healthy") {
                healthyMutationRan = true
            } == .performed && healthyMutationRan,
            "one revoked handle rejected a different handle's mutation"
        )
        requireSession(
            coordinator.withHeldHandle(handle: "revoked", {}) == .revoked,
            "a revoked handle was allowed to mutate the capsule"
        )
        requireSession(
            coordinator.release(handle: "revoked") == .revoked,
            "releasing a revoked app handle was not a successful no-op"
        )
        requireSession(
            !coordinator.forceRelease(handle: "revoked"),
            "late expiration recreated a released app-handle tombstone"
        )
        requireSession(
            coordinator.release(handle: "healthy") == .released,
            "healthy app handle did not release normally"
        )
    }

    static func testAppLockExpirationWaitsForCapsuleMutation() {
        let coordinator = AppSharedSessionLockCoordinator(
            tryDescriptorAcquire: { _ in true },
            releaseDescriptor: { _ in }
        )
        coordinator.prepare(handle: "mutating")
        requireSession(
            coordinator.attachAssertion(handle: "mutating", end: {}),
            "mutating app handle did not attach its assertion"
        )
        requireSession(
            coordinator.attachDescriptor(handle: "mutating", descriptor: 61),
            "mutating app handle did not attach its descriptor"
        )
        requireSession(
            coordinator.tryAcquire(handle: "mutating") == .acquired &&
                coordinator.issue(handle: "mutating"),
            "mutating app handle was not issued"
        )

        let mutationEntered = DispatchSemaphore(value: 0)
        let allowMutationToFinish = DispatchSemaphore(value: 0)
        let mutationFinished = DispatchSemaphore(value: 0)
        let expirationFinished = DispatchSemaphore(value: 0)
        DispatchQueue.global().async {
            _ = coordinator.withHeldHandle(handle: "mutating") {
                mutationEntered.signal()
                allowMutationToFinish.wait()
            }
            mutationFinished.signal()
        }
        mutationEntered.wait()
        DispatchQueue.global().async {
            coordinator.forceRelease(handle: "mutating")
            expirationFinished.signal()
        }

        requireSession(
            expirationFinished.wait(timeout: .now() + 0.05) == .timedOut,
            "expiration released the app flock during a capsule mutation"
        )
        allowMutationToFinish.signal()
        requireSession(
            mutationFinished.wait(timeout: .now() + 1) == .success,
            "app capsule mutation did not finish"
        )
        requireSession(
            expirationFinished.wait(timeout: .now() + 1) == .success,
            "expiration did not release the app flock after mutation"
        )
        requireSession(
            coordinator.release(handle: "mutating") == .revoked,
            "revoked mutation handle did not unwind as a no-op"
        )
    }

    static func testLeaseRevocationWaitsForHeldMutation() {
        let lease = CrossProcessLockLease()
        let mutationEntered = DispatchSemaphore(value: 0)
        let allowMutationToFinish = DispatchSemaphore(value: 0)
        let mutationFinished = DispatchSemaphore(value: 0)
        let revocationFinished = DispatchSemaphore(value: 0)

        DispatchQueue.global().async {
            try! lease.withHeldLock {
                mutationEntered.signal()
                allowMutationToFinish.wait()
            }
            mutationFinished.signal()
        }
        mutationEntered.wait()
        DispatchQueue.global().async {
            lease.revoke()
            revocationFinished.signal()
        }

        requireSession(
            revocationFinished.wait(timeout: .now() + 0.05) == .timedOut,
            "lease revocation interleaved with a held capsule mutation"
        )
        allowMutationToFinish.signal()
        requireSession(
            mutationFinished.wait(timeout: .now() + 1) == .success,
            "held lease mutation did not finish"
        )
        requireSession(
            revocationFinished.wait(timeout: .now() + 1) == .success,
            "lease did not revoke after its mutation finished"
        )
        requireSession(lease.isRevoked, "lease was not revoked after mutation")
    }

    // MARK: - Slice 14

    static func temporaryLockURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("shared-session-lock-tests-\(UUID().uuidString).lock")
    }

    static func testPosixLockNormalSectionHoldsAssertionAndReleases() async {
        let lockURL = Self.temporaryLockURL()
        defer { try? FileManager.default.removeItem(at: lockURL) }
        let guardImpl = ManualSuspensionGuard()
        let lock = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            suspensionGuard: guardImpl
        )
        let leaseBox = LeaseBox()
        let value = try! await lock.withLock { lease in
            leaseBox.lease = lease
            return 7
        }
        requireSession(value == 7, "normal section did not return its body value")
        requireSession(guardImpl.beginCount() == 1, "normal section did not begin exactly one assertion")
        requireSession(guardImpl.endCount() == 1, "normal section did not end its assertion")
        requireSession(leaseBox.lease?.isRevoked == false, "normal section revoked its lease")

        // The descriptor must be gone: a second lock over the same file
        // acquires immediately.
        let second = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            acquireTimeoutMs: 500,
            suspensionGuard: ManualSuspensionGuard()
        )
        let reacquired = try! await second.withLock { _ in true }
        requireSession(reacquired, "released lock could not be reacquired")
    }

    static func testPosixLockExpirationForceReleasesAndRevokesLease() async {
        let lockURL = Self.temporaryLockURL()
        defer { try? FileManager.default.removeItem(at: lockURL) }
        let guardImpl = ManualSuspensionGuard()
        let lock = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            suspensionGuard: guardImpl
        )
        let bodyEntered = TestGate()
        let bodyMayFinish = TestGate()
        let holder = Task {
            try await lock.withLock { lease -> Bool in
                bodyEntered.open()
                await bodyMayFinish.wait()
                return lease.isRevoked
            }
        }
        await bodyEntered.wait()

        // System is about to suspend the process: the assertion expires while
        // the critical section is still awaiting.
        guardImpl.expireAll()

        // The flock must already be free even though the first body has not
        // finished: another process (here: another descriptor) can acquire it.
        let contender = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            acquireTimeoutMs: 2000,
            suspensionGuard: ManualSuspensionGuard()
        )
        let acquiredDuringExpiredSection = try! await contender.withLock { _ in true }
        requireSession(acquiredDuringExpiredSection, "forced release did not free the flock for the next holder")

        bodyMayFinish.open()
        let revokedSeenByBody = try! await holder.value
        requireSession(revokedSeenByBody, "forced release did not revoke the section's lease")
        requireSession(guardImpl.endCount() == 1, "interrupted section did not end its assertion on exit")
    }

    static func testPosixLockCancellationDuringAcquireReleasesDescriptor() async {
        let lockURL = Self.temporaryLockURL()
        defer { try? FileManager.default.removeItem(at: lockURL) }
        let holderLock = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            suspensionGuard: ManualSuspensionGuard()
        )
        let holderEntered = TestGate()
        let holderMayFinish = TestGate()
        let holder = Task {
            try await holderLock.withLock { _ in
                holderEntered.open()
                await holderMayFinish.wait()
                return true
            }
        }
        await holderEntered.wait()
        let baselineDescriptors = (try? FileManager.default.contentsOfDirectory(
            atPath: "/dev/fd"
        ).count) ?? -1

        let waiterBegan = TestGate()
        let waiter = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            acquireTimeoutMs: 10_000,
            suspensionGuard: ManualSuspensionGuard(onBegin: { waiterBegan.open() })
        )
        let waiterTask = Task {
            try await waiter.withLock { _ in false }
        }
        await waiterBegan.wait()
        let descriptorsWithWaiter = (try? FileManager.default.contentsOfDirectory(
            atPath: "/dev/fd"
        ).count) ?? -1
        requireSession(
            descriptorsWithWaiter > baselineDescriptors,
            "contended waiter did not open a descriptor before cancellation"
        )

        waiterTask.cancel()
        do {
            _ = try await waiterTask.value
            fatalError("cancelled lock waiter unexpectedly completed")
        } catch is CancellationError {
            // expected
        } catch {
            fatalError("cancelled lock waiter threw an unexpected error: \(error)")
        }
        let descriptorsAfterCancellation = (try? FileManager.default.contentsOfDirectory(
            atPath: "/dev/fd"
        ).count) ?? -1
        requireSession(
            descriptorsAfterCancellation == baselineDescriptors,
            "cancelled lock waiter leaked its descriptor"
        )

        holderMayFinish.open()
        _ = try! await holder.value
    }

    static func testPosixLockExpirationDuringAcquireAborts() async {
        let lockURL = Self.temporaryLockURL()
        defer { try? FileManager.default.removeItem(at: lockURL) }
        let holderGuard = ManualSuspensionGuard()
        let holderLock = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            suspensionGuard: holderGuard
        )
        let holderEntered = TestGate()
        let holderMayFinish = TestGate()
        let holder = Task {
            try await holderLock.withLock { _ in
                holderEntered.open()
                await holderMayFinish.wait()
                return true
            }
        }
        await holderEntered.wait()

        // A waiter still in its acquire loop gets expired: it must abort
        // instead of spinning on a dead descriptor for the whole timeout.
        let waiterGuard = ManualSuspensionGuard()
        let waiter = PosixSharedSessionLock(
            lockFileURLProvider: { lockURL },
            acquireTimeoutMs: 10000,
            suspensionGuard: waiterGuard
        )
        let waiterStarted = TestGate()
        let waiterResult = Task { () -> SharedSessionError? in
            waiterStarted.open()
            do {
                _ = try await waiter.withLock { _ in false }
                return nil
            } catch let error as SharedSessionError {
                return error
            } catch {
                return nil
            }
        }
        await waiterStarted.wait()
        try? await Task.sleep(nanoseconds: 60_000_000)
        waiterGuard.expireAll()
        let outcome = await waiterResult.value
        requireSession(outcome == .lockRevoked, "an expired waiter did not abort its acquire with lockRevoked")

        holderMayFinish.open()
        _ = try! await holder.value
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
