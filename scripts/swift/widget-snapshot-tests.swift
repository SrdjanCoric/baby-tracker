import Foundation

enum ActivityType: String {
    case feeding, sleep, diaper, pumping, tummyTime
}

func require(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() {
        fatalError(message)
    }
}

final class TestSnapshotStore: WidgetSnapshotStoring, @unchecked Sendable {
    var bytesByBaby: [String: Data] = [:]
    var writes = 0
    var events: [String] = []

    func readSnapshot(for babyId: String) -> Data? {
        bytesByBaby[babyId]
    }

    func writeSnapshot(_ bytes: Data, for babyId: String) throws {
        bytesByBaby[babyId] = bytes
        writes += 1
        events.append("write")
    }
}

final class TestIdentityReader: WidgetSnapshotIdentityReading, @unchecked Sendable {
    var value: WidgetSnapshotIdentity?

    init(_ value: WidgetSnapshotIdentity?) {
        self.value = value
    }

    func currentIdentity() -> WidgetSnapshotIdentity? {
        value
    }
}

enum TestFetchFailure: Error, CaseIterable {
    case timeout
    case unauthorized
    case http
}

actor TestSnapshotFetcher: WidgetSnapshotFetching {
    var bytes: Data
    var failure: Error?
    var delayNanoseconds: UInt64
    var calls = 0
    var onFetch: (@Sendable () -> Void)?

    init(bytes: Data, failure: Error? = nil, delayNanoseconds: UInt64 = 0) {
        self.bytes = bytes
        self.failure = failure
        self.delayNanoseconds = delayNanoseconds
    }

    func fetchSnapshot(for identity: WidgetSnapshotIdentity) async throws -> Data {
        calls += 1
        onFetch?()
        if delayNanoseconds > 0 {
            try await Task.sleep(nanoseconds: delayNanoseconds)
        }
        if let failure { throw failure }
        return bytes
    }

    func callCount() -> Int { calls }

    func setOnFetch(_ callback: @escaping @Sendable () -> Void) {
        onFetch = callback
    }
}

func changedFixture(_ data: Data, _ updates: [String: Any]) throws -> Data {
    var object = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    for (key, value) in updates {
        object[key] = value
    }
    return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
}

@main
enum WidgetSnapshotTests {
    static func main() async throws {
        guard CommandLine.arguments.count == 2 else {
            fatalError("expected the repository fixture directory")
        }
        let fixtures = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let legacy = try Data(contentsOf: fixtures.appendingPathComponent("legacy.json"))
        let versioned = try Data(contentsOf: fixtures.appendingPathComponent("versioned.json"))
        let weightOnly = try Data(contentsOf: fixtures.appendingPathComponent("versioned-weight-only.json"))

        let legacyDecoded = try WidgetSnapshotDecoder.decodeCache(legacy)
        require(legacyDecoded.kind == .legacy, "legacy fixture lost its compatibility classification")
        require(legacyDecoded.data.activeTimers?.count == 1, "singular legacy timer was not normalized")
        require(legacyDecoded.data.activeTimer?.timerInstanceId == "legacy-timer", "legacy timer identity changed")

        let versionedDecoded = try WidgetSnapshotDecoder.decodeNetwork(versioned, expectedBabyId: "baby-versioned")
        require(versionedDecoded.schemaVersion == 1, "versioned fixture lost its schema version")
        require(versionedDecoded.activities.sleep.lastSleepEndedAt == "2026-08-08T09:45:00.000Z", "sleep anchor changed")

        let weightOnlyDecoded = try WidgetSnapshotDecoder.decodeNetwork(
            weightOnly,
            expectedBabyId: "baby-versioned"
        )
        require(
            weightOnlyDecoded.activities.growth.lastMeasurement?.weightKg == 7.125
                && weightOnlyDecoded.activities.growth.lastMeasurement?.heightCm == nil
                && weightOnlyDecoded.activities.growth.lastMeasurement?.headCircumferenceCm == nil,
            "weight-only growth measurement diverged between decoders"
        )

        var incoherent = try JSONSerialization.jsonObject(with: versioned) as! [String: Any]
        incoherent["activeTimer"] = [
            "type": "sleep",
            "startTime": "2026-08-08T10:00:00.000Z",
            "timerInstanceId": "stale-timer"
        ]
        let incoherentData = try JSONSerialization.data(withJSONObject: incoherent)
        do {
            _ = try WidgetSnapshotDecoder.decodeNetwork(incoherentData, expectedBabyId: "baby-versioned")
            fatalError("timer-incoherent versioned payload was accepted")
        } catch WidgetSnapshotError.semanticFailure {
            // Expected.
        }

        let identity = TestIdentityReader(WidgetSnapshotIdentity(
            accountId: "account-a",
            babyId: "baby-versioned",
            generation: "generation-1",
            timezone: "Europe/Belgrade"
        ))
        let store = TestSnapshotStore()
        store.bytesByBaby["baby-versioned"] = legacy
        let fetcher = TestSnapshotFetcher(bytes: versioned)
        let coordinator = WidgetSnapshotCoordinator(
            store: store,
            identityReader: identity,
            fetcher: fetcher,
            reload: { store.events.append("reload") }
        )

        let installed = await coordinator.refresh(for: "baby-versioned")
        require(installed?.babyId == "baby-versioned", "complete snapshot was not installed")
        require(store.bytesByBaby["baby-versioned"] == versioned, "coordinator did not store response bytes")
        require(store.events == ["write", "reload"], "cache must be written before WidgetKit reload")

        _ = await coordinator.refresh(for: "baby-versioned")
        require(store.writes == 1, "equivalent refresh rewrote an unchanged snapshot")

        let metadataOnly = try changedFixture(versioned, [
            "serverAsOf": "2026-08-08T11:05:00.000Z",
            "updatedAt": "2026-08-08T11:05:00.000Z"
        ])
        let metadataStore = TestSnapshotStore()
        metadataStore.bytesByBaby["baby-versioned"] = versioned
        let metadataCoordinator = WidgetSnapshotCoordinator(
            store: metadataStore,
            identityReader: identity,
            fetcher: TestSnapshotFetcher(bytes: metadataOnly),
            reload: { metadataStore.events.append("reload") }
        )
        _ = await metadataCoordinator.refresh(for: "baby-versioned")
        require(
            metadataStore.bytesByBaby["baby-versioned"] == metadataOnly,
            "metadata-only refresh did not advance cache freshness"
        )
        require(
            metadataStore.events == ["write"],
            "metadata-only refresh recursively reloaded an equivalent Widget timeline"
        )

        let coalescingStore = TestSnapshotStore()
        coalescingStore.bytesByBaby["baby-versioned"] = legacy
        let coalescingFetcher = TestSnapshotFetcher(bytes: versioned, delayNanoseconds: 50_000_000)
        let coalescingCoordinator = WidgetSnapshotCoordinator(
            store: coalescingStore,
            identityReader: identity,
            fetcher: coalescingFetcher,
            reload: {}
        )
        async let first = coalescingCoordinator.refresh(for: "baby-versioned")
        async let second = coalescingCoordinator.refresh(for: "baby-versioned")
        _ = await (first, second)
        let coalescedCallCount = await coalescingFetcher.callCount()
        require(coalescedCallCount == 1, "same-baby refreshes did not coalesce")

        let older = try changedFixture(versioned, [
            "serverAsOf": "2026-08-08T09:00:00.000Z",
            "updatedAt": "2026-08-08T09:00:00.000Z"
        ])
        let wrongBaby = try changedFixture(versioned, ["babyId": "another-baby"])
        let unsupported = try changedFixture(versioned, ["schemaVersion": 2])
        let malformed = Data("not-json".utf8)

        var semanticObject = try JSONSerialization.jsonObject(with: versioned) as! [String: Any]
        semanticObject["activeTimer"] = [
            "type": "sleep",
            "startTime": "2026-08-08T10:00:00.000Z",
            "timerInstanceId": "stale"
        ]
        let semantic = try JSONSerialization.data(withJSONObject: semanticObject)

        var discardedTimerTransitionObject = try JSONSerialization.jsonObject(with: versioned) as! [String: Any]
        var transitionActivities = discardedTimerTransitionObject["activities"] as! [String: Any]
        var transitionSleep = transitionActivities["sleep"] as! [String: Any]
        transitionSleep["lastSleepEndedAt"] = "2026-08-08T08:30:00.000Z"
        transitionActivities["sleep"] = transitionSleep
        discardedTimerTransitionObject["activities"] = transitionActivities
        let discardedTimerTransition = try JSONSerialization.data(withJSONObject: discardedTimerTransitionObject)
        let transitionStore = TestSnapshotStore()
        transitionStore.bytesByBaby["baby-versioned"] = legacy
        let transitionCoordinator = WidgetSnapshotCoordinator(
            store: transitionStore,
            identityReader: identity,
            fetcher: TestSnapshotFetcher(bytes: discardedTimerTransition),
            reload: { transitionStore.events.append("reload") }
        )
        let discardedTimerSnapshot = await transitionCoordinator.refresh(for: "baby-versioned")
        require(
            discardedTimerSnapshot?.hasActiveTimer(for: .sleep) == false,
            "the locally stopped timer remained visible after reconciliation"
        )
        require(
            transitionStore.bytesByBaby["baby-versioned"] == discardedTimerTransition,
            "an authoritative snapshot could not discard a timer without a completed activity"
        )
        require(
            transitionStore.events == ["write", "reload"],
            "discarding a timer did not refresh the Widget"
        )
        let storedDiscard = try WidgetSnapshotDecoder.decodeCache(
            transitionStore.bytesByBaby["baby-versioned"]!
        ).data
        require(
            storedDiscard.hasActiveTimer(for: .sleep) == false,
            "the stored post-stop display still contained the sleep timer"
        )

        let completedAfterDiscard = try changedFixture(versioned, [
            "serverAsOf": "2026-08-08T10:01:00.000Z",
            "updatedAt": "2026-08-08T10:01:00.000Z"
        ])
        let completionCoordinator = WidgetSnapshotCoordinator(
            store: transitionStore,
            identityReader: identity,
            fetcher: TestSnapshotFetcher(bytes: completedAfterDiscard),
            reload: { transitionStore.events.append("reload") }
        )
        let completedAfterStop = await completionCoordinator.refresh(for: "baby-versioned")
        require(
            completedAfterStop?.activities.sleep.lastSleepEndedAt == "2026-08-08T09:45:00.000Z",
            "the completed summary did not install after a Widget stop reconciliation"
        )

        let rejectedPayloads = [older, wrongBaby, unsupported, malformed, semantic]
        for rejected in rejectedPayloads {
            let preservingStore = TestSnapshotStore()
            preservingStore.bytesByBaby["baby-versioned"] = versioned
            let rejectingCoordinator = WidgetSnapshotCoordinator(
                store: preservingStore,
                identityReader: identity,
                fetcher: TestSnapshotFetcher(bytes: rejected),
                reload: { preservingStore.events.append("reload") }
            )
            _ = await rejectingCoordinator.refresh(for: "baby-versioned")
            require(
                preservingStore.bytesByBaby["baby-versioned"] == versioned,
                "rejected payload changed cached bytes"
            )
            require(preservingStore.writes == 0 && preservingStore.events.isEmpty, "rejection reloaded the Widget")
        }

        for failure in TestFetchFailure.allCases {
            let preservingStore = TestSnapshotStore()
            preservingStore.bytesByBaby["baby-versioned"] = versioned
            let failingCoordinator = WidgetSnapshotCoordinator(
                store: preservingStore,
                identityReader: identity,
                fetcher: TestSnapshotFetcher(bytes: versioned, failure: failure),
                reload: { preservingStore.events.append("reload") }
            )
            _ = await failingCoordinator.refresh(for: "baby-versioned")
            require(preservingStore.bytesByBaby["baby-versioned"] == versioned, "fetch failure changed cached bytes")
            require(preservingStore.writes == 0 && preservingStore.events.isEmpty, "fetch failure reloaded the Widget")
        }

        let runningFailureStore = TestSnapshotStore()
        runningFailureStore.bytesByBaby["baby-versioned"] = legacy
        let runningFailureCoordinator = WidgetSnapshotCoordinator(
            store: runningFailureStore,
            identityReader: identity,
            fetcher: TestSnapshotFetcher(bytes: versioned, failure: TestFetchFailure.http),
            reload: { runningFailureStore.events.append("reload") }
        )
        _ = await runningFailureCoordinator.refresh(for: "baby-versioned")
        require(
            runningFailureStore.bytesByBaby["baby-versioned"] == legacy,
            "failed summary refresh changed the cached running timer bytes"
        )
        require(
            runningFailureStore.writes == 0 && runningFailureStore.events.isEmpty,
            "failed summary refresh installed or reloaded a partial state"
        )

        let staleStore = TestSnapshotStore()
        staleStore.bytesByBaby["baby-versioned"] = legacy
        let staleIdentity = TestIdentityReader(WidgetSnapshotIdentity(
            accountId: "account-a",
            babyId: "baby-versioned",
            generation: "generation-1",
            timezone: "Europe/Belgrade"
        ))
        let staleFetcher = TestSnapshotFetcher(bytes: versioned)
        await staleFetcher.setOnFetch {
            staleIdentity.value = WidgetSnapshotIdentity(
                accountId: "account-a",
                babyId: "baby-versioned",
                generation: "generation-2",
                timezone: "Europe/Belgrade"
            )
        }
        let staleCoordinator = WidgetSnapshotCoordinator(
            store: staleStore,
            identityReader: staleIdentity,
            fetcher: staleFetcher,
            reload: {}
        )
        _ = await staleCoordinator.refresh(for: "baby-versioned")
        require(staleStore.bytesByBaby["baby-versioned"] == legacy, "stale account generation was installed")

        print("PASS: Swift decoder and coordinator preserve one coherent Widget snapshot")
    }
}
