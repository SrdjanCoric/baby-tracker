import Foundation
import Security
import React

/// Native bridge that backs the shared Supabase session capsule on iOS.
///
/// The full Supabase `Session` JSON lives in one Keychain generic-password item
/// shared with the iOS Widget through a Keychain access group, so neither the
/// app nor the Widget keeps a bearer token in App Group `UserDefaults`. Every
/// read/write/redeem is serialized through an advisory POSIX `flock` on a
/// permanent lock file inside the App Group container, which is the only
/// cross-process primitive Apple recommends for app/extension coordination. The
/// Keychain item is `AfterFirstUnlockThisDeviceOnly` and never synchronised to
/// iCloud; holding the file lock across the awaited Redeme/retry body keeps two
/// holders from redeeming the same (rotating) refresh token at once.
@objc(SharedSupabaseSession)
class SharedSupabaseSession: NSObject {

    private static let appGroup = "group.com.sofibaby.app"
    private static let keychainService = "com.sofibaby.supabase.session"
    private static let keychainAccount = "shared"
    private static let keychainAccessGroup = "743WPPWD3W.com.sofibaby.shared-session"
    private static let lockFileName = "shared-supabase-session.lock"
    private static let lockAcquireTimeoutMs = 10000

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Keychain capsule

    private func keychainQuery() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: SharedSupabaseSession.keychainService,
            kSecAttrAccount as String: SharedSupabaseSession.keychainAccount,
            kSecAttrAccessGroup as String: SharedSupabaseSession.keychainAccessGroup,
        ]
    }

    @objc func readSession(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        var query = keychainQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            resolve(nil)
            return
        }
        if status != errSecSuccess {
            reject("KEYCHAIN_READ", "Keychain read failed: \(status)", nil)
            return
        }
        guard let data = result as? Data,
              let envelope = String(data: data, encoding: .utf8) else {
            reject("KEYCHAIN_DECODE", "Keychain item was not valid UTF-8", nil)
            return
        }
        resolve(envelope)
    }

    @objc func writeSession(
        _ envelopeJson: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let data = envelopeJson.data(using: .utf8) else {
            reject("KEYCHAIN_ENCODE", "Envelope was not valid UTF-8", nil)
            return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let query = keychainQuery()
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            resolve(true)
            return
        }
        if updateStatus == errSecItemNotFound {
            var addQuery = keychainQuery()
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            if addStatus != errSecSuccess {
                reject("KEYCHAIN_WRITE", "Keychain add failed: \(addStatus)", nil)
                return
            }
            resolve(true)
            return
        }
        reject("KEYCHAIN_WRITE", "Keychain update failed: \(updateStatus)", nil)
    }

    @objc func removeSession(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let status = SecItemDelete(keychainQuery() as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound {
            resolve(true)
            return
        }
        reject("KEYCHAIN_DELETE", "Keychain delete failed: \(status)", nil)
    }

    // MARK: - Cross-process lock

    private static var lockDescriptors: [String: Int32] = [:]
    private static let descriptorLock = NSLock()

    @objc func acquireSessionLock(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SharedSupabaseSession.appGroup
        ) else {
            reject("APP_GROUP", "App Group container unavailable", nil)
            return
        }
        let lockURL = containerURL.appendingPathComponent(SharedSupabaseSession.lockFileName)
        let fd = open(lockURL.path, O_CREAT | O_RDWR, 0o600)
        guard fd >= 0 else {
            reject("LOCK_OPEN", "Lock file open failed: errno=\(errno)", nil)
            return
        }

        let deadline = Date().addingTimeInterval(
            Double(SharedSupabaseSession.lockAcquireTimeoutMs) / 1000.0
        )
        var acquired = false
        while Date() < deadline {
            if flock(fd, LOCK_EX | LOCK_NB) == 0 {
                acquired = true
                break
            }
            Thread.sleep(forTimeInterval: 0.02)
        }
        guard acquired else {
            close(fd)
            reject("LOCK_TIMEOUT", "Timed out acquiring the shared session lock", nil)
            return
        }

        let handle = UUID().uuidString
        SharedSupabaseSession.descriptorLock.lock()
        SharedSupabaseSession.lockDescriptors[handle] = fd
        SharedSupabaseSession.descriptorLock.unlock()
        resolve(handle)
    }

    @objc func releaseSessionLock(
        _ handle: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        SharedSupabaseSession.descriptorLock.lock()
        let fd = SharedSupabaseSession.lockDescriptors.removeValue(forKey: handle)
        SharedSupabaseSession.descriptorLock.unlock()
        guard let fd else {
            reject("LOCK_HANDLE", "Unknown lock handle: \(handle)", nil)
            return
        }
        flock(fd, LOCK_UN)
        close(fd)
        resolve(true)
    }
}