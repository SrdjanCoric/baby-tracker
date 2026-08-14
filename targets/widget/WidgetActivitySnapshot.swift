import Foundation

struct WidgetActivityData: Codable, Equatable {
    var feeding: FeedingData
    var sleep: SleepData
    var diaper: DiaperData
    var pumping: PumpingData
    var growth: GrowthData
    var tummyTime: TummyTimeData

    struct FeedingData: Codable, Equatable {
        var lastTime: String?
        var todayCount: Int
        var lastType: String?
        var lastSide: String?
    }

    struct SleepData: Codable, Equatable {
        var lastTime: String?
        var todayMinutes: Int
        var goalMinutes: Int
        var lastDurationMinutes: Int?
        var isActive: Bool
        var sleepType: String?
        var wakeWindowMinutes: Int?
        var wakeWindowSlotLabel: String?
        var wakeWindowRequiresNewbornOptIn: Bool?
        var lastSleepEndedAt: String?
        var napCountToday: Int?
        var morningConfirmationPending: Bool?
    }

    struct DiaperData: Codable, Equatable {
        var lastTime: String?
        var todayCounts: DiaperCounts
        var lastType: String?

        struct DiaperCounts: Codable, Equatable {
            var wet: Int
            var dirty: Int
            var mixed: Int
            var dry: Int
        }
    }

    struct PumpingData: Codable, Equatable {
        var lastTime: String?
        var todayVolumeMl: Double
        var sessionCount: Int
        var lastSide: String?
    }

    struct GrowthData: Codable, Equatable {
        var lastMeasurement: Measurement?

        struct Measurement: Codable, Equatable {
            var date: String
            var weightKg: Double?
            var heightCm: Double?
            var headCircumferenceCm: Double?
        }
    }

    struct TummyTimeData: Codable, Equatable {
        var lastTime: String?
        var todayMinutes: Int
        var goalMinutes: Int
        var lastDurationMinutes: Int?
    }
}

struct ActiveTimerData: Codable, Equatable {
    var type: String
    var startTime: String
    var timerInstanceId: String? = nil
    var context: String?
    var isRemote: Bool?
    var isPaused: Bool?
    var accumulatedSeconds: Int?
    /// Sync provenance for the widget timer-list merge. Only "accountless" or
    /// "offline" have no server row and must survive a server snapshot refresh.
    var lockState: String?
}

struct WidgetLocalDay: Codable, Equatable {
    var startedAt: String
    var endsAt: String
}

struct WidgetSleepPrediction: Codable, Equatable {
    var state: String
    var predictedAt: String?
}

struct WidgetDataModel: Codable, Equatable {
    var schemaVersion: Int?
    var serverAsOf: String?
    var timezone: String?
    var localDay: WidgetLocalDay?
    /// Freshness stamp for an app-written local snapshot, in the same clock
    /// domain as `updatedAt`. Present (with `schemaVersion` absent) marks a
    /// `.local` snapshot whose newer-than-`serverAsOf` timers survive a refresh.
    var localAsOf: String?
    var timeFormat: String?
    /// App-calculated, App Group-local display state. Server refreshes preserve it.
    var sleepPrediction: WidgetSleepPrediction?
    var babyId: String
    var babyName: String
    var activities: WidgetActivityData
    var activeTimer: ActiveTimerData?
    var activeTimers: [ActiveTimerData]?
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case schemaVersion
        case serverAsOf
        case timezone
        case localDay
        case localAsOf
        case timeFormat
        case sleepPrediction
        case babyId
        case babyName
        case activities
        case activeTimer
        case activeTimers
        case updatedAt
    }

    init(
        schemaVersion: Int? = nil,
        serverAsOf: String? = nil,
        timezone: String? = nil,
        localDay: WidgetLocalDay? = nil,
        localAsOf: String? = nil,
        timeFormat: String? = nil,
        sleepPrediction: WidgetSleepPrediction? = nil,
        babyId: String,
        babyName: String,
        activities: WidgetActivityData,
        activeTimer: ActiveTimerData?,
        activeTimers: [ActiveTimerData]?,
        updatedAt: String
    ) {
        self.schemaVersion = schemaVersion
        self.serverAsOf = serverAsOf
        self.timezone = timezone
        self.localDay = localDay
        self.localAsOf = localAsOf
        self.timeFormat = timeFormat
        self.sleepPrediction = sleepPrediction
        self.babyId = babyId
        self.babyName = babyName
        self.activities = activities
        let canonical = activeTimers ?? activeTimer.map { [$0] } ?? []
        self.activeTimers = canonical
        self.activeTimer = canonical.first
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion)
        serverAsOf = try container.decodeIfPresent(String.self, forKey: .serverAsOf)
        timezone = try container.decodeIfPresent(String.self, forKey: .timezone)
        localDay = try container.decodeIfPresent(WidgetLocalDay.self, forKey: .localDay)
        localAsOf = try container.decodeIfPresent(String.self, forKey: .localAsOf)
        timeFormat = try container.decodeIfPresent(String.self, forKey: .timeFormat)
        sleepPrediction = try container.decodeIfPresent(WidgetSleepPrediction.self, forKey: .sleepPrediction)
        babyId = try container.decode(String.self, forKey: .babyId)
        babyName = try container.decode(String.self, forKey: .babyName)
        activities = try container.decode(WidgetActivityData.self, forKey: .activities)
        let singular = try container.decodeIfPresent(ActiveTimerData.self, forKey: .activeTimer)
        let array = try container.decodeIfPresent([ActiveTimerData].self, forKey: .activeTimers)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)

        if let array {
            guard singular == array.first else {
                throw DecodingError.dataCorruptedError(
                    forKey: .activeTimer,
                    in: container,
                    debugDescription: "activeTimer must equal the first canonical activeTimers entry"
                )
            }
            activeTimers = array
            activeTimer = array.first
        } else {
            activeTimers = singular.map { [$0] } ?? []
            activeTimer = singular
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(schemaVersion, forKey: .schemaVersion)
        try container.encodeIfPresent(serverAsOf, forKey: .serverAsOf)
        try container.encodeIfPresent(timezone, forKey: .timezone)
        try container.encodeIfPresent(localDay, forKey: .localDay)
        try container.encodeIfPresent(localAsOf, forKey: .localAsOf)
        try container.encodeIfPresent(timeFormat, forKey: .timeFormat)
        try container.encodeIfPresent(sleepPrediction, forKey: .sleepPrediction)
        try container.encode(babyId, forKey: .babyId)
        try container.encode(babyName, forKey: .babyName)
        try container.encode(activities, forKey: .activities)
        try container.encodeIfPresent(activeTimer, forKey: .activeTimer)
        try container.encode(activeTimers ?? [], forKey: .activeTimers)
        try container.encode(updatedAt, forKey: .updatedAt)
    }

    func getActiveTimer(for type: ActivityType) -> ActiveTimerData? {
        if let timers = activeTimers, !timers.isEmpty {
            return timers.first { $0.type == type.rawValue }
        }
        if let timer = activeTimer, timer.type == type.rawValue {
            return timer
        }
        return nil
    }

    func hasActiveTimer(for type: ActivityType) -> Bool {
        getActiveTimer(for: type) != nil
    }

    func isRemoteTimer(for type: ActivityType) -> Bool {
        getActiveTimer(for: type)?.isRemote == true
    }

    func isTimerPaused(for type: ActivityType) -> Bool {
        getActiveTimer(for: type)?.isPaused == true
    }

    func canPresentWakeWindow(newbornNapOptIn: Bool) -> Bool {
        activities.sleep.wakeWindowRequiresNewbornOptIn != true || newbornNapOptIn
    }

    func canPresentSleepDerivedTiming(pendingSleepStopAt: String?) -> Bool {
        guard let pendingSleepStopAt,
              let pendingStopDate = parseWidgetSnapshotTimestamp(pendingSleepStopAt) else {
            return true
        }
        guard let lastSleepEndedAt = activities.sleep.lastSleepEndedAt,
              let lastSleepEndDate = parseWidgetSnapshotTimestamp(lastSleepEndedAt) else {
            return false
        }
        return lastSleepEndDate >= pendingStopDate
    }
}

func parseWidgetSnapshotTimestamp(_ value: String) -> Date? {
    let fractionalFormatter = ISO8601DateFormatter()
    fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractionalFormatter.date(from: value) {
        return date
    }
    return ISO8601DateFormatter().date(from: value)
}

func isWidgetSleepPredictionCurrent(
    _ prediction: WidgetSleepPrediction,
    now: Date
) -> Bool {
    guard prediction.state == "nextNap" || prediction.state == "bedtime" else {
        return true
    }
    guard let predictedAt = prediction.predictedAt.flatMap(parseWidgetSnapshotTimestamp) else {
        return false
    }
    return predictedAt > now
}

enum WidgetSnapshotKind: Equatable {
    case legacy
    case local
    case versioned
}

struct DecodedWidgetSnapshot {
    let kind: WidgetSnapshotKind
    let data: WidgetDataModel
}

enum WidgetSnapshotError: Error, Equatable {
    case incompatibleVersion
    case wrongBaby
    case semanticFailure
}

enum WidgetSnapshotDecoder {
    private static let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func decodeCache(_ bytes: Data) throws -> DecodedWidgetSnapshot {
        var data = try JSONDecoder().decode(WidgetDataModel.self, from: bytes)
        if let version = data.schemaVersion {
            guard version == 1 else { throw WidgetSnapshotError.incompatibleVersion }
            try validateVersioned(data, expectedBabyId: data.babyId)
            return DecodedWidgetSnapshot(kind: .versioned, data: data)
        }
        data.activities.sleep.napCountToday = data.activities.sleep.napCountToday ?? 0
        data.activities.sleep.morningConfirmationPending =
            data.activities.sleep.morningConfirmationPending ?? false
        if data.localAsOf != nil {
            return DecodedWidgetSnapshot(kind: .local, data: data)
        }
        return DecodedWidgetSnapshot(kind: .legacy, data: data)
    }

    static func decodeNetwork(_ bytes: Data, expectedBabyId: String) throws -> WidgetDataModel {
        let data: WidgetDataModel
        do {
            data = try JSONDecoder().decode(WidgetDataModel.self, from: bytes)
        } catch {
            throw WidgetSnapshotError.semanticFailure
        }
        try validateVersioned(data, expectedBabyId: expectedBabyId)
        return data
    }

    private static func validateVersioned(
        _ data: WidgetDataModel,
        expectedBabyId: String
    ) throws {
        guard data.schemaVersion == 1 else { throw WidgetSnapshotError.incompatibleVersion }
        guard data.babyId == expectedBabyId else { throw WidgetSnapshotError.wrongBaby }
        guard let serverAsOf = data.serverAsOf,
              let timezone = data.timezone,
              !timezone.isEmpty,
              let localDay = data.localDay,
              formatter.date(from: serverAsOf) != nil,
              let localDayStart = formatter.date(from: localDay.startedAt),
              let localDayEnd = formatter.date(from: localDay.endsAt),
              localDayStart < localDayEnd,
              data.activities.sleep.napCountToday != nil,
              data.activities.sleep.morningConfirmationPending != nil,
              data.updatedAt == serverAsOf else {
            throw WidgetSnapshotError.semanticFailure
        }

        if let prediction = data.sleepPrediction {
            let isEmptyState = prediction.state == "blank" || prediction.state == "nighttime"
            let isTimedState = prediction.state == "nextNap" || prediction.state == "bedtime"
            guard (isEmptyState && prediction.predictedAt == nil)
                    || (isTimedState
                        && prediction.predictedAt.flatMap(parseWidgetSnapshotTimestamp) != nil) else {
                throw WidgetSnapshotError.semanticFailure
            }
        }

        let timers = data.activeTimers ?? []
        guard Set(timers.map(\.type)).count == timers.count,
              data.activeTimer == timers.first,
              data.activities.sleep.isActive == timers.contains(where: { $0.type == "sleep" }) else {
            throw WidgetSnapshotError.semanticFailure
        }
    }
}

struct WidgetSnapshotIdentity: Equatable, Sendable {
    let accountId: String
    let babyId: String
    let generation: String
    let timezone: String
}

protocol WidgetSnapshotStoring: Sendable {
    func readSnapshot(for babyId: String) -> Data?
    func readLegacySnapshot() -> Data?
    func writeSnapshot(_ bytes: Data, for babyId: String) throws
    func isCacheOrphaned() -> Bool
}

enum WidgetSnapshotSelector {
    static func snapshotBytes(
        identity: WidgetSnapshotIdentity?,
        store: WidgetSnapshotStoring
    ) -> Data? {
        guard let identity else {
            return store.readLegacySnapshot()
        }
        return store.readSnapshot(for: identity.babyId)
    }

    /// Strip live timers and the running-sleep flag from a cached snapshot before rendering it
    /// without credentials. A timer that was running at sign-out otherwise ticks forever on the
    /// Home Screen with no in-app action able to clear it.
    static func sanitizeCredentialless(_ data: WidgetDataModel) -> WidgetDataModel {
        var credentialless = data
        credentialless.activeTimers = []
        credentialless.activeTimer = nil
        credentialless.activities.sleep.isActive = false
        return credentialless
    }

    /// Render a credentialless snapshot. A live accountless cache (not orphaned) keeps its
    /// running timer; a cache left behind by a departed signed-in session (orphaned) is stripped
    /// so its timers do not tick forever.
    static func credentiallessModel(
        _ data: WidgetDataModel,
        cacheOrphaned: Bool
    ) -> WidgetDataModel {
        cacheOrphaned ? sanitizeCredentialless(data) : data
    }
}

protocol WidgetSnapshotIdentityReading: Sendable {
    func currentIdentity() -> WidgetSnapshotIdentity?
}

protocol WidgetSnapshotFetching: Sendable {
    func fetchSnapshot(for identity: WidgetSnapshotIdentity) async throws -> Data
}

/// Reads pending widget stop commands so the timer-list merge can drop a
/// locally-known timer the user has already stopped from the widget surface.
/// `activityType` values are DB column names (e.g. `"tummy_time"`).
protocol WidgetSnapshotPendingStopReading: Sendable {
    func pendingStopActivityTypes(for babyId: String) -> Set<String>
}

struct EmptyPendingStopReader: WidgetSnapshotPendingStopReading {
    func pendingStopActivityTypes(for babyId: String) -> Set<String> { [] }
}

private struct WidgetSnapshotRefreshOutcome {
    let data: WidgetDataModel?
    let displayChanged: Bool
}

actor WidgetSnapshotCoordinator {
    private let store: WidgetSnapshotStoring
    private let identityReader: WidgetSnapshotIdentityReading
    private let fetcher: WidgetSnapshotFetching
    private let pendingStopReader: WidgetSnapshotPendingStopReading
    private let reload: @Sendable () -> Void
    private var inFlight: [String: Task<WidgetSnapshotRefreshOutcome, Never>] = [:]

    init(
        store: WidgetSnapshotStoring,
        identityReader: WidgetSnapshotIdentityReading,
        fetcher: WidgetSnapshotFetching,
        pendingStopReader: WidgetSnapshotPendingStopReading = EmptyPendingStopReader(),
        reload: @escaping @Sendable () -> Void
    ) {
        self.store = store
        self.identityReader = identityReader
        self.fetcher = fetcher
        self.pendingStopReader = pendingStopReader
        self.reload = reload
    }

    func refresh(
        for babyId: String,
        reloadTimelines: Bool = true
    ) async -> WidgetDataModel? {
        if let existing = inFlight[babyId] {
            let outcome = await existing.value
            if reloadTimelines && outcome.displayChanged {
                reload()
            }
            return outcome.data
        }

        let store = self.store
        let identityReader = self.identityReader
        let fetcher = self.fetcher
        let pendingStopReader = self.pendingStopReader
        let task = Task<WidgetSnapshotRefreshOutcome, Never> {
            await Self.performRefresh(
                for: babyId,
                store: store,
                identityReader: identityReader,
                fetcher: fetcher,
                pendingStopReader: pendingStopReader
            )
        }
        inFlight[babyId] = task
        let outcome = await task.value
        inFlight[babyId] = nil
        if reloadTimelines && outcome.displayChanged {
            reload()
        }
        return outcome.data
    }

    private static func performRefresh(
        for babyId: String,
        store: WidgetSnapshotStoring,
        identityReader: WidgetSnapshotIdentityReading,
        fetcher: WidgetSnapshotFetching,
        pendingStopReader: WidgetSnapshotPendingStopReading
    ) async -> WidgetSnapshotRefreshOutcome {
        let priorBytes = store.readSnapshot(for: babyId)
        let prior = priorBytes.flatMap { try? WidgetSnapshotDecoder.decodeCache($0).data }

        guard let capturedIdentity = identityReader.currentIdentity(),
              capturedIdentity.babyId == babyId else {
            return WidgetSnapshotRefreshOutcome(data: prior, displayChanged: false)
        }

        do {
            let responseBytes = try await fetcher.fetchSnapshot(for: capturedIdentity)
            let response = try WidgetSnapshotDecoder.decodeNetwork(
                responseBytes,
                expectedBabyId: babyId
            )

            guard identityReader.currentIdentity() == capturedIdentity else {
                return WidgetSnapshotRefreshOutcome(data: prior, displayChanged: false)
            }
            guard !isOlder(response, than: prior) else {
                return WidgetSnapshotRefreshOutcome(data: prior, displayChanged: false)
            }

            var merged = response
            merged.timeFormat = prior?.timeFormat ?? response.timeFormat
            merged.sleepPrediction = prior?.sleepPrediction ?? response.sleepPrediction
            let pendingStopTypes = pendingStopReader.pendingStopActivityTypes(for: babyId)
            let mergeResult = mergeTimers(
                prior: prior,
                into: response,
                pendingStopTypes: pendingStopTypes
            )
            let mergedTimerList = mergeResult.list
            merged.activeTimers = mergedTimerList
            merged.activeTimer = mergedTimerList.first
            merged.activities.sleep.isActive = mergedTimerList.contains { $0.type == "sleep" }
            // Carry the local freshness stamp forward when a locally-known timer
            // was preserved, so survival is not single-shot across refreshes.
            if mergeResult.preservedLocal, let priorLocalAsOf = prior?.localAsOf {
                merged.localAsOf = priorLocalAsOf
            }

            let mergedBytes: Data
            if mergedTimerList == (response.activeTimers ?? []),
               merged.timeFormat == response.timeFormat,
               merged.sleepPrediction == response.sleepPrediction {
                mergedBytes = responseBytes
            } else {
                mergedBytes = try JSONEncoder().encode(merged)
            }

            if mergedBytes == priorBytes {
                return WidgetSnapshotRefreshOutcome(data: merged, displayChanged: false)
            }

            let shouldReload = !isDisplayEquivalent(merged, to: prior)
            try store.writeSnapshot(mergedBytes, for: babyId)
            return WidgetSnapshotRefreshOutcome(
                data: merged,
                displayChanged: shouldReload
            )
        } catch {
            return WidgetSnapshotRefreshOutcome(data: prior, displayChanged: false)
        }
    }

    private static func isOlder(
        _ candidate: WidgetDataModel,
        than cached: WidgetDataModel?
    ) -> Bool {
        guard let candidateValue = candidate.serverAsOf,
              let cachedValue = cached?.serverAsOf else {
            return false
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let candidateDate = formatter.date(from: candidateValue),
              let cachedDate = formatter.date(from: cachedValue) else {
            return true
        }
        return candidateDate < cachedDate
    }

    private struct MergeResult {
        let list: [ActiveTimerData]
        let preservedLocal: Bool
    }

    /// Merge the timer list instead of replacing it: server-owned removals apply
    /// (a remote/server timer missing from the response is dropped), but a
    /// locally-known timer survives when it can have no server row
    /// (lockState accountless/offline) or when the app wrote it after the server
    /// snapshot (prior.localAsOf newer than response.serverAsOf). A locally-known
    /// timer with a pending widget stop command for its type is dropped so the
    /// widget's own Stop button can clear it.
    private static func mergeTimers(
        prior: WidgetDataModel?,
        into response: WidgetDataModel,
        pendingStopTypes: Set<String>
    ) -> MergeResult {
        var result = response.activeTimers ?? []
        var presentTypes = Set(result.map { $0.type })
        let responseAsOf = response.serverAsOf.flatMap { parseWidgetSnapshotTimestamp($0) }
        let priorAsOf = prior?.localAsOf.flatMap { parseWidgetSnapshotTimestamp($0) }
        var preservedLocal = false
        for priorTimer in prior?.activeTimers ?? [] {
            if presentTypes.contains(priorTimer.type) { continue }
            if priorTimer.isRemote == true { continue }
            if pendingStopTypes.contains(dbActivityType(for: priorTimer.type)) { continue }
            let lockState = priorTimer.lockState
            if lockState == "accountless" || lockState == "offline" {
                result.append(priorTimer)
                presentTypes.insert(priorTimer.type)
                preservedLocal = true
                continue
            }
            if let local = priorAsOf, let server = responseAsOf, local > server {
                result.append(priorTimer)
                presentTypes.insert(priorTimer.type)
                preservedLocal = true
            }
        }
        return MergeResult(list: result, preservedLocal: preservedLocal)
    }

    private static func dbActivityType(for type: String) -> String {
        type == "tummyTime" ? "tummy_time" : type
    }

    private static func isDisplayEquivalent(
        _ candidate: WidgetDataModel,
        to cached: WidgetDataModel?
    ) -> Bool {
        guard var cached else { return false }
        var candidate = candidate
        candidate.serverAsOf = nil
        candidate.updatedAt = ""
        cached.serverAsOf = nil
        cached.updatedAt = ""
        return candidate == cached
    }
}
