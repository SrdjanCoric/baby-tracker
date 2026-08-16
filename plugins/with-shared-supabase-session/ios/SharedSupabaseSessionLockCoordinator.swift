import Foundation

/// UIKit-free state machine for the app process' asserted POSIX lock handles.
/// Production supplies the descriptor operations; the Swift harness supplies
/// deterministic fakes and exercises expiration/acquire ordering directly.
final class AppSharedSessionLockCoordinator: @unchecked Sendable {
    enum AcquireAttempt: Equatable {
        case acquired
        case busy
        case revoked
        case missing
    }

    enum ReleaseResult: Equatable {
        case released
        case revoked
        case missing
    }

    enum HeldAccessResult: Equatable {
        case performed
        case revoked
        case missing
    }

    private struct Entry {
        var descriptor: Int32?
        var endAssertion: (() -> Void)?
        var acquired = false
        var issued = false
        var revoked = false
    }

    private let mutex = NSLock()
    private var entries: [String: Entry] = [:]
    private let tryDescriptorAcquire: (Int32) -> Bool
    private let releaseDescriptor: (Int32) -> Void

    init(
        tryDescriptorAcquire: @escaping (Int32) -> Bool,
        releaseDescriptor: @escaping (Int32) -> Void
    ) {
        self.tryDescriptorAcquire = tryDescriptorAcquire
        self.releaseDescriptor = releaseDescriptor
    }

    func prepare(handle: String) {
        mutex.lock()
        entries[handle] = Entry()
        mutex.unlock()
    }

    /// Returns false when expiration won before the assertion identifier was
    /// available. The supplied end closure is still invoked exactly once.
    func attachAssertion(handle: String, end: @escaping () -> Void) -> Bool {
        mutex.lock()
        guard var entry = entries[handle] else {
            mutex.unlock()
            end()
            return false
        }
        guard !entry.revoked else {
            mutex.unlock()
            end()
            return false
        }
        entry.endAssertion = end
        entries[handle] = entry
        mutex.unlock()
        return true
    }

    /// Returns false and closes the descriptor when expiration already won.
    func attachDescriptor(handle: String, descriptor: Int32) -> Bool {
        mutex.lock()
        guard var entry = entries[handle], !entry.revoked else {
            mutex.unlock()
            releaseDescriptor(descriptor)
            return false
        }
        entry.descriptor = descriptor
        entries[handle] = entry
        mutex.unlock()
        return true
    }

    func tryAcquire(handle: String) -> AcquireAttempt {
        mutex.lock()
        defer { mutex.unlock() }
        guard var entry = entries[handle] else { return .missing }
        guard !entry.revoked else { return .revoked }
        guard let descriptor = entry.descriptor else { return .missing }
        guard tryDescriptorAcquire(descriptor) else { return .busy }
        entry.acquired = true
        entries[handle] = entry
        return .acquired
    }

    func issue(handle: String) -> Bool {
        mutex.lock()
        defer { mutex.unlock() }
        guard var entry = entries[handle], entry.acquired, !entry.revoked else {
            return false
        }
        entry.issued = true
        entries[handle] = entry
        return true
    }

    /// Revokes only a registered handle. Late expiration callbacks after a
    /// timeout or release are harmless and cannot create orphan tombstones.
    @discardableResult
    func forceRelease(handle: String) -> Bool {
        mutex.lock()
        guard var entry = entries[handle] else {
            mutex.unlock()
            return false
        }
        guard !entry.revoked else {
            mutex.unlock()
            return false
        }
        entry.revoked = true
        let descriptor = entry.descriptor
        let endAssertion = entry.endAssertion
        entry.descriptor = nil
        entry.endAssertion = nil
        entries[handle] = entry
        mutex.unlock()

        if let descriptor { releaseDescriptor(descriptor) }
        endAssertion?()
        return true
    }

    /// Removes an acquire that never issued a handle, releasing any resources
    /// that expiration did not already consume.
    func abandon(handle: String) {
        mutex.lock()
        let entry = entries.removeValue(forKey: handle)
        mutex.unlock()
        if let descriptor = entry?.descriptor { releaseDescriptor(descriptor) }
        entry?.endAssertion?()
    }

    func release(handle: String) -> ReleaseResult {
        mutex.lock()
        let entry = entries.removeValue(forKey: handle)
        mutex.unlock()
        guard let entry else { return .missing }
        if let descriptor = entry.descriptor { releaseDescriptor(descriptor) }
        entry.endAssertion?()
        return entry.revoked ? .revoked : .released
    }

    /// Runs one synchronous capsule mutation while the exact issued handle is
    /// still held. Expiration blocks on this mutex until the mutation returns.
    func withHeldHandle(handle: String, _ body: () -> Void) -> HeldAccessResult {
        mutex.lock()
        defer { mutex.unlock() }
        guard let entry = entries[handle] else { return .missing }
        guard entry.issued, !entry.revoked, entry.descriptor != nil else {
            return .revoked
        }
        body()
        return .performed
    }

    func invalidate() {
        mutex.lock()
        let snapshot = entries.values
        entries.removeAll()
        mutex.unlock()
        for entry in snapshot {
            if let descriptor = entry.descriptor { releaseDescriptor(descriptor) }
            entry.endAssertion?()
        }
    }
}
