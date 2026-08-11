import Foundation
import Security

// Production adapters for `SharedSupabaseSession.swift`. This file is compiled
// only by the iOS Widget target (it links Security and rides URLSession); the
// Foundation-only test harness compiles `SharedSupabaseSession.swift` with
// injected fakes instead.

// MARK: - Keychain store

final class KeychainSharedSessionStore: SharedSessionStore, @unchecked Sendable {
    private let service: String
    private let account: String
    private let accessGroup: String

    init(
        service: String = "com.sofibaby.supabase.session",
        account: String = "shared",
        accessGroup: String = "743WPPWD3W.com.sofibaby.shared-session"
    ) {
        self.service = service
        self.account = account
        self.accessGroup = accessGroup
    }

    private func query() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }

    func readRaw() throws -> Data? {
        var query = query()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        if status != errSecSuccess {
            NSLog("[SharedSupabaseSession] keychain read failed: \(status)")
            throw SharedSessionError.storeFailure
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
            var addQuery = query()
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            if addStatus != errSecSuccess {
                NSLog("[SharedSupabaseSession] keychain add failed: \(addStatus)")
                throw SharedSessionError.storeFailure
            }
            return
        }
        NSLog("[SharedSupabaseSession] keychain update failed: \(updateStatus)")
        throw SharedSessionError.storeFailure
    }

    func deleteRaw() throws {
        let status = SecItemDelete(query() as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound { return }
        NSLog("[SharedSupabaseSession] keychain delete failed: \(status)")
        throw SharedSessionError.storeFailure
    }
}

// MARK: - POSIX cross-process lock

final class PosixSharedSessionLock: CrossProcessSessionLock, @unchecked Sendable {
    private let appGroup: String
    private let fileName: String
    private let acquireTimeoutMs: Int

    init(
        appGroup: String = "group.com.sofibaby.app",
        fileName: String = "shared-supabase-session.lock",
        acquireTimeoutMs: Int = 10000
    ) {
        self.appGroup = appGroup
        self.fileName = fileName
        self.acquireTimeoutMs = acquireTimeoutMs
    }

    func withLock<T>(_ body: @escaping @Sendable () async throws -> T) async throws -> T {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroup
        ) else {
            throw SharedSessionError.storeFailure
        }
        let lockURL = containerURL.appendingPathComponent(fileName)
        let fd = open(lockURL.path, O_CREAT | O_RDWR, 0o600)
        guard fd >= 0 else {
            NSLog("[SharedSupabaseSession] lock open failed: errno=\(errno)")
            throw SharedSessionError.storeFailure
        }

        let deadline = Date().addingTimeInterval(Double(acquireTimeoutMs) / 1000.0)
        var acquired = false
        while Date() < deadline {
            if flock(fd, LOCK_EX | LOCK_NB) == 0 {
                acquired = true
                break
            }
            try await Task.sleep(nanoseconds: 20_000_000)
        }
        guard acquired else {
            close(fd)
            NSLog("[SharedSupabaseSession] lock timeout")
            throw SharedSessionError.storeFailure
        }

        do {
            let result = try await body()
            flock(fd, LOCK_UN)
            close(fd)
            return result
        } catch {
            flock(fd, LOCK_UN)
            close(fd)
            throw error
        }
    }
}

// MARK: - HTTP client

final class URLSessionSupabaseHTTPClient: SupabaseHTTPClient, @unchecked Sendable {
    func send(_ request: URLRequest) async throws -> (Int, Data) {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            return (0, data)
        }
        return (http.statusCode, data)
    }
}

// MARK: - Refresh client

final class URLSessionSupabaseRefreshClient: SupabaseRefreshClient, @unchecked Sendable {
    func refresh(refreshToken: String, config: SupabaseEndpointConfig) async throws -> String {
        guard let url = URL(string: "\(config.supabaseUrl)/auth/v1/token?grant_type=refresh_token") else {
            throw SharedSessionError.storeFailure
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.timeoutInterval = 10
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SharedSessionError.refreshRejected
        }
        guard (200..<300).contains(http.statusCode) else {
            throw SharedSessionError.refreshRejected
        }
        guard let body = String(data: data, encoding: .utf8) else {
            throw SharedSessionError.refreshRejected
        }
        return body
    }
}

// MARK: - Logger

final class NSLogSessionLogger: SharedSessionLogger, @unchecked Sendable {
    func log(_ event: SharedSessionLogEvent) {
        switch event.kind {
        case .missingSession:
            NSLog("[SharedSupabaseSession] no session present while refreshing")
        case .refreshRejected:
            NSLog("[SharedSupabaseSession] refresh rejected; preserving prior cache")
        case .retryUnauthorized:
            NSLog("[SharedSupabaseSession] retry after renewal still returned 401")
        }
    }
}