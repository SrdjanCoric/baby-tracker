import Foundation

func requireWatch(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() {
        FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
        exit(1)
    }
}

func changedWatchFixture(_ data: Data, _ updates: [String: Any]) throws -> Data {
    var object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    for (key, value) in updates {
        object[key] = value
    }
    return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
}

func legacyMultiBabyFixture(_ data: Data, babyId: String) throws -> Data {
    let single = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    let timer = single["activeTimer"]!
    let baby: [String: Any] = [
        "id": babyId,
        "name": single["babyName"]!,
        "activities": single["activities"]!,
        "activeTimers": [timer]
    ]
    return try JSONSerialization.data(withJSONObject: [
        "babies": [baby],
        "selectedBabyId": babyId,
        "updatedAt": single["updatedAt"]!
    ], options: [.sortedKeys])
}

func versionedWatchFixture(
    _ data: Data,
    timer: [String: Any]?,
    serverAsOf: String
) throws -> Data {
    var object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    var activities = object["activities"] as! [String: Any]
    var sleep = activities["sleep"] as! [String: Any]
    sleep["isActive"] = timer?["type"] as? String == "sleep"
    activities["sleep"] = sleep
    object["activities"] = activities
    object["activeTimer"] = timer ?? NSNull()
    object["activeTimers"] = timer.map { [$0] } ?? []
    object["serverAsOf"] = serverAsOf
    object["updatedAt"] = serverAsOf
    return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
}

final class TestWatchSummaryStore: WatchSummaryStoring, @unchecked Sendable {
    var bytesByScope: [String: Data] = [:]
    var overlaysByScope: [String: [WatchOptimisticOverlay]] = [:]
    var writes = 0
    var failWrites = false

    func readSummary(for identity: WatchSummaryIdentity) -> Data? {
        bytesByScope[identity.cacheKey]
    }

    func writeSummary(_ bytes: Data, for identity: WatchSummaryIdentity) throws {
        if failWrites { throw TestWatchStoreFailure.writeFailed }
        writes += 1
        bytesByScope[identity.cacheKey] = bytes
    }

    func readOverlays(for identity: WatchSummaryIdentity) -> [WatchOptimisticOverlay] {
        overlaysByScope[identity.cacheKey] ?? []
    }

    func writeOverlays(_ overlays: [WatchOptimisticOverlay], for identity: WatchSummaryIdentity) throws {
        overlaysByScope[identity.cacheKey] = overlays
    }
}

enum TestWatchStoreFailure: Error {
    case writeFailed
}

enum TestWatchCredentialInstallFailure: Error {
    case rejected
}

final class TestWatchIdentityReader: WatchSummaryIdentityReading, @unchecked Sendable {
    var identity: WatchSummaryIdentity?

    func currentIdentity() -> WatchSummaryIdentity? {
        identity
    }
}

final class TestWatchSummaryFetcher: WatchSummaryFetching, @unchecked Sendable {
    var fetches = 0
    var response: Data
    var error: Error?

    init(response: Data) {
        self.response = response
    }

    func fetchSummary(for identity: WatchSummaryIdentity) async throws -> Data {
        fetches += 1
        if let error { throw error }
        return response
    }
}

enum TestWatchFetchFailure: Error {
    case unauthorized
}

final class TestWatchCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var value = 0

    func increment() {
        lock.lock()
        value += 1
        lock.unlock()
    }

    func read() -> Int {
        lock.lock()
        defer { lock.unlock() }
        return value
    }
}

final class TestSuspendingWatchFetcher: WatchSummaryFetching, @unchecked Sendable {
    private let lock = NSLock()
    private var continuations: [CheckedContinuation<Data, Error>] = []
    private var fetchCount = 0
    private let response: Data

    init(response: Data) {
        self.response = response
    }

    func fetchSummary(for identity: WatchSummaryIdentity) async throws -> Data {
        lock.withLock { fetchCount += 1 }
        return try await withCheckedThrowingContinuation { continuation in
            lock.withLock { continuations.append(continuation) }
        }
    }

    func count() -> Int {
        lock.withLock { fetchCount }
    }

    func resolve() {
        let pending = lock.withLock {
            let result = continuations
            continuations.removeAll()
            return result
        }
        for continuation in pending {
            continuation.resume(returning: response)
        }
    }
}

@main
enum WatchSummaryTests {
    static func main() async throws {
        let fixtureDirectory = CommandLine.arguments[1]
        let versioned = try Data(contentsOf: URL(fileURLWithPath: fixtureDirectory)
            .appendingPathComponent("versioned.json"))
        let legacy = try Data(contentsOf: URL(fileURLWithPath: fixtureDirectory)
            .appendingPathComponent("legacy.json"))
        let identity = WatchSummaryIdentity(
            accountId: "account-a",
            babyId: "baby-versioned",
            generation: "token-a",
            timezone: "Europe/Belgrade"
        )
        let store = TestWatchSummaryStore()
        store.bytesByScope[identity.cacheKey] = versioned
        let identityReader = TestWatchIdentityReader()
        identityReader.identity = identity
        let fetcher = TestWatchSummaryFetcher(response: versioned)
        let reloads = TestWatchCounter()
        let coordinator = WatchSummaryCoordinator(
            store: store,
            identityReader: identityReader,
            fetcher: fetcher,
            reload: { reloads.increment() }
        )
        let cached = try WatchSummaryDecoder.decodeCache(versioned).data

        let resetSuiteName = "watch-summary-reset-tests.\(UUID().uuidString)"
        let resetDefaults = UserDefaults(suiteName: resetSuiteName)!
        resetDefaults.set("multi", forKey: "multiBabyWatchData")
        resetDefaults.set("legacy", forKey: "watchData")
        resetDefaults.set("widget", forKey: "widgetData")
        resetDefaults.set("summary", forKey: "watchSummary.account-a.baby-a")
        resetDefaults.set("overlay", forKey: "watchPendingOverlays.account-a.baby-a")
        resetDefaults.set("optimism", forKey: "watchOptimisticState.account-a.baby-a")
        resetDefaults.set("sr", forKey: "watchLanguage")
        resetDefaults.set("legacy-bearer", forKey: "watchSupabaseAccessToken")

        WatchAccountCachePurger.purge(from: resetDefaults)
        WatchLegacyCredentialPurger.purge(from: resetDefaults)

        for key in [
            "multiBabyWatchData",
            "watchData",
            "widgetData",
            "watchSummary.account-a.baby-a",
            "watchPendingOverlays.account-a.baby-a",
            "watchOptimisticState.account-a.baby-a"
        ] {
            requireWatch(resetDefaults.object(forKey: key) == nil, "scope reset retained \(key)")
        }
        requireWatch(resetDefaults.string(forKey: "watchLanguage") == "sr", "scope reset removed language")
        requireWatch(
            resetDefaults.object(forKey: "watchSupabaseAccessToken") == nil,
            "Watch retained the deprecated App Group bearer"
        )
        resetDefaults.removePersistentDomain(forName: resetSuiteName)

        let scopeSuiteName = "watch-scope-change-tests.\(UUID().uuidString)"
        let scopeDefaults = UserDefaults(suiteName: scopeSuiteName)!
        scopeDefaults.set("account-a", forKey: "watchSupabaseUserId")
        scopeDefaults.set("household-a", forKey: "watchHouseholdId")
        scopeDefaults.set("old-summary", forKey: "watchSummary.account-a.baby-a")

        let scopeChanged = WatchAccountScopeInstaller.install(
            accountId: "account-b",
            householdId: "household-b",
            in: scopeDefaults
        )

        requireWatch(scopeChanged, "Watch did not detect the account scope change")
        requireWatch(
            scopeDefaults.object(forKey: "watchSummary.account-a.baby-a") == nil,
            "Watch retained the previous account's cached baby data"
        )
        requireWatch(
            scopeDefaults.string(forKey: "watchSupabaseUserId") == "account-b",
            "Watch did not store the incoming account independently of its capsule"
        )
        requireWatch(
            scopeDefaults.string(forKey: "watchHouseholdId") == "household-b",
            "Watch did not store the incoming household independently of its capsule"
        )
        scopeDefaults.removePersistentDomain(forName: scopeSuiteName)

        requireWatch(
            !WatchNetworkCredentialPolicy.canRequest(
                hasConfig: true,
                hasUser: true,
                hasSession: true,
                isStale: true
            ),
            "Watch kept polling with credentials already marked stale"
        )
        requireWatch(
            WatchNetworkCredentialPolicy.canRequest(
                hasConfig: true,
                hasUser: true,
                hasSession: true,
                isStale: false
            ),
            "Watch rejected a complete fresh credential set"
        )
        requireWatch(
            !WatchCredentialContextPolicy.shouldMarkStale(
                hasIncomingCapsule: false,
                hasStoredSession: true
            ),
            "capsule-less context disabled a valid stored session"
        )
        requireWatch(
            WatchCredentialContextPolicy.shouldMarkStale(
                hasIncomingCapsule: false,
                hasStoredSession: false
            ),
            "missing phone and stored capsules did not request recovery"
        )
        requireWatch(
            !WatchCredentialContextPolicy.shouldRemoveStoredSession(
                scopeChanged: true,
                hasIncomingCapsule: false
            ),
            "scope change deleted the only session without a replacement"
        )
        let unauthorizedRecoveries = TestWatchCounter()
        let unauthorizedRequest = await WatchAuthenticatedRequestCoordinator.send(
            perform: { (401, Data()) },
            recoverUnauthorized: { unauthorizedRecoveries.increment() }
        )
        requireWatch(unauthorizedRequest.0 == 401, "request boundary hid unauthorized")
        requireWatch(
            unauthorizedRecoveries.read() == 1,
            "authenticated 401 did not request exactly one credential sync"
        )
        _ = await WatchAuthenticatedRequestCoordinator.send(
            perform: { (204, Data()) },
            recoverUnauthorized: { unauthorizedRecoveries.increment() }
        )
        requireWatch(
            unauthorizedRecoveries.read() == 1,
            "successful authenticated request triggered credential recovery"
        )

        let metadataSuiteName = "watch-metadata-install-tests.\(UUID().uuidString)"
        let metadataDefaults = UserDefaults(suiteName: metadataSuiteName)!
        let capsuleInstalled = WatchCredentialContextInstaller.install(
            supabaseUrl: "https://example.supabase.co",
            anonKey: "anon-key",
            accountId: "account-a",
            householdId: "household-a",
            in: metadataDefaults
        ) {
            throw TestWatchCredentialInstallFailure.rejected
        }
        requireWatch(!capsuleInstalled, "Watch reported a rejected capsule as installed")
        requireWatch(
            metadataDefaults.string(forKey: "watchSupabaseUrl") == "https://example.supabase.co",
            "Watch discarded public Supabase URL after capsule rejection"
        )
        requireWatch(
            metadataDefaults.string(forKey: "watchSupabaseAnonKey") == "anon-key",
            "Watch discarded public anon key after capsule rejection"
        )
        requireWatch(
            metadataDefaults.string(forKey: "watchSupabaseUserId") == "account-a",
            "Watch discarded account identity after capsule rejection"
        )
        metadataDefaults.removePersistentDomain(forName: metadataSuiteName)

        let legacySuiteName = "watch-legacy-owner-tests.\(UUID().uuidString)"
        let legacyDefaults = UserDefaults(suiteName: legacySuiteName)!
        legacyDefaults.set("legacy", forKey: "watchData")
        requireWatch(
            !WatchLegacyCacheOwnership.canRead(accountId: "account-a", from: legacyDefaults),
            "unowned legacy cache was readable"
        )
        WatchLegacyCacheOwnership.mark(accountId: "account-a", in: legacyDefaults)
        requireWatch(
            WatchLegacyCacheOwnership.canRead(accountId: "account-a", from: legacyDefaults),
            "owning account could not read its legacy cache"
        )
        requireWatch(
            !WatchLegacyCacheOwnership.canRead(accountId: "account-b", from: legacyDefaults),
            "another account could read the legacy cache"
        )
        legacyDefaults.removePersistentDomain(forName: legacySuiteName)

        let applicationContextRanOnMain = await withCheckedContinuation { continuation in
            DispatchQueue.global().async {
                WatchMainThreadDispatcher.dispatch {
                    continuation.resume(returning: Thread.isMainThread)
                }
            }
        }
        requireWatch(
            applicationContextRanOnMain,
            "application-context state mutation did not run on the main thread"
        )

        let result = await coordinator.acceptTimerProbe(
            WatchTimerFingerprint(timers: cached.activeTimers ?? [])
        )

        requireWatch(result?.babyId == "baby-versioned", "unchanged probe lost the cached summary")
        requireWatch(fetcher.fetches == 0, "unchanged probe fetched the complete summary")
        requireWatch(store.writes == 0, "unchanged probe wrote the cache")
        requireWatch(reloads.read() == 0, "unchanged probe reloaded complications")

        let restTimerRows = Data(#"""
        [{
          "id": "lock-1",
          "activity_type": "sleep",
          "started_by": "account-a",
          "started_at": "2026-08-08T09:30:00.123456+00:00",
          "timer_data": {
            "sleepType": "nap",
            "isPaused": false,
            "timerInstanceId": "timer-rest"
          }
        }]
        """#.utf8)
        let restTimers = try WatchTimerProbeDecoder.decode(
            restTimerRows,
            currentUserId: identity.accountId
        )
        let rpcTimer = WatchSummaryTimer(
            type: "sleep",
            startTime: "2026-08-08T09:30:00.123Z",
            timerInstanceId: "timer-rest",
            context: "nap",
            isRemote: false,
            isPaused: false,
            accumulatedSeconds: nil
        )
        requireWatch(
            WatchTimerFingerprint(timers: restTimers) == WatchTimerFingerprint(timers: [rpcTimer]),
            "REST timer timestamp did not match the RPC timer fingerprint"
        )

        let restTimerWithoutPause = Data(#"""
        [{
          "id": "lock-2",
          "activity_type": "sleep",
          "started_by": "account-a",
          "started_at": "2026-08-08T09:30:00.123Z",
          "timer_data": {
            "sleepType": "nap",
            "timerInstanceId": "timer-rest"
          }
        }]
        """#.utf8)
        let timersWithoutPause = try WatchTimerProbeDecoder.decode(
            restTimerWithoutPause,
            currentUserId: identity.accountId
        )
        requireWatch(
            WatchTimerFingerprint(timers: timersWithoutPause) ==
                WatchTimerFingerprint(timers: [rpcTimer]),
            "REST timer without isPaused did not match the RPC false default"
        )

        let phoneSleepTimerRows = Data(#"""
        [{
          "id": "lock-3",
          "activity_type": "sleep",
          "started_by": "account-a",
          "started_at": "2026-08-08T09:30:00.123Z",
          "timer_data": {
            "type": "nap",
            "isPaused": false,
            "timerInstanceId": "timer-rest"
          }
        }]
        """#.utf8)
        let phoneSleepTimers = try WatchTimerProbeDecoder.decode(
            phoneSleepTimerRows,
            currentUserId: identity.accountId
        )
        requireWatch(
            WatchTimerFingerprint(timers: phoneSleepTimers) ==
                WatchTimerFingerprint(timers: [rpcTimer]),
            "phone-started sleep type did not match the RPC timer context"
        )

        let baseTimer: [String: Any] = [
            "type": "sleep",
            "startTime": "2026-08-08T09:30:00.000Z",
            "timerInstanceId": "timer-base",
            "context": "nap",
            "isRemote": false,
            "isPaused": false,
            "accumulatedSeconds": 60
        ]
        let runningBase = try versionedWatchFixture(
            versioned,
            timer: baseTimer,
            serverAsOf: "2026-08-08T10:01:00.000Z"
        )
        let materialChanges: [(String, String, Any)] = [
            ("type", "type", "feeding"),
            ("start anchor", "startTime", "2026-08-08T09:31:00.000Z"),
            ("timer identity", "timerInstanceId", "timer-changed"),
            ("context", "context", "night"),
            ("remote state", "isRemote", true),
            ("pause state", "isPaused", true),
            ("accumulated time", "accumulatedSeconds", 90)
        ]
        for (label, key, value) in materialChanges {
            var changedTimer = baseTimer
            changedTimer[key] = value
            let changedBytes = try versionedWatchFixture(
                versioned,
                timer: changedTimer,
                serverAsOf: "2026-08-08T10:02:00.000Z"
            )
            let changedSummary = try WatchSummaryDecoder.decodeNetwork(
                changedBytes,
                expectedBabyId: identity.babyId
            )
            let changedStore = TestWatchSummaryStore()
            changedStore.bytesByScope[identity.cacheKey] = runningBase
            let changedReader = TestWatchIdentityReader()
            changedReader.identity = identity
            let changedFetcher = TestWatchSummaryFetcher(response: changedBytes)
            let changedReloads = TestWatchCounter()
            let changedCoordinator = WatchSummaryCoordinator(
                store: changedStore,
                identityReader: changedReader,
                fetcher: changedFetcher,
                reload: { changedReloads.increment() }
            )

            let accepted = await changedCoordinator.acceptTimerProbe(
                WatchTimerFingerprint(timers: changedSummary.activeTimers ?? [])
            )

            requireWatch(accepted == changedSummary, "\(label) change did not install the full summary")
            requireWatch(changedFetcher.fetches == 1, "\(label) change did not fetch exactly once")
            requireWatch(changedStore.writes == 1, "\(label) change did not replace the base")
            requireWatch(changedReloads.read() == 1, "\(label) change did not reload complications")
        }

        for trigger in WatchSummaryRefreshTrigger.allCases {
            let triggerStore = TestWatchSummaryStore()
            let triggerIdentityReader = TestWatchIdentityReader()
            triggerIdentityReader.identity = identity
            let triggerFetcher = TestWatchSummaryFetcher(response: versioned)
            let triggerReloads = TestWatchCounter()
            let triggerCoordinator = WatchSummaryCoordinator(
                store: triggerStore,
                identityReader: triggerIdentityReader,
                fetcher: triggerFetcher,
                reload: { triggerReloads.increment() }
            )

            let refreshed = await triggerCoordinator.refresh(trigger: trigger)

            requireWatch(refreshed?.babyId == identity.babyId, "\(trigger) did not return the summary")
            requireWatch(triggerFetcher.fetches == 1, "\(trigger) did not request one summary")
            requireWatch(triggerStore.writes == 1, "\(trigger) did not commit the complete base")
            requireWatch(triggerReloads.read() == 1, "\(trigger) did not reload complications")
        }

        let unauthorizedStore = TestWatchSummaryStore()
        unauthorizedStore.bytesByScope[identity.cacheKey] = versioned
        let unauthorizedReader = TestWatchIdentityReader()
        unauthorizedReader.identity = identity
        let unauthorizedFetcher = TestWatchSummaryFetcher(response: versioned)
        unauthorizedFetcher.error = WatchSummaryTransportError.unauthorized
        let credentialRequests = TestWatchCounter()
        let unauthorizedReloads = TestWatchCounter()
        let unauthorizedCoordinator = WatchSummaryCoordinator(
            store: unauthorizedStore,
            identityReader: unauthorizedReader,
            fetcher: unauthorizedFetcher,
            reload: { unauthorizedReloads.increment() },
            requestCredentials: { credentialRequests.increment() }
        )
        let changedTimer = WatchSummaryTimer(
            type: "sleep",
            startTime: "2026-08-08T10:01:00.000Z",
            timerInstanceId: "timer-new",
            context: "nap",
            isRemote: true,
            isPaused: false,
            accumulatedSeconds: nil
        )

        let unauthorizedResult = await unauthorizedCoordinator.acceptTimerProbe(
            WatchTimerFingerprint(timers: [changedTimer])
        )

        requireWatch(unauthorizedResult == cached, "401 changed the coherent base")
        requireWatch(unauthorizedStore.bytesByScope[identity.cacheKey] == versioned, "401 changed cached bytes")
        requireWatch(unauthorizedStore.writes == 0, "401 wrote a partial cache")
        requireWatch(unauthorizedReloads.read() == 0, "401 reloaded complications")
        requireWatch(credentialRequests.read() == 1, "401 did not request fresh phone credentials")

        let completedLater = try versionedWatchFixture(
            versioned,
            timer: nil,
            serverAsOf: "2026-08-08T10:03:00.000Z"
        )
        let runningSummary = try WatchSummaryDecoder.decodeNetwork(
            runningBase,
            expectedBabyId: identity.babyId
        )
        let retryStore = TestWatchSummaryStore()
        retryStore.bytesByScope[identity.cacheKey] = runningBase
        let retryReader = TestWatchIdentityReader()
        retryReader.identity = identity
        let retryFetcher = TestWatchSummaryFetcher(response: completedLater)
        retryFetcher.error = WatchSummaryTransportError.unsuccessfulResponse
        let retryCoordinator = WatchSummaryCoordinator(
            store: retryStore,
            identityReader: retryReader,
            fetcher: retryFetcher,
            reload: {}
        )
        let completedFingerprint = WatchTimerFingerprint(timers: [])

        let failedResult = await retryCoordinator.acceptTimerProbe(completedFingerprint)
        requireWatch(failedResult == runningSummary, "failed full fetch changed the running base")
        requireWatch(retryStore.bytesByScope[identity.cacheKey] == runningBase, "failed fetch changed cache bytes")
        retryFetcher.error = nil
        let retriedResult = await retryCoordinator.acceptTimerProbe(completedFingerprint)
        requireWatch(retriedResult?.activeTimers?.isEmpty == true, "changed fingerprint was not retried")
        requireWatch(retryFetcher.fetches == 2, "changed fingerprint did not retain exactly one retry path")

        let writeFailureStore = TestWatchSummaryStore()
        writeFailureStore.bytesByScope[identity.cacheKey] = runningBase
        writeFailureStore.failWrites = true
        let writeFailureReader = TestWatchIdentityReader()
        writeFailureReader.identity = identity
        let writeFailureCoordinator = WatchSummaryCoordinator(
            store: writeFailureStore,
            identityReader: writeFailureReader,
            fetcher: TestWatchSummaryFetcher(response: completedLater),
            reload: {}
        )
        let writeFailureResult = await writeFailureCoordinator.acceptTimerProbe(completedFingerprint)
        requireWatch(writeFailureResult == runningSummary, "cache-write failure published an uncommitted base")
        requireWatch(writeFailureStore.bytesByScope[identity.cacheKey] == runningBase, "cache-write failure changed bytes")

        let wrongBaby = try changedWatchFixture(completedLater, ["babyId": "baby-other"])
        let wrongBabyStore = TestWatchSummaryStore()
        wrongBabyStore.bytesByScope[identity.cacheKey] = runningBase
        let wrongBabyReader = TestWatchIdentityReader()
        wrongBabyReader.identity = identity
        let wrongBabyCoordinator = WatchSummaryCoordinator(
            store: wrongBabyStore,
            identityReader: wrongBabyReader,
            fetcher: TestWatchSummaryFetcher(response: wrongBaby),
            reload: {}
        )
        let wrongBabyResult = await wrongBabyCoordinator.acceptTimerProbe(completedFingerprint)
        requireWatch(wrongBabyResult == runningSummary, "wrong-baby response replaced the base")
        requireWatch(wrongBabyStore.writes == 0, "wrong-baby response wrote the cache")

        let staleStore = TestWatchSummaryStore()
        staleStore.bytesByScope[identity.cacheKey] = runningBase
        let staleReader = TestWatchIdentityReader()
        staleReader.identity = identity
        let staleCoordinator = WatchSummaryCoordinator(
            store: staleStore,
            identityReader: staleReader,
            fetcher: TestWatchSummaryFetcher(response: versioned),
            reload: {}
        )
        let staleResult = await staleCoordinator.acceptTimerProbe(completedFingerprint)
        requireWatch(staleResult == runningSummary, "out-of-order response replaced the newer base")
        requireWatch(staleStore.writes == 0, "out-of-order response wrote the cache")

        let interleavedNewer = try versionedWatchFixture(
            versioned,
            timer: nil,
            serverAsOf: "2026-08-08T10:05:00.000Z"
        )
        let interleavedNewerSummary = try WatchSummaryDecoder.decodeNetwork(
            interleavedNewer,
            expectedBabyId: identity.babyId
        )
        let interleavedStore = TestWatchSummaryStore()
        interleavedStore.bytesByScope[identity.cacheKey] = runningBase
        let interleavedReader = TestWatchIdentityReader()
        interleavedReader.identity = identity
        let interleavedFetcher = TestSuspendingWatchFetcher(response: completedLater)
        let interleavedCoordinator = WatchSummaryCoordinator(
            store: interleavedStore,
            identityReader: interleavedReader,
            fetcher: interleavedFetcher,
            reload: {}
        )
        let interleavedTask = Task {
            await interleavedCoordinator.acceptTimerProbe(completedFingerprint)
        }
        for _ in 0..<100 where interleavedFetcher.count() == 0 { await Task.yield() }
        _ = await interleavedCoordinator.acceptPhonePayload(interleavedNewer)
        interleavedFetcher.resolve()
        let interleavedResult = await interleavedTask.value

        requireWatch(
            interleavedResult == interleavedNewerSummary,
            "older probe response replaced an interleaved newer phone snapshot"
        )
        requireWatch(
            interleavedStore.bytesByScope[identity.cacheKey] == interleavedNewer,
            "older probe response overwrote newer cached bytes"
        )
        requireWatch(interleavedStore.writes == 1, "stale probe performed an extra cache write")

        let lateStore = TestWatchSummaryStore()
        lateStore.bytesByScope[identity.cacheKey] = runningBase
        let lateReader = TestWatchIdentityReader()
        lateReader.identity = identity
        let lateFetcher = TestSuspendingWatchFetcher(response: completedLater)
        let lateCoordinator = WatchSummaryCoordinator(
            store: lateStore,
            identityReader: lateReader,
            fetcher: lateFetcher,
            reload: {}
        )
        let lateTask = Task { await lateCoordinator.acceptTimerProbe(completedFingerprint) }
        for _ in 0..<100 where lateFetcher.count() == 0 { await Task.yield() }
        lateReader.identity = WatchSummaryIdentity(
            accountId: "account-b",
            babyId: identity.babyId,
            generation: "other-household|token-b",
            timezone: identity.timezone
        )
        lateFetcher.resolve()
        let lateResult = await lateTask.value
        requireWatch(lateResult == runningSummary, "late prior-scope response was published")
        requireWatch(lateStore.writes == 0, "late prior-scope response wrote the cache")

        let sameBabyLegacy = try changedWatchFixture(legacy, [
            "babyId": identity.babyId,
            "updatedAt": "2026-08-08T11:00:00.000Z"
        ])
        let compatibilityStore = TestWatchSummaryStore()
        compatibilityStore.bytesByScope[identity.cacheKey] = versioned
        let compatibilityReader = TestWatchIdentityReader()
        compatibilityReader.identity = identity
        let compatibilityCoordinator = WatchSummaryCoordinator(
            store: compatibilityStore,
            identityReader: compatibilityReader,
            fetcher: TestWatchSummaryFetcher(response: versioned),
            reload: {}
        )

        let compatibilityResult = await compatibilityCoordinator.acceptPhonePayload(sameBabyLegacy)

        requireWatch(compatibilityResult == cached, "legacy phone payload replaced a versioned base")
        requireWatch(
            compatibilityStore.bytesByScope[identity.cacheKey] == versioned,
            "legacy phone payload changed newer cache bytes"
        )
        requireWatch(compatibilityStore.writes == 0, "legacy phone payload rewrote the versioned cache")

        let legacyMulti = try legacyMultiBabyFixture(legacy, babyId: identity.babyId)
        let multiStore = TestWatchSummaryStore()
        let multiReader = TestWatchIdentityReader()
        multiReader.identity = identity
        let multiCoordinator = WatchSummaryCoordinator(
            store: multiStore,
            identityReader: multiReader,
            fetcher: TestWatchSummaryFetcher(response: versioned),
            reload: {}
        )

        let multiResult = await multiCoordinator.acceptPhonePayload(legacyMulti)

        requireWatch(multiResult?.babyId == identity.babyId, "legacy multi-baby payload was not adapted")
        requireWatch(multiResult?.activeTimers?.first?.timerInstanceId == "legacy-timer", "legacy timer identity was lost")
        requireWatch(multiStore.writes == 1, "adapted legacy multi-baby payload was not cached")

        let overlayStore = TestWatchSummaryStore()
        let overlayReader = TestWatchIdentityReader()
        overlayReader.identity = identity
        let overlayFetcher = TestWatchSummaryFetcher(response: versioned)
        let overlayCoordinator = WatchSummaryCoordinator(
            store: overlayStore,
            identityReader: overlayReader,
            fetcher: overlayFetcher,
            reload: {}
        )
        let overlay = WatchOptimisticOverlay(
            accountId: identity.accountId,
            babyId: identity.babyId,
            requestId: "request-pause",
            timerInstanceId: "timer-pending",
            activityId: "activity-reserved",
            activityType: "sleep",
            action: .pause,
            requestedAt: "2026-08-08T10:01:00.000Z"
        )
        await overlayCoordinator.recordOverlay(overlay)

        let restoredOverlayCoordinator = WatchSummaryCoordinator(
            store: overlayStore,
            identityReader: overlayReader,
            fetcher: overlayFetcher,
            reload: {}
        )
        let restoredOverlays = await restoredOverlayCoordinator.pendingOverlays(for: identity)
        requireWatch(restoredOverlays == [overlay], "pending overlay did not survive coordinator recreation")

        overlayReader.identity = WatchSummaryIdentity(
            accountId: "account-b",
            babyId: identity.babyId,
            generation: "token-b",
            timezone: identity.timezone
        )
        await overlayCoordinator.acknowledge(requestId: overlay.requestId)
        let afterOtherAccount = await overlayCoordinator.pendingOverlays(for: identity)
        requireWatch(
            afterOtherAccount == [overlay],
            "another account cleared the pending overlay"
        )

        overlayReader.identity = identity
        await overlayCoordinator.acknowledge(requestId: "unrelated-request")
        let afterUnrelatedAcknowledgement = await overlayCoordinator.pendingOverlays(for: identity)
        requireWatch(
            afterUnrelatedAcknowledgement == [overlay],
            "an unrelated acknowledgement cleared the pending overlay"
        )
        await overlayCoordinator.acknowledge(requestId: overlay.requestId)
        let afterCorrelatedAcknowledgement = await overlayCoordinator.pendingOverlays(for: identity)
        requireWatch(
            afterCorrelatedAcknowledgement.isEmpty,
            "the correlated acknowledgement did not clear the pending overlay"
        )

        let matchingTimer: [String: Any] = [
            "type": "sleep",
            "startTime": "2026-08-08T10:01:00.000Z",
            "timerInstanceId": "timer-matching",
            "context": "nap",
            "isRemote": false,
            "isPaused": false
        ]
        let runningVersioned = try versionedWatchFixture(
            versioned,
            timer: matchingTimer,
            serverAsOf: "2026-08-08T10:02:00.000Z"
        )
        let snapshotOverlayStore = TestWatchSummaryStore()
        let snapshotOverlayReader = TestWatchIdentityReader()
        snapshotOverlayReader.identity = identity
        let snapshotOverlayCoordinator = WatchSummaryCoordinator(
            store: snapshotOverlayStore,
            identityReader: snapshotOverlayReader,
            fetcher: TestWatchSummaryFetcher(response: runningVersioned),
            reload: {}
        )
        let matchingOverlay = WatchOptimisticOverlay(
            accountId: identity.accountId,
            babyId: identity.babyId,
            requestId: "request-start",
            timerInstanceId: "timer-matching",
            activityId: "activity-matching",
            activityType: "sleep",
            action: .start,
            requestedAt: "2026-08-08T10:01:00.000Z"
        )
        let unrelatedOverlay = WatchOptimisticOverlay(
            accountId: identity.accountId,
            babyId: identity.babyId,
            requestId: "request-unrelated-stop",
            timerInstanceId: "timer-unrelated",
            activityId: "activity-unrelated",
            activityType: "feeding",
            action: .stop,
            requestedAt: "2026-08-08T10:01:00.000Z"
        )
        await snapshotOverlayCoordinator.recordOverlay(matchingOverlay)
        await snapshotOverlayCoordinator.recordOverlay(unrelatedOverlay)

        _ = await snapshotOverlayCoordinator.refresh(trigger: .postAction)
        let afterMatchingSnapshot = await snapshotOverlayCoordinator.pendingOverlays(for: identity)

        requireWatch(
            afterMatchingSnapshot == [unrelatedOverlay],
            "a correlated complete snapshot did not clear only its matching overlay"
        )

        let coalescingStore = TestWatchSummaryStore()
        let coalescingReader = TestWatchIdentityReader()
        coalescingReader.identity = identity
        let coalescingFetcher = TestSuspendingWatchFetcher(response: versioned)
        let coalescingCoordinator = WatchSummaryCoordinator(
            store: coalescingStore,
            identityReader: coalescingReader,
            fetcher: coalescingFetcher,
            reload: {}
        )
        async let firstRefresh = coalescingCoordinator.refresh(trigger: .activation)
        async let secondRefresh = coalescingCoordinator.refresh(trigger: .reachability)
        for _ in 0..<100 where coalescingFetcher.count() == 0 {
            await Task.yield()
        }

        requireWatch(coalescingFetcher.count() == 1, "concurrent full refreshes were not coalesced")
        coalescingFetcher.resolve()
        _ = await (firstRefresh, secondRefresh)
        requireWatch(coalescingStore.writes == 1, "coalesced refresh wrote the base more than once")
        print("Watch summary tests passed")
    }
}
