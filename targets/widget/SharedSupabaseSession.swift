import Foundation

// MARK: - Errors

enum SharedSessionError: Error, Equatable {
    case missingSession
    case sessionChanged
    case malformedSession
    case unsupportedSchema
    case identityMismatch
    case storeFailure
    case refreshRejected
    case lockRevoked
}

// MARK: - Logging

enum SharedSessionLogKind: Equatable {
    case missingSession
    case refreshRejected
    case lockRevoked
    case retryUnauthorized
}

struct SharedSessionLogEvent: Equatable {
    let kind: SharedSessionLogKind
}

protocol SharedSessionLogger: Sendable {
    func log(_ event: SharedSessionLogEvent)
}

struct DisabledSessionLogger: SharedSessionLogger {
    func log(_ event: SharedSessionLogEvent) {}
}

// MARK: - Envelope

/// Versioned capsule holding the complete Supabase Session in shared Keychain.
/// `revision` is the compare-and-swap marker: it monotonically increases on
/// every pair replacement. `lineage` is the Supabase `session_id`, stable
/// across refresh of one session and changed only by a new sign-in. `session`
/// is opaque Supabase Session JSON (access_token, refresh_token, expires_at,
/// user, ...).
struct SharedSessionEnvelopeV1: Codable, Equatable {
    var version: Int
    var revision: Int
    var lineage: String
    var session: String

    enum CodingKeys: String, CodingKey {
        case version, revision, lineage, session
    }

    init(version: Int, revision: Int, lineage: String, session: String) {
        self.version = version
        self.revision = revision
        self.lineage = lineage
        self.session = session
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decode(Int.self, forKey: .version)
        guard version == 1 else { throw SharedSessionError.unsupportedSchema }
        revision = try container.decode(Int.self, forKey: .revision)
        lineage = try container.decode(String.self, forKey: .lineage)
        session = try container.decode(String.self, forKey: .session)
    }
}

// MARK: - Lineage (JWT session_id)

enum SupabaseSessionLineage {
    /// Extract the Supabase `session_id` claim from an access token without
    /// verifying the signature. Refresh preserves `session_id`, so it is a
    /// stable lineage across rotations and changes only on a new sign-in.
    static func extract(fromAccessToken token: String) -> String? {
        let segments = token.split(separator: ".", omittingEmptySubsequences: true)
        guard segments.count >= 2 else { return nil }
        let payloadSegment = String(segments[1])
        guard let payloadData = base64UrlDecode(payloadSegment) else { return nil }
        guard let object = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any] else {
            return nil
        }
        return object["session_id"] as? String
    }
}

private func base64UrlDecode(_ string: String) -> Data? {
    var base64 = string
        .replacingOccurrences(of: "-", with: "+")
        .replacingOccurrences(of: "_", with: "/")
    while base64.count % 4 != 0 {
        base64.append("=")
    }
    return Data(base64Encoded: base64)
}

// MARK: - Session view (opaque Supabase Session)

struct SupabaseSessionView {
    let accessToken: String
    let refreshToken: String
    let lineage: String
}

enum SupabaseSessionViewError: Error {
    case malformed
}

func ensureValidSession(_ envelope: SharedSessionEnvelopeV1) throws -> SupabaseSessionView {
    guard let data = envelope.session.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw SharedSessionError.malformedSession
    }
    guard let accessToken = object["access_token"] as? String,
          let refreshToken = object["refresh_token"] as? String,
          !accessToken.isEmpty, !refreshToken.isEmpty else {
        throw SharedSessionError.malformedSession
    }
    guard let lineage = SupabaseSessionLineage.extract(fromAccessToken: accessToken) else {
        throw SharedSessionError.identityMismatch
    }
    return SupabaseSessionView(accessToken: accessToken, refreshToken: refreshToken, lineage: lineage)
}

// MARK: - Vault (CAS over a raw store)

protocol SharedSessionStore: Sendable {
    func readRaw() throws -> Data?
    func writeRaw(_ data: Data) throws
    func deleteRaw() throws
}

protocol SharedSessionVaulting: Sendable {
    func read() throws -> SharedSessionEnvelopeV1?
    func replace(expectedRevision: Int?, _ envelope: SharedSessionEnvelopeV1) throws -> SharedSessionEnvelopeV1
    func remove() throws
}

/// Compare-and-swap vault. The cross-process lock serializes every caller,
/// so the read-compare-write inside `replace` is safe even though the raw
/// store is not itself atomic.
final class SharedSessionVault: SharedSessionVaulting, @unchecked Sendable {
    private let store: SharedSessionStore

    init(store: SharedSessionStore) {
        self.store = store
    }

    func read() throws -> SharedSessionEnvelopeV1? {
        guard let bytes = try store.readRaw() else { return nil }
        do {
            return try JSONDecoder().decode(SharedSessionEnvelopeV1.self, from: bytes)
        } catch SharedSessionError.unsupportedSchema {
            throw SharedSessionError.unsupportedSchema
        } catch {
            throw SharedSessionError.malformedSession
        }
    }

    func replace(expectedRevision: Int?, _ envelope: SharedSessionEnvelopeV1) throws -> SharedSessionEnvelopeV1 {
        let current = try read()
        if let expectedRevision, let current, current.revision != expectedRevision {
            throw SharedSessionError.sessionChanged
        }
        let encoded = try JSONEncoder().encode(envelope)
        try store.writeRaw(encoded)
        return envelope
    }

    func remove() throws {
        try store.deleteRaw()
    }
}

// MARK: - Refresh response builder

struct RefreshedSession {
    let sessionJson: String
    let lineage: String
}

enum RefreshedSessionBuilder {
    /// Merge a Supabase refresh-token response into opaque Supabase Session
    /// JSON, deriving the absolute `expires_at` from `expires_in`. Rejects
    /// responses that omit either bearer token or carry no `session_id`.
    static func build(fromResponseBody body: String, at now: Date = Date()) throws -> RefreshedSession {
        guard let data = body.data(using: .utf8),
              let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SharedSessionError.malformedSession
        }
        guard let accessToken = response["access_token"] as? String,
              let refreshToken = response["refresh_token"] as? String,
              !accessToken.isEmpty, !refreshToken.isEmpty else {
            throw SharedSessionError.malformedSession
        }
        guard let lineage = SupabaseSessionLineage.extract(fromAccessToken: accessToken) else {
            throw SharedSessionError.identityMismatch
        }
        guard let expiresInValue = response["expires_in"] as? Int, expiresInValue > 0 else {
            throw SharedSessionError.malformedSession
        }

        var built = response
        built["access_token"] = accessToken
        built["refresh_token"] = refreshToken
        built["token_type"] = response["token_type"] as? String ?? "bearer"
        built["expires_at"] = Int(now.addingTimeInterval(TimeInterval(expiresInValue)).timeIntervalSince1970)
        if built["user"] == nil {
            built["user"] = ["id": "unknown"]
        }

        guard let sessionJson = String(
            data: try JSONSerialization.data(withJSONObject: built, options: [.sortedKeys]),
            encoding: .utf8
        ) else {
            throw SharedSessionError.malformedSession
        }
        return RefreshedSession(sessionJson: sessionJson, lineage: lineage)
    }
}

// MARK: - Refresh client

protocol SupabaseRefreshClient: Sendable {
    func refresh(refreshToken: String, config: SupabaseEndpointConfig) async throws -> String
}

// MARK: - HTTP client

protocol SupabaseHTTPClient: Sendable {
    func send(_ request: URLRequest) async throws -> (Int, Data)
}

// MARK: - Lock

/// Handed to a cross-process critical section. The lock implementation revokes
/// the lease when the system forces the lock to be released early (imminent
/// suspension); the section must then abandon any persist it has not yet made.
final class CrossProcessLockLease: @unchecked Sendable {
    private let mutex = NSLock()
    private var revoked = false

    func revoke() {
        mutex.lock()
        revoked = true
        mutex.unlock()
    }

    var isRevoked: Bool {
        mutex.lock()
        defer { mutex.unlock() }
        return revoked
    }

    /// Call before persisting under the lock.
    func ensureHeld() throws {
        if isRevoked { throw SharedSessionError.lockRevoked }
    }

    /// Keeps revocation from releasing the descriptor between authorization
    /// and one synchronous capsule mutation.
    func withHeldLock<T>(_ body: () throws -> T) throws -> T {
        mutex.lock()
        defer { mutex.unlock() }
        guard !revoked else { throw SharedSessionError.lockRevoked }
        return try body()
    }
}

/// Cross-process lock whose critical section may await. The production adapter
/// holds a POSIX `flock` across the awaited body and releases it on exit.
protocol CrossProcessSessionLock: Sendable {
    func withLock<T>(
        _ body: @escaping @Sendable (CrossProcessLockLease) async throws -> T
    ) async throws -> T
}

// MARK: - Suspension guard

/// Keeps the process eligible to run while a critical section holds the
/// cross-process file lock. `begin` starts an assertion and returns the closure
/// that ends it. `onExpiration` fires when the system is about to suspend the
/// process regardless; the lock force-releases its descriptor there so a
/// suspended process never sits on an App Group flock (0xDEAD10CC).
protocol SuspensionGuarding: Sendable {
    func begin(
        reason: String,
        onExpiration: @escaping @Sendable () -> Void
    ) -> @Sendable () -> Void
}

/// POSIX `flock` over a caller-resolved lock file, guarded against suspension.
/// Every descriptor operation is serialized through one mutex so a forced
/// release can never race the owning section's own acquire or release into a
/// double close or a lock on a reused descriptor number.
final class PosixSharedSessionLock: CrossProcessSessionLock, @unchecked Sendable {
    private final class DescriptorState: @unchecked Sendable {
        private let mutex = NSLock()
        private var fd: Int32?

        init(fd: Int32) {
            self.fd = fd
        }

        /// nil = descriptor was force-released; otherwise whether `flock` won.
        func tryAcquire() -> Bool? {
            mutex.lock()
            defer { mutex.unlock() }
            guard let fd else { return nil }
            return flock(fd, LOCK_EX | LOCK_NB) == 0
        }

        func release() {
            mutex.lock()
            defer { mutex.unlock() }
            guard let fd else { return }
            flock(fd, LOCK_UN)
            close(fd)
            self.fd = nil
        }
    }

    private let lockFileURLProvider: @Sendable () -> URL?
    private let acquireTimeoutMs: Int
    private let suspensionGuard: SuspensionGuarding

    init(
        lockFileURLProvider: @escaping @Sendable () -> URL?,
        acquireTimeoutMs: Int = 10000,
        suspensionGuard: SuspensionGuarding
    ) {
        self.lockFileURLProvider = lockFileURLProvider
        self.acquireTimeoutMs = acquireTimeoutMs
        self.suspensionGuard = suspensionGuard
    }

    func withLock<T>(
        _ body: @escaping @Sendable (CrossProcessLockLease) async throws -> T
    ) async throws -> T {
        guard let lockURL = lockFileURLProvider() else {
            throw SharedSessionError.storeFailure
        }
        let fd = open(lockURL.path, O_CREAT | O_RDWR, 0o600)
        guard fd >= 0 else {
            NSLog("[SharedSupabaseSession] lock open failed: errno=\(errno)")
            throw SharedSessionError.storeFailure
        }

        let state = DescriptorState(fd: fd)
        let lease = CrossProcessLockLease()
        let endAssertion = suspensionGuard.begin(reason: "SharedSupabaseSessionLock") {
            // The system is about to suspend the process regardless. Revoke
            // first so the section refuses to persist, then drop the flock so
            // suspension never freezes a held App Group lock (0xDEAD10CC).
            lease.revoke()
            state.release()
        }
        defer {
            state.release()
            endAssertion()
        }

        let deadline = Date().addingTimeInterval(Double(acquireTimeoutMs) / 1000.0)
        var acquired = false
        while Date() < deadline {
            switch state.tryAcquire() {
            case nil:
                throw SharedSessionError.lockRevoked
            case true?:
                acquired = true
            case false?:
                try await Task.sleep(nanoseconds: 20_000_000)
            }
            if acquired { break }
        }
        guard acquired else {
            NSLog("[SharedSupabaseSession] lock timeout")
            throw SharedSessionError.storeFailure
        }
        return try await body(lease)
    }
}

final class ImmediateLock: CrossProcessSessionLock {
    func withLock<T>(
        _ body: @escaping @Sendable (CrossProcessLockLease) async throws -> T
    ) async throws -> T {
        try await body(CrossProcessLockLease())
    }
}

// MARK: - Endpoint config

struct SupabaseEndpointConfig: Sendable {
    let supabaseUrl: String
    let anonKey: String
}

// MARK: - Transport

final class WidgetSupabaseTransport: @unchecked Sendable {
    private struct PendingRedeemedPair {
        let id: UUID
        let envelope: SharedSessionEnvelopeV1
        let expectedRevision: Int
        let lineage: String
    }

    private enum PendingRecoveryOutcome {
        case recovered(String)
        case discarded
    }

    private let vault: SharedSessionVaulting
    private let lock: CrossProcessSessionLock
    private let refreshClient: SupabaseRefreshClient
    private let httpClient: SupabaseHTTPClient
    private let config: SupabaseEndpointConfig
    private let logger: SharedSessionLogger
    private let legacyAccessTokenProvider: @Sendable () -> String?
    private let pendingMutex = NSLock()
    private var pendingRedeemedPairs: [PendingRedeemedPair] = []

    init(
        vault: SharedSessionVaulting,
        lock: CrossProcessSessionLock,
        refreshClient: SupabaseRefreshClient,
        httpClient: SupabaseHTTPClient,
        config: SupabaseEndpointConfig,
        logger: SharedSessionLogger,
        legacyAccessTokenProvider: @escaping @Sendable () -> String? = { nil }
    ) {
        self.vault = vault
        self.lock = lock
        self.refreshClient = refreshClient
        self.httpClient = httpClient
        self.config = config
        self.logger = logger
        self.legacyAccessTokenProvider = legacyAccessTokenProvider
    }

    /// Send an authenticated Supabase request. `buildRequest` receives the
    /// current access token and returns a fully-built request including the
    /// `Authorization` and `apikey` headers. On a 401 the transport acquires
    /// the shared lock, re-reads the session, redeems the current refresh
    /// token only if nothing has rotated it first, persists the renewed pair,
    /// and retries the original request exactly once.
    ///
    /// Best-effort backwards-compatibility bridge: before the updated app first
    /// launches and writes the shared Keychain capsule, the widget can use the
    /// legacy App Group `supabaseAccessToken` for its remaining lifetime. That
    /// bearer is refresh-less, so an expired legacy token cannot bridge an
    /// overnight update; one updated-app launch is required to migrate the full
    /// session. Once the capsule exists, the legacy path is never taken.
    func send(buildRequest: @escaping @Sendable (String) -> URLRequest) async throws -> (Int, Data) {
        // A prior request may have redeemed a refresh token just as its
        // suspension assertion expired. Recover that exact successor before
        // reading or redeeming the stale capsule again.
        _ = try await recoverPendingRedeemedPairs()

        guard let current = try vault.read() else {
            if let legacyAccessToken = legacyAccessTokenProvider() {
                // Legacy App Group bearer token; no refresh token available.
                // Use directly; a 401 here is surfaced to the caller (no retry).
                let (status, body) = try await httpClient.send(buildRequest(legacyAccessToken))
                return (status, body)
            }
            logger.log(SharedSessionLogEvent(kind: .missingSession))
            throw SharedSessionError.missingSession
        }
        let session = try ensureValidSession(current)
        let (status, body) = try await httpClient.send(buildRequest(session.accessToken))
        if status != 401 {
            return (status, body)
        }

        let renewedToken = try await lock.withLock { lease in
            let reread = try self.vault.read()
            guard let reread else {
                self.logger.log(SharedSessionLogEvent(kind: .missingSession))
                throw SharedSessionError.missingSession
            }
            if reread.revision != current.revision {
                // Another holder already rotated the pair. Adopt its access
                // token without redeeming again.
                let winner = try ensureValidSession(reread)
                return winner.accessToken
            }
            let redeemer = try ensureValidSession(reread)
            let refreshed = try await self.redeem(
                refreshToken: redeemer.refreshToken,
                expectedRevision: reread.revision,
                lineage: reread.lineage,
                lease: lease
            )
            return refreshed
        }

        let (retryStatus, retryBody) = try await httpClient.send(buildRequest(renewedToken))
        if retryStatus == 401 {
            logger.log(SharedSessionLogEvent(kind: .retryUnauthorized))
        }
        return (retryStatus, retryBody)
    }

    private func redeem(
        refreshToken: String,
        expectedRevision: Int,
        lineage: String,
        lease: CrossProcessLockLease
    ) async throws -> String {
        do {
            let responseBody = try await refreshClient.refresh(refreshToken: refreshToken, config: config)
            let built = try RefreshedSessionBuilder.build(fromResponseBody: responseBody)
            guard built.lineage == lineage else {
                logger.log(SharedSessionLogEvent(kind: .refreshRejected))
                throw SharedSessionError.identityMismatch
            }
            let next = SharedSessionEnvelopeV1(
                version: 1,
                revision: expectedRevision + 1,
                lineage: lineage,
                session: built.sessionJson
            )
            // The lock may have been force-released while the redemption was on
            // the network (imminent suspension). Persisting without the lock
            // would race another holder's rotation, so abandon the write; the
            // next caller re-reads and recovers under a healthy lock.
            return try await persistRedeemedPair(
                next,
                expectedRevision: expectedRevision,
                lineage: lineage,
                lease: lease
            )
        } catch SharedSessionError.lockRevoked {
            logger.log(SharedSessionLogEvent(kind: .lockRevoked))
            throw SharedSessionError.lockRevoked
        } catch let error as SharedSessionError {
            logger.log(SharedSessionLogEvent(kind: .refreshRejected))
            throw error
        } catch {
            logger.log(SharedSessionLogEvent(kind: .refreshRejected))
            throw SharedSessionError.refreshRejected
        }
    }

    private func persistRedeemedPair(
        _ next: SharedSessionEnvelopeV1,
        expectedRevision: Int,
        lineage: String,
        lease: CrossProcessLockLease
    ) async throws -> String {
        do {
            _ = try lease.withHeldLock {
                try vault.replace(expectedRevision: expectedRevision, next)
            }
            return try ensureValidSession(next).accessToken
        } catch SharedSessionError.lockRevoked {
            // The network already redeemed the old refresh token. Reacquire
            // and persist that exact response; never replay the spent token.
            // Keep it queued until recovery succeeds, because the fresh
            // assertion can itself expire while the extension is suspending.
            enqueuePendingRedeemedPair(
                next,
                expectedRevision: expectedRevision,
                lineage: lineage
            )
            if let recovered = try await recoverPendingRedeemedPairs() {
                return recovered
            }
            guard let current = try vault.read(),
                  current.revision > expectedRevision,
                  current.lineage == lineage else {
                throw SharedSessionError.sessionChanged
            }
            return try ensureValidSession(current).accessToken
        }
    }

    private func enqueuePendingRedeemedPair(
        _ envelope: SharedSessionEnvelopeV1,
        expectedRevision: Int,
        lineage: String
    ) {
        pendingMutex.lock()
        pendingRedeemedPairs.append(
            PendingRedeemedPair(
                id: UUID(),
                envelope: envelope,
                expectedRevision: expectedRevision,
                lineage: lineage
            )
        )
        pendingMutex.unlock()
    }

    private func firstPendingRedeemedPair() -> PendingRedeemedPair? {
        pendingMutex.lock()
        defer { pendingMutex.unlock() }
        return pendingRedeemedPairs.first
    }

    private func removePendingRedeemedPair(id: UUID) {
        pendingMutex.lock()
        pendingRedeemedPairs.removeAll { $0.id == id }
        pendingMutex.unlock()
    }

    /// Drains in redemption order under one healthy lock per successor. A
    /// failed acquire or second revocation leaves the current item untouched
    /// so a later transport call can recover it before using the stale vault.
    private func recoverPendingRedeemedPairs() async throws -> String? {
        var recoveredAccessToken: String?
        while let pending = firstPendingRedeemedPair() {
            let outcome = try await lock.withLock { recoveryLease in
                guard let current = try self.vault.read() else {
                    return PendingRecoveryOutcome.discarded
                }
                if current.revision == pending.expectedRevision,
                   current.lineage == pending.lineage {
                    _ = try recoveryLease.withHeldLock {
                        try self.vault.replace(
                            expectedRevision: pending.expectedRevision,
                            pending.envelope
                        )
                    }
                    return PendingRecoveryOutcome.recovered(
                        try ensureValidSession(pending.envelope).accessToken
                    )
                }
                guard current.revision > pending.expectedRevision,
                      current.lineage == pending.lineage else {
                    return PendingRecoveryOutcome.discarded
                }
                return PendingRecoveryOutcome.recovered(
                    try ensureValidSession(current).accessToken
                )
            }
            removePendingRedeemedPair(id: pending.id)
            if case let .recovered(accessToken) = outcome {
                recoveredAccessToken = accessToken
            }
        }
        return recoveredAccessToken
    }
}
