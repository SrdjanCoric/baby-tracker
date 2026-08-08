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
}

struct WidgetLocalDay: Codable, Equatable {
    var startedAt: String
    var endsAt: String
}

struct WidgetDataModel: Codable, Equatable {
    var schemaVersion: Int?
    var serverAsOf: String?
    var timezone: String?
    var localDay: WidgetLocalDay?
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
}

enum WidgetSnapshotKind: Equatable {
    case legacy
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
        let data = try JSONDecoder().decode(WidgetDataModel.self, from: bytes)
        if let version = data.schemaVersion {
            guard version == 1 else { throw WidgetSnapshotError.incompatibleVersion }
            try validateVersioned(data, expectedBabyId: data.babyId)
            return DecodedWidgetSnapshot(kind: .versioned, data: data)
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
              data.updatedAt == serverAsOf else {
            throw WidgetSnapshotError.semanticFailure
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
    func writeSnapshot(_ bytes: Data, for babyId: String) throws
}

protocol WidgetSnapshotIdentityReading: Sendable {
    func currentIdentity() -> WidgetSnapshotIdentity?
}

protocol WidgetSnapshotFetching: Sendable {
    func fetchSnapshot(for identity: WidgetSnapshotIdentity) async throws -> Data
}

private struct WidgetSnapshotRefreshOutcome {
    let data: WidgetDataModel?
    let displayChanged: Bool
}

actor WidgetSnapshotCoordinator {
    private let store: WidgetSnapshotStoring
    private let identityReader: WidgetSnapshotIdentityReading
    private let fetcher: WidgetSnapshotFetching
    private let reload: @Sendable () -> Void
    private var inFlight: [String: Task<WidgetSnapshotRefreshOutcome, Never>] = [:]

    init(
        store: WidgetSnapshotStoring,
        identityReader: WidgetSnapshotIdentityReading,
        fetcher: WidgetSnapshotFetching,
        reload: @escaping @Sendable () -> Void
    ) {
        self.store = store
        self.identityReader = identityReader
        self.fetcher = fetcher
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
        let task = Task<WidgetSnapshotRefreshOutcome, Never> {
            await Self.performRefresh(
                for: babyId,
                store: store,
                identityReader: identityReader,
                fetcher: fetcher
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
        fetcher: WidgetSnapshotFetching
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
            if responseBytes == priorBytes {
                return WidgetSnapshotRefreshOutcome(data: response, displayChanged: false)
            }

            let shouldReload = !isDisplayEquivalent(response, to: prior)
            try store.writeSnapshot(responseBytes, for: babyId)
            return WidgetSnapshotRefreshOutcome(
                data: response,
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
