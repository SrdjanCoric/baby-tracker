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
}

// MARK: - Logging

enum SharedSessionLogKind: Equatable {
    case missingSession
    case refreshRejected
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

/// Cross-process lock whose critical section may await. The production adapter
/// holds a POSIX `flock` across the awaited body and releases it on exit.
protocol CrossProcessSessionLock: Sendable {
    func withLock<T>(_ body: @escaping @Sendable () async throws -> T) async throws -> T
}

final class ImmediateLock: CrossProcessSessionLock {
    func withLock<T>(_ body: @escaping @Sendable () async throws -> T) async throws -> T {
        try await body()
    }
}

// MARK: - Endpoint config

struct SupabaseEndpointConfig: Sendable {
    let supabaseUrl: String
    let anonKey: String
}

// MARK: - Transport

final class WidgetSupabaseTransport: @unchecked Sendable {
    private let vault: SharedSessionVaulting
    private let lock: CrossProcessSessionLock
    private let refreshClient: SupabaseRefreshClient
    private let httpClient: SupabaseHTTPClient
    private let config: SupabaseEndpointConfig
    private let logger: SharedSessionLogger
    private let legacyAccessTokenProvider: @Sendable () -> String?

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
    /// Backwards-compatibility bridge: before the app wrote the shared Keychain
    /// capsule (e.g. on a freshly upgraded install that has not been launched
    /// yet), the widget falls back to the legacy App Group `supabaseAccessToken`
    /// bearer — a single-use, refresh-less request — for one release. Once the
    /// app launches and migrates its session into Keychain, the capsule is
    /// non-nil and the legacy path is never taken. Without this fallback an
    /// app update over an unopened device leaves the widget credential-less,
    /// reproducing the stale-widget symptom the task fixes (see TR-4).
    func send(buildRequest: @escaping @Sendable (String) -> URLRequest) async throws -> (Int, Data) {
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

        let renewedToken = try await lock.withLock {
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
                lineage: reread.lineage
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
        lineage: String
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
            _ = try vault.replace(expectedRevision: expectedRevision, next)
            return try ensureValidSession(next).accessToken
        } catch let error as SharedSessionError {
            logger.log(SharedSessionLogEvent(kind: .refreshRejected))
            throw error
        } catch {
            logger.log(SharedSessionLogEvent(kind: .refreshRejected))
            throw SharedSessionError.refreshRejected
        }
    }
}