import Foundation
import Security

final class WatchKeychainSessionStore: WatchSessionStore, @unchecked Sendable {
    private let service: String
    private let account: String

    init(
        service: String = "com.sofibaby.watch.supabase.session",
        account: String = "current"
    ) {
        self.service = service
        self.account = account
    }

    private func query() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    func readRaw() throws -> Data? {
        var lookup = query()
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else {
            NSLog("[WatchSupabaseSession] Keychain read failed: \(status)")
            throw WatchSessionError.storeFailure
        }
        return result as? Data
    }

    func writeRaw(_ data: Data) throws {
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let updateStatus = SecItemUpdate(query() as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess { return }
        if updateStatus == errSecItemNotFound {
            var addition = query()
            addition[kSecValueData as String] = data
            addition[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(addition as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                NSLog("[WatchSupabaseSession] Keychain add failed: \(addStatus)")
                throw WatchSessionError.storeFailure
            }
            return
        }
        NSLog("[WatchSupabaseSession] Keychain update failed: \(updateStatus)")
        throw WatchSessionError.storeFailure
    }

    func deleteRaw() throws {
        let status = SecItemDelete(query() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            NSLog("[WatchSupabaseSession] Keychain delete failed: \(status)")
            throw WatchSessionError.storeFailure
        }
    }
}

final class WatchURLSessionHTTPClient: WatchSupabaseHTTPClient, @unchecked Sendable {
    func send(_ request: URLRequest) async throws -> (Int, Data) {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { return (0, data) }
        return (http.statusCode, data)
    }
}

final class WatchNSLogSessionLogger: WatchSessionLogger, @unchecked Sendable {
    func log(_ event: WatchSessionLogEvent) {
        switch event.kind {
        case .missingSession:
            NSLog("[WatchSupabaseSession] no local session capsule")
        case .invalidSession:
            NSLog("[WatchSupabaseSession] local session capsule is unavailable or invalid")
        }
    }
}

enum WatchSupabaseSessionEnvironment {
    static let vault = WatchSessionVault(store: WatchKeychainSessionStore())
    static let transport = WatchSupabaseTransport(
        vault: vault,
        httpClient: WatchURLSessionHTTPClient(),
        logger: WatchNSLogSessionLogger()
    )

    static var hasSession: Bool {
        (try? vault.read()) != nil
    }
}
