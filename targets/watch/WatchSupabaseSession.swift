import Foundation

enum WatchSessionError: Error, Equatable {
    case missingSession
    case malformedSession
    case unsupportedSchema
    case identityMismatch
    case storeFailure
}

struct WatchSessionEnvelopeV1: Codable, Equatable {
    let version: Int
    let revision: Int
    let lineage: String
    let session: String

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
        let values = try decoder.container(keyedBy: CodingKeys.self)
        version = try values.decode(Int.self, forKey: .version)
        guard version == 1 else { throw WatchSessionError.unsupportedSchema }
        revision = try values.decode(Int.self, forKey: .revision)
        lineage = try values.decode(String.self, forKey: .lineage)
        session = try values.decode(String.self, forKey: .session)
    }
}

protocol WatchSessionStore: Sendable {
    func readRaw() throws -> Data?
    func writeRaw(_ data: Data) throws
    func deleteRaw() throws
}

final class WatchSessionVault: @unchecked Sendable {
    private let store: WatchSessionStore
    private let lock = NSLock()

    init(store: WatchSessionStore) {
        self.store = store
    }

    func read() throws -> WatchSessionEnvelopeV1? {
        try withLock {
            guard let data = try store.readRaw() else { return nil }
            return try Self.decode(data)
        }
    }

    func install(capsuleJson: String) throws {
        guard let data = capsuleJson.data(using: .utf8) else {
            throw WatchSessionError.malformedSession
        }
        let capsule = try Self.decode(data)
        let session = try WatchSessionView.read(capsule)
        guard session.lineage == capsule.lineage else {
            throw WatchSessionError.identityMismatch
        }
        try withLock {
            if let storedData = try store.readRaw() {
                let stored = try Self.decode(storedData)
                if stored.lineage == capsule.lineage,
                   stored.revision >= capsule.revision {
                    return
                }
            }
            try store.writeRaw(try JSONEncoder().encode(capsule))
        }
    }

    func replace(_ envelope: WatchSessionEnvelopeV1) throws {
        try store.writeRaw(try JSONEncoder().encode(envelope))
    }

    func remove() throws {
        try withLock {
            try store.deleteRaw()
        }
    }

    private func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }

    private static func decode(_ data: Data) throws -> WatchSessionEnvelopeV1 {
        do {
            return try JSONDecoder().decode(WatchSessionEnvelopeV1.self, from: data)
        } catch WatchSessionError.unsupportedSchema {
            throw WatchSessionError.unsupportedSchema
        } catch {
            throw WatchSessionError.malformedSession
        }
    }
}

struct WatchSessionView {
    let accessToken: String
    let refreshToken: String
    let lineage: String

    static func read(_ envelope: WatchSessionEnvelopeV1) throws -> WatchSessionView {
        guard let data = envelope.session.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = object["access_token"] as? String,
              let refreshToken = object["refresh_token"] as? String,
              !accessToken.isEmpty,
              !refreshToken.isEmpty else {
            throw WatchSessionError.malformedSession
        }
        guard let lineage = WatchSessionLineage.extract(fromAccessToken: accessToken) else {
            throw WatchSessionError.identityMismatch
        }
        return WatchSessionView(
            accessToken: accessToken,
            refreshToken: refreshToken,
            lineage: lineage
        )
    }
}

enum WatchSessionLineage {
    static func extract(fromAccessToken token: String) -> String? {
        let segments = token.split(separator: ".", omittingEmptySubsequences: true)
        guard segments.count >= 2 else { return nil }
        var payload = String(segments[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 { payload.append("=") }
        guard let data = Data(base64Encoded: payload),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return object["session_id"] as? String
    }
}

enum WatchSessionLogKind: Equatable {
    case missingSession
}

struct WatchSessionLogEvent: Equatable {
    let kind: WatchSessionLogKind
}

protocol WatchSessionLogger: Sendable {
    func log(_ event: WatchSessionLogEvent)
}

protocol WatchSupabaseHTTPClient: Sendable {
    func send(_ request: URLRequest) async throws -> (Int, Data)
}

struct WatchSupabaseEndpointConfig: Sendable {
    let supabaseUrl: String
    let anonKey: String
}

final class WatchSupabaseTransport: @unchecked Sendable {
    private let vault: WatchSessionVault
    private let httpClient: WatchSupabaseHTTPClient
    private let logger: WatchSessionLogger

    init(
        vault: WatchSessionVault,
        httpClient: WatchSupabaseHTTPClient,
        logger: WatchSessionLogger
    ) {
        self.vault = vault
        self.httpClient = httpClient
        self.logger = logger
    }

    func send(
        config: WatchSupabaseEndpointConfig,
        buildRequest: @escaping @Sendable (String) -> URLRequest
    ) async throws -> (Int, Data) {
        guard let capsule = try vault.read() else {
            logger.log(WatchSessionLogEvent(kind: .missingSession))
            throw WatchSessionError.missingSession
        }
        let session = try WatchSessionView.read(capsule)
        return try await httpClient.send(buildRequest(session.accessToken))
    }
}
