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

    private func envelopeRevision(_ data: Data) -> Int? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let revision = object["revision"] as? Int else {
            return nil
        }
        return revision
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
        expectedRevision: NSNumber?,
        handle: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        // The app writes the capsule only while holding the cross-process lock
        // (see createSharedSupabaseClientOptions). If the lock was force-
        // released while this auth transaction was frozen in the background,
        // persisting now would race a rotation the widget performed in the
        // meantime, so the write is abandoned; auth-js retries under a fresh
        // lock and re-reads the current capsule.
        guard let data = envelopeJson.data(using: .utf8) else {
            reject("KEYCHAIN_ENCODE", "Envelope was not valid UTF-8", nil)
            return
        }
        let expected = expectedRevision?.intValue
        let incomingRevision = envelopeRevision(data)
        var failure: (code: String, message: String)?
        let access = SharedSupabaseSession.lockCoordinator.withHeldHandle(handle: handle) {
            let requiredIncomingRevision = (expected ?? 0) + 1
            guard incomingRevision == requiredIncomingRevision else {
                failure = (
                    "SESSION_CHANGED",
                    "Incoming revision did not follow the expected capsule revision"
                )
                return
            }

            var readQuery = self.keychainQuery()
            readQuery[kSecReturnData as String] = true
            readQuery[kSecMatchLimit as String] = kSecMatchLimitOne
            var currentResult: CFTypeRef?
            let readStatus = SecItemCopyMatching(
                readQuery as CFDictionary,
                &currentResult
            )
            if let expected {
                guard readStatus == errSecSuccess,
                      let currentData = currentResult as? Data,
                      self.envelopeRevision(currentData) == expected else {
                    failure = (
                        "SESSION_CHANGED",
                        "The shared session changed before this write"
                    )
                    return
                }
            } else {
                guard readStatus == errSecItemNotFound else {
                    failure = readStatus == errSecSuccess
                        ? ("SESSION_CHANGED", "A shared session was installed concurrently")
                        : ("KEYCHAIN_READ", "Keychain read failed: \(readStatus)")
                    return
                }
            }

            let attributes: [String: Any] = [
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            ]
            if expected == nil {
                var addQuery = self.keychainQuery()
                addQuery[kSecValueData as String] = data
                addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
                if addStatus != errSecSuccess {
                    failure = addStatus == errSecDuplicateItem
                        ? ("SESSION_CHANGED", "A shared session was installed concurrently")
                        : ("KEYCHAIN_WRITE", "Keychain add failed: \(addStatus)")
                }
            } else {
                let updateStatus = SecItemUpdate(
                    self.keychainQuery() as CFDictionary,
                    attributes as CFDictionary
                )
                if updateStatus != errSecSuccess {
                    failure = updateStatus == errSecItemNotFound
                        ? ("SESSION_CHANGED", "The shared session disappeared before this write")
                        : ("KEYCHAIN_WRITE", "Keychain update failed: \(updateStatus)")
                }
            }
        }
        switch access {
        case .performed:
            if let failure {
                reject(failure.code, failure.message, nil)
            } else {
                resolve(true)
            }
        case .revoked:
            reject(
                "LOCK_REVOKED",
                "The shared session lock was force-released; abandoning this write",
                nil
            )
        case .missing:
            reject("LOCK_HANDLE", "Unknown lock handle: \(handle)", nil)
        }
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

    private static let lockCoordinator = AppSharedSessionLockCoordinator(
        tryDescriptorAcquire: { descriptor in
            flock(descriptor, LOCK_EX | LOCK_NB) == 0
        },
        releaseDescriptor: { descriptor in
            flock(descriptor, LOCK_UN)
            close(descriptor)
        }
    )

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

        // Assert background runtime for the whole lock-held window, including
        // the acquire wait. If iOS decides to suspend the app anyway, the
        // expiration handler drops the flock first so suspension never
        // freezes a held App Group lock (0xDEAD10CC).
        let handle = UUID().uuidString
        SharedSupabaseSession.lockCoordinator.prepare(handle: handle)
        let backgroundTask = UIApplication.shared.beginBackgroundTask(
            withName: "SharedSupabaseSessionLock"
        ) {
            SharedSupabaseSession.lockCoordinator.forceRelease(handle: handle)
        }
        func abandon(_ code: String, _ message: String) {
            SharedSupabaseSession.lockCoordinator.abandon(handle: handle)
            reject(code, message, nil)
        }

        guard backgroundTask != .invalid else {
            abandon(
                "LOCK_NO_ASSERTION",
                "A background assertion is required before acquiring the shared session lock"
            )
            return
        }
        guard SharedSupabaseSession.lockCoordinator.attachAssertion(
            handle: handle,
            end: { UIApplication.shared.endBackgroundTask(backgroundTask) }
        ) else {
            abandon("LOCK_REVOKED", "The suspension assertion expired before lock acquisition")
            return
        }

        let fd = open(lockURL.path, O_CREAT | O_RDWR, 0o600)
        guard fd >= 0 else {
            abandon("LOCK_OPEN", "Lock file open failed: errno=\(errno)")
            return
        }
        guard SharedSupabaseSession.lockCoordinator.attachDescriptor(
            handle: handle,
            descriptor: fd
        ) else {
            abandon("LOCK_REVOKED", "The suspension assertion expired before lock acquisition")
            return
        }

        let deadline = Date().addingTimeInterval(
            Double(SharedSupabaseSession.lockAcquireTimeoutMs) / 1000.0
        )
        var acquired = false
        while Date() < deadline {
            switch SharedSupabaseSession.lockCoordinator.tryAcquire(handle: handle) {
            case .acquired:
                acquired = true
            case .busy:
                Thread.sleep(forTimeInterval: 0.02)
            case .revoked:
                abandon("LOCK_REVOKED", "The suspension assertion expired while acquiring the lock")
                return
            case .missing:
                abandon("LOCK_HANDLE", "Lock acquisition state disappeared")
                return
            }
            if acquired { break }
        }
        guard acquired else {
            abandon("LOCK_TIMEOUT", "Timed out acquiring the shared session lock")
            return
        }
        guard SharedSupabaseSession.lockCoordinator.issue(handle: handle) else {
            abandon("LOCK_REVOKED", "The suspension assertion expired while acquiring the lock")
            return
        }
        resolve(handle)
    }

    @objc func releaseSessionLock(
        _ handle: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        switch SharedSupabaseSession.lockCoordinator.release(handle: handle) {
        case .released, .revoked:
            resolve(true)
        case .missing:
            reject("LOCK_HANDLE", "Unknown lock handle: \(handle)", nil)
        }
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
        SharedSupabaseSession.lockCoordinator.invalidate()
    }
}
