import Foundation
import Security
import React
import UIKit

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
        // The app writes the capsule only while holding the cross-process lock
        // (see createSharedSupabaseClientOptions). If the lock was force-
        // released while this auth transaction was frozen in the background,
        // persisting now would race a rotation the widget performed in the
        // meantime, so the write is abandoned; auth-js retries under a fresh
        // lock and re-reads the current capsule.
        if SharedSupabaseSession.hasForceReleasedLock() {
            reject(
                "LOCK_REVOKED",
                "The shared session lock was force-released; abandoning this write",
                nil
            )
            return
        }
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

    private struct HeldLock {
        let fd: Int32
        let backgroundTask: UIBackgroundTaskIdentifier
    }

    private static var heldLocks: [String: HeldLock] = [:]
    /// Handles whose flock was force-released (assertion expiry or background
    /// with no assertion). The JS `finally` release of such a handle is a
    /// no-op, and any capsule write while one is outstanding is abandoned.
    private static var revokedHandles: Set<String> = []
    private static let descriptorLock = NSLock()

    /// Installed once, on first acquire: a descriptor that reached the
    /// background without an active assertion (`beginBackgroundTask` returned
    /// `.invalid`) has nothing keeping the process running and must not be
    /// held into suspension (0xDEAD10CC).
    private static let backgroundObserverInstalled: Bool = {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: nil
        ) { _ in
            SharedSupabaseSession.forceReleaseLocksWithoutAssertion()
        }
        return true
    }()

    private static func hasForceReleasedLock() -> Bool {
        descriptorLock.lock()
        defer { descriptorLock.unlock() }
        return !revokedHandles.isEmpty
    }

    /// Force-release one handle's flock: the suspension assertion is expiring
    /// (or was never granted) and a suspended process must not hold the lock.
    private static func forceRelease(handle: String) {
        descriptorLock.lock()
        let held = heldLocks.removeValue(forKey: handle)
        revokedHandles.insert(handle)
        descriptorLock.unlock()
        guard let held else { return }
        flock(held.fd, LOCK_UN)
        close(held.fd)
        if held.backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(held.backgroundTask)
        }
    }

    private static func forceReleaseLocksWithoutAssertion() {
        descriptorLock.lock()
        let unprotected = heldLocks.filter { $0.value.backgroundTask == .invalid }
        descriptorLock.unlock()
        for handle in unprotected.keys {
            forceRelease(handle: handle)
        }
    }

    @objc func acquireSessionLock(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        _ = SharedSupabaseSession.backgroundObserverInstalled
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SharedSupabaseSession.appGroup
        ) else {
            reject("APP_GROUP", "App Group container unavailable", nil)
            return
        }
        let lockURL = containerURL.appendingPathComponent(SharedSupabaseSession.lockFileName)

        // Assert background runtime for the whole lock-held window, including
        // the acquire wait. If iOS decides to suspend the app anyway, the
        // expiration handler drops the flock first so suspension never
        // freezes a held App Group lock (0xDEAD10CC).
        let handle = UUID().uuidString
        let backgroundTask = UIApplication.shared.beginBackgroundTask(
            withName: "SharedSupabaseSessionLock"
        ) {
            SharedSupabaseSession.forceRelease(handle: handle)
        }
        func abandon(_ code: String, _ message: String) {
            if backgroundTask != .invalid {
                UIApplication.shared.endBackgroundTask(backgroundTask)
            }
            SharedSupabaseSession.descriptorLock.lock()
            SharedSupabaseSession.revokedHandles.remove(handle)
            SharedSupabaseSession.descriptorLock.unlock()
            reject(code, message, nil)
        }

        let fd = open(lockURL.path, O_CREAT | O_RDWR, 0o600)
        guard fd >= 0 else {
            abandon("LOCK_OPEN", "Lock file open failed: errno=\(errno)")
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
            abandon("LOCK_TIMEOUT", "Timed out acquiring the shared session lock")
            return
        }

        SharedSupabaseSession.descriptorLock.lock()
        // The assertion may have expired during the acquire wait; the handle
        // is already revoked and this flock must not survive.
        if SharedSupabaseSession.revokedHandles.contains(handle) {
            SharedSupabaseSession.descriptorLock.unlock()
            flock(fd, LOCK_UN)
            close(fd)
            abandon("LOCK_REVOKED", "The suspension assertion expired while acquiring the lock")
            return
        }
        SharedSupabaseSession.heldLocks[handle] = HeldLock(fd: fd, backgroundTask: backgroundTask)
        SharedSupabaseSession.descriptorLock.unlock()
        resolve(handle)
    }

    @objc func releaseSessionLock(
        _ handle: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        SharedSupabaseSession.descriptorLock.lock()
        if SharedSupabaseSession.revokedHandles.remove(handle) != nil {
            SharedSupabaseSession.descriptorLock.unlock()
            // Already force-released on assertion expiry; the JS `finally`
            // release is a harmless no-op.
            resolve(true)
            return
        }
        let held = SharedSupabaseSession.heldLocks.removeValue(forKey: handle)
        SharedSupabaseSession.descriptorLock.unlock()
        guard let held else {
            reject("LOCK_HANDLE", "Unknown lock handle: \(handle)", nil)
            return
        }
        flock(held.fd, LOCK_UN)
        close(held.fd)
        if held.backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(held.backgroundTask)
        }
        resolve(true)
    }

    // MARK: - Bridge teardown

    /// Closes every still-open lock handle when the React Native bridge is torn
    /// down (dev reload, JS error paths, app background eviction). The JS-side
    /// caller normally releases each handle in a `finally` block, but a
    /// `static var heldLocks` survives the bridge and an in-flight
    /// acquire whose `finally` never ran would otherwise leave its flock held
    /// for the life of the process — permanently breaking every later Supabase
    /// auth read/write until force-quit. Reclaiming on `invalidate()` keeps an
    /// orphaned JS context from poisoning the next one.
    @objc func invalidate() {
        SharedSupabaseSession.descriptorLock.lock()
        let handles = SharedSupabaseSession.heldLocks
        SharedSupabaseSession.heldLocks.removeAll()
        SharedSupabaseSession.revokedHandles.removeAll()
        SharedSupabaseSession.descriptorLock.unlock()
        for (_, held) in handles {
            flock(held.fd, LOCK_UN)
            close(held.fd)
            if held.backgroundTask != .invalid {
                UIApplication.shared.endBackgroundTask(held.backgroundTask)
            }
        }
    }
}
