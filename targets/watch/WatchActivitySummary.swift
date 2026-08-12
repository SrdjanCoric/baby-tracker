import Foundation

struct WatchSummaryActivityData: Codable, Equatable {
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

struct WatchSummaryTimer: Codable, Equatable, Hashable {
    var type: String
    var startTime: String
    var timerInstanceId: String?
    var context: String?
    var isRemote: Bool?
    var isPaused: Bool?
    var accumulatedSeconds: Int?
    var lockState: String? = nil
}

struct WatchSummaryLocalDay: Codable, Equatable {
    var startedAt: String
    var endsAt: String
}

struct WatchSummaryData: Codable, Equatable {
    var schemaVersion: Int?
    var serverAsOf: String?
    var timezone: String?
    var localDay: WatchSummaryLocalDay?
    var localAsOf: String?
    var babyId: String
    var babyName: String
    var activities: WatchSummaryActivityData
    var activeTimer: WatchSummaryTimer?
    var activeTimers: [WatchSummaryTimer]?
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case schemaVersion
        case serverAsOf
        case timezone
        case localDay
        case localAsOf
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
        localDay: WatchSummaryLocalDay? = nil,
        localAsOf: String? = nil,
        babyId: String,
        babyName: String,
        activities: WatchSummaryActivityData,
        activeTimer: WatchSummaryTimer?,
        activeTimers: [WatchSummaryTimer]?,
        updatedAt: String
    ) {
        self.schemaVersion = schemaVersion
        self.serverAsOf = serverAsOf
        self.timezone = timezone
        self.localDay = localDay
        self.localAsOf = localAsOf
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
        localDay = try container.decodeIfPresent(WatchSummaryLocalDay.self, forKey: .localDay)
        localAsOf = try container.decodeIfPresent(String.self, forKey: .localAsOf)
        babyId = try container.decode(String.self, forKey: .babyId)
        babyName = try container.decode(String.self, forKey: .babyName)
        activities = try container.decode(WatchSummaryActivityData.self, forKey: .activities)
        let singular = try container.decodeIfPresent(WatchSummaryTimer.self, forKey: .activeTimer)
        let array = try container.decodeIfPresent([WatchSummaryTimer].self, forKey: .activeTimers)
        updatedAt = try container.decode(String.self, forKey: .updatedAt)
        if let array {
            guard singular == array.first else {
                throw DecodingError.dataCorruptedError(
                    forKey: .activeTimer,
                    in: container,
                    debugDescription: "activeTimer must equal the first activeTimers entry"
                )
            }
            activeTimers = array
            activeTimer = array.first
        } else {
            activeTimers = singular.map { [$0] } ?? []
            activeTimer = singular
        }
    }
}

private struct WatchLegacyMultiBabyEnvelope: Decodable {
    let babies: [Baby]
    let selectedBabyId: String
    let localAsOf: String?
    let updatedAt: String

    struct Baby: Decodable {
        let id: String
        let name: String
        let activities: WatchSummaryActivityData
        let activeTimers: [WatchSummaryTimer]
    }

    func summary(for babyId: String) -> WatchSummaryData? {
        guard selectedBabyId == babyId,
              let baby = babies.first(where: { $0.id == babyId }) else {
            return nil
        }
        return WatchSummaryData(
            localAsOf: localAsOf,
            babyId: baby.id,
            babyName: baby.name,
            activities: baby.activities,
            activeTimer: baby.activeTimers.first,
            activeTimers: baby.activeTimers,
            updatedAt: updatedAt
        )
    }
}

enum WatchSummaryKind: Equatable {
    case legacy
    case local
    case versioned
}

struct DecodedWatchSummary {
    let kind: WatchSummaryKind
    let data: WatchSummaryData
}

enum WatchSummaryError: Error, Equatable {
    case incompatibleVersion
    case wrongBaby
    case semanticFailure
}

enum WatchSummaryTransportError: Error, Equatable {
    case missingCredentials
    case invalidURL
    case unauthorized
    case unsuccessfulResponse
}

enum WatchSummaryDecoder {
    private static let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static func decodeCache(_ bytes: Data) throws -> DecodedWatchSummary {
        var data = try JSONDecoder().decode(WatchSummaryData.self, from: bytes)
        if data.schemaVersion != nil {
            try validateVersioned(data, expectedBabyId: data.babyId)
            return DecodedWatchSummary(kind: .versioned, data: data)
        }
        data.activities.sleep.napCountToday = data.activities.sleep.napCountToday ?? 0
        data.activities.sleep.morningConfirmationPending =
            data.activities.sleep.morningConfirmationPending ?? false
        if data.localAsOf != nil {
            return DecodedWatchSummary(kind: .local, data: data)
        }
        return DecodedWatchSummary(kind: .legacy, data: data)
    }

    static func decodeNetwork(_ bytes: Data, expectedBabyId: String) throws -> WatchSummaryData {
        let data: WatchSummaryData
        do {
            data = try JSONDecoder().decode(WatchSummaryData.self, from: bytes)
        } catch {
            throw WatchSummaryError.semanticFailure
        }
        try validateVersioned(data, expectedBabyId: expectedBabyId)
        return data
    }

    private static func validateVersioned(
        _ data: WatchSummaryData,
        expectedBabyId: String
    ) throws {
        guard data.schemaVersion == 1 else { throw WatchSummaryError.incompatibleVersion }
        guard data.babyId == expectedBabyId else { throw WatchSummaryError.wrongBaby }
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
            throw WatchSummaryError.semanticFailure
        }
        let timers = data.activeTimers ?? []
        guard Set(timers.map(\.type)).count == timers.count,
              data.activeTimer == timers.first,
              data.activities.sleep.isActive == timers.contains(where: { $0.type == "sleep" }) else {
            throw WatchSummaryError.semanticFailure
        }
    }
}

struct WatchTimerFingerprint: Equatable, Sendable {
    private let timers: [WatchSummaryTimer]

    init(timers: [WatchSummaryTimer]) {
        self.timers = timers.map { timer in
            var normalized = timer
            normalized.lockState = nil
            if normalized.isRemote == true {
                normalized.context = nil
            }
            return normalized
        }.sorted {
            ($0.timerInstanceId ?? $0.type, $0.type) < ($1.timerInstanceId ?? $1.type, $1.type)
        }
    }
}

enum WatchTimerProbeDecoder {
    private struct RemoteTimer: Decodable {
        let activityType: String
        let startedBy: String
        let startedAt: String
        let timerData: TimerDataPayload?

        enum CodingKeys: String, CodingKey {
            case activityType = "activity_type"
            case startedBy = "started_by"
            case startedAt = "started_at"
            case timerData = "timer_data"
        }

        struct TimerDataPayload: Decodable {
            let side: String?
            let sleepType: String?
            let type: String?
            let isPaused: Bool?
            let accumulatedSeconds: Int?
            let timerInstanceId: String?
        }
    }

    private static let parser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    static func decode(_ bytes: Data, currentUserId: String) throws -> [WatchSummaryTimer] {
        let rows = try JSONDecoder().decode([RemoteTimer].self, from: bytes)
        return try rows.compactMap { row in
            let watchType: String
            switch row.activityType {
            case "feeding", "sleep", "pumping": watchType = row.activityType
            case "tummy_time": watchType = "tummyTime"
            default: return nil
            }
            guard let startedAt = parser.date(from: row.startedAt) else {
                throw WatchSummaryError.semanticFailure
            }
            return WatchSummaryTimer(
                type: watchType,
                startTime: formatter.string(from: startedAt),
                timerInstanceId: row.timerData?.timerInstanceId,
                context: row.timerData?.side ?? row.timerData?.sleepType ??
                    (row.activityType == "sleep" ? row.timerData?.type : nil),
                isRemote: row.startedBy != currentUserId,
                isPaused: row.timerData?.isPaused ?? false,
                accumulatedSeconds: row.timerData?.accumulatedSeconds
            )
        }
    }
}

enum WatchAccountCachePurger {
    private static let fixedKeys: Set<String> = [
        "multiBabyWatchData",
        "watchData",
        "widgetData",
        "watchLegacyCacheAccountId"
    ]
    private static let scopedPrefixes = [
        "watchSummary.",
        "watchPendingOverlays.",
        "watchOptimisticState."
    ]

    static func purge(from defaults: UserDefaults) {
        for key in defaults.dictionaryRepresentation().keys
        where fixedKeys.contains(key) || scopedPrefixes.contains(where: key.hasPrefix) {
            defaults.removeObject(forKey: key)
        }
    }
}

enum WatchLegacyCredentialPurger {
    static func purge(from defaults: UserDefaults) {
        defaults.removeObject(forKey: "watchSupabaseAccessToken")
    }
}

enum WatchAccountScopeInstaller {
    static func install(
        accountId: String,
        householdId: String?,
        in defaults: UserDefaults
    ) -> Bool {
        let storedAccountId = defaults.string(forKey: "watchSupabaseUserId")
        let storedHouseholdId = defaults.string(forKey: "watchHouseholdId")
        let scopeChanged = (storedAccountId != nil && storedAccountId != accountId) ||
            (storedHouseholdId != nil && storedHouseholdId != householdId)
        if scopeChanged {
            WatchAccountCachePurger.purge(from: defaults)
        }
        defaults.set(accountId, forKey: "watchSupabaseUserId")
        if let householdId {
            defaults.set(householdId, forKey: "watchHouseholdId")
        } else {
            defaults.removeObject(forKey: "watchHouseholdId")
        }
        return scopeChanged
    }
}

enum WatchNetworkCredentialPolicy {
    static func canRequest(
        hasConfig: Bool,
        hasUser: Bool,
        hasSession: Bool,
        isStale: Bool
    ) -> Bool {
        hasConfig && hasUser && hasSession && !isStale
    }
}

enum WatchNetworkPollingPolicy {
    static func interval(isPhoneReachable: Bool) -> TimeInterval {
        isPhoneReachable ? 600 : 120
    }
}

enum WatchAuthenticatedRequestCoordinator {
    static func send<Response>(
        perform: () async throws -> (Int, Response),
        recoverUnauthorized: () async -> Void
    ) async rethrows -> (Int, Response) {
        let result = try await perform()
        if result.0 == 401 {
            await recoverUnauthorized()
        }
        return result
    }
}

enum WatchCredentialContextPolicy {
    static func shouldMarkStale(
        hasIncomingCapsule: Bool,
        hasStoredSession: Bool
    ) -> Bool {
        !hasIncomingCapsule && !hasStoredSession
    }

    static func shouldRemoveStoredSession(
        scopeChanged: Bool,
        hasIncomingCapsule: Bool
    ) -> Bool {
        scopeChanged && hasIncomingCapsule
    }
}

enum WatchCredentialContextInstaller {
    static func install(
        supabaseUrl: String,
        anonKey: String,
        accountId: String,
        householdId: String?,
        in defaults: UserDefaults,
        installCapsule: () throws -> Void
    ) -> Bool {
        defaults.set(supabaseUrl, forKey: "watchSupabaseUrl")
        defaults.set(anonKey, forKey: "watchSupabaseAnonKey")
        defaults.set(accountId, forKey: "watchSupabaseUserId")
        if let householdId {
            defaults.set(householdId, forKey: "watchHouseholdId")
        } else {
            defaults.removeObject(forKey: "watchHouseholdId")
        }
        do {
            try installCapsule()
            return true
        } catch {
            return false
        }
    }
}

enum WatchLegacyCacheOwnership {
    private static let key = "watchLegacyCacheAccountId"

    static func canRead(accountId: String, from defaults: UserDefaults) -> Bool {
        defaults.string(forKey: key) == accountId
    }

    static func mark(accountId: String, in defaults: UserDefaults) {
        defaults.set(accountId, forKey: key)
    }
}

enum WatchMainThreadDispatcher {
    static func dispatch(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }
}

struct WatchSummaryIdentity: Equatable, Sendable {
    let accountId: String
    let babyId: String
    let generation: String
    let timezone: String

    var cacheKey: String { "\(accountId).\(babyId)" }
}

protocol WatchSummaryStoring: Sendable {
    func readSummary(for identity: WatchSummaryIdentity) -> Data?
    func writeSummary(_ bytes: Data, for identity: WatchSummaryIdentity) throws
    func readOverlays(for identity: WatchSummaryIdentity) -> [WatchOptimisticOverlay]
    func writeOverlays(_ overlays: [WatchOptimisticOverlay], for identity: WatchSummaryIdentity) throws
}

extension WatchSummaryStoring {
    func readOverlays(for identity: WatchSummaryIdentity) -> [WatchOptimisticOverlay] { [] }
    func writeOverlays(_ overlays: [WatchOptimisticOverlay], for identity: WatchSummaryIdentity) throws {}
}

protocol WatchSummaryIdentityReading: Sendable {
    func currentIdentity() -> WatchSummaryIdentity?
}

protocol WatchSummaryFetching: Sendable {
    func fetchSummary(for identity: WatchSummaryIdentity) async throws -> Data
}

enum WatchSummaryRefreshTrigger: String, CaseIterable, Sendable {
    case activation
    case explicit
    case postAction
    case reachability
}

enum WatchOverlayAction: String, Codable, Sendable {
    case start
    case pause
    case resume
    case stop
}

struct WatchOptimisticOverlay: Codable, Equatable, Sendable {
    let accountId: String
    let babyId: String
    let requestId: String
    let timerInstanceId: String
    let activityId: String
    let activityType: String
    let action: WatchOverlayAction
    let requestedAt: String
}

actor WatchSummaryCoordinator {
    private let store: WatchSummaryStoring
    private let identityReader: WatchSummaryIdentityReading
    private let fetcher: WatchSummaryFetching
    private let reload: () -> Void
    private let requestCredentials: () -> Void
    private var overlaysByScope: [String: [WatchOptimisticOverlay]] = [:]
    private var loadedOverlayScopes: Set<String> = []
    private var inFlightFetches: [String: Task<Data, Error>] = [:]

    init(
        store: WatchSummaryStoring,
        identityReader: WatchSummaryIdentityReading,
        fetcher: WatchSummaryFetching,
        reload: @escaping () -> Void,
        requestCredentials: @escaping () -> Void = {}
    ) {
        self.store = store
        self.identityReader = identityReader
        self.fetcher = fetcher
        self.reload = reload
        self.requestCredentials = requestCredentials
    }

    func acceptTimerProbe(_ fingerprint: WatchTimerFingerprint) async -> WatchSummaryData? {
        guard let identity = identityReader.currentIdentity() else { return nil }
        let priorBytes = store.readSummary(for: identity)
        let prior = priorBytes.flatMap { try? WatchSummaryDecoder.decodeCache($0).data }
        if let prior,
           WatchTimerFingerprint(timers: prior.activeTimers ?? []) == fingerprint {
            return prior
        }

        do {
            let responseBytes = try await fetchCoalesced(for: identity)
            let response = try WatchSummaryDecoder.decodeNetwork(
                responseBytes,
                expectedBabyId: identity.babyId
            )
            guard identityReader.currentIdentity() == identity else {
                return prior
            }
            let currentBytes = store.readSummary(for: identity)
            let current = currentBytes.flatMap { try? WatchSummaryDecoder.decodeCache($0).data }
            guard WatchTimerFingerprint(timers: response.activeTimers ?? []) == fingerprint,
                  !isOlder(response, than: current) else {
                return current
            }
            let installed = try mergeNetworkResponse(
                response,
                responseBytes: responseBytes,
                with: current,
                identity: identity
            )
            if installed.bytes != currentBytes {
                try store.writeSummary(installed.bytes, for: identity)
                reload()
            }
            reconcileOverlays(with: response, previous: current, identity: identity)
            return installed.data
        } catch WatchSummaryTransportError.unauthorized {
            requestCredentials()
            return prior
        } catch {
            return prior
        }
    }

    func refresh(trigger: WatchSummaryRefreshTrigger) async -> WatchSummaryData? {
        guard let identity = identityReader.currentIdentity() else { return nil }
        let priorBytes = store.readSummary(for: identity)
        let prior = priorBytes.flatMap { try? WatchSummaryDecoder.decodeCache($0).data }
        do {
            let responseBytes = try await fetchCoalesced(for: identity)
            let response = try WatchSummaryDecoder.decodeNetwork(
                responseBytes,
                expectedBabyId: identity.babyId
            )
            guard identityReader.currentIdentity() == identity else {
                return prior
            }
            let currentBytes = store.readSummary(for: identity)
            let current = currentBytes.flatMap { try? WatchSummaryDecoder.decodeCache($0).data }
            guard !isOlder(response, than: current) else {
                return current
            }
            let installed = try mergeNetworkResponse(
                response,
                responseBytes: responseBytes,
                with: current,
                identity: identity
            )
            if installed.bytes != currentBytes {
                try store.writeSummary(installed.bytes, for: identity)
                reload()
            }
            reconcileOverlays(with: response, previous: current, identity: identity)
            return installed.data
        } catch WatchSummaryTransportError.unauthorized {
            requestCredentials()
            return prior
        } catch {
            return prior
        }
    }

    func recordOverlay(_ overlay: WatchOptimisticOverlay) {
        guard let identity = identityReader.currentIdentity(),
              identity.accountId == overlay.accountId,
              identity.babyId == overlay.babyId else {
            return
        }
        loadOverlaysIfNeeded(for: identity)
        var overlays = overlaysByScope[identity.cacheKey] ?? []
        overlays.removeAll { $0.requestId == overlay.requestId }
        overlays.append(overlay)
        overlaysByScope[identity.cacheKey] = overlays
        try? store.writeOverlays(overlays, for: identity)
    }

    func acknowledge(requestId: String) {
        guard let identity = identityReader.currentIdentity() else { return }
        loadOverlaysIfNeeded(for: identity)
        overlaysByScope[identity.cacheKey]?.removeAll { $0.requestId == requestId }
        try? store.writeOverlays(overlaysByScope[identity.cacheKey] ?? [], for: identity)
    }

    func pendingOverlays(for identity: WatchSummaryIdentity) -> [WatchOptimisticOverlay] {
        loadOverlaysIfNeeded(for: identity)
        return overlaysByScope[identity.cacheKey] ?? []
    }

    func acceptPhonePayload(_ bytes: Data) -> WatchSummaryData? {
        guard let identity = identityReader.currentIdentity() else { return nil }
        let priorBytes = store.readSummary(for: identity)
        let priorDecoded = priorBytes.flatMap { try? WatchSummaryDecoder.decodeCache($0) }
        let prior = priorDecoded?.data
        let candidate: DecodedWatchSummary
        let candidateBytes: Data
        if let direct = try? WatchSummaryDecoder.decodeCache(bytes) {
            candidate = direct
            candidateBytes = bytes
        } else if let envelope = try? JSONDecoder().decode(WatchLegacyMultiBabyEnvelope.self, from: bytes),
                  let adapted = envelope.summary(for: identity.babyId),
                  let adaptedBytes = try? JSONEncoder().encode(adapted),
                  let adaptedDecoded = try? WatchSummaryDecoder.decodeCache(adaptedBytes) {
            candidate = adaptedDecoded
            candidateBytes = adaptedBytes
        } else {
            return prior
        }
        guard candidate.data.babyId == identity.babyId else {
            return prior
        }
        if candidate.kind == .legacy, priorDecoded?.kind == .versioned {
            return prior
        }
        var accepted = (data: candidate.data, bytes: candidateBytes)
        if candidate.kind == .versioned {
            guard (try? WatchSummaryDecoder.decodeNetwork(
                candidateBytes,
                expectedBabyId: identity.babyId
            )) != nil,
            !isOlder(candidate.data, than: prior) else {
                return prior
            }
        } else if candidate.kind == .local {
            guard isLocalNewer(candidate.data, than: prior) else {
                return prior
            }
            if priorDecoded?.kind == .versioned,
               let prior,
               let priorBytes {
                guard let merged = try? mergeNetworkResponse(
                    prior,
                    responseBytes: priorBytes,
                    with: candidate.data,
                    identity: identity
                ) else {
                    return prior
                }
                accepted = merged
            }
        } else if isLegacyOlder(candidate.data, than: prior) {
            return prior
        }
        guard identityReader.currentIdentity() == identity else { return prior }
        if accepted.bytes != priorBytes {
            do {
                try store.writeSummary(accepted.bytes, for: identity)
                reload()
            } catch {
                return prior
            }
        }
        if candidate.kind == .versioned {
            reconcileOverlays(with: candidate.data, previous: prior, identity: identity)
        }
        return accepted.data
    }

    private func isOlder(_ candidate: WatchSummaryData, than cached: WatchSummaryData?) -> Bool {
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

    private struct TimerMergeResult {
        let list: [WatchSummaryTimer]
        let preservedLocal: Bool
    }

    private struct TimerIdentity: Hashable {
        let type: String
        let instanceId: String?
    }

    private func mergeNetworkResponse(
        _ response: WatchSummaryData,
        responseBytes: Data,
        with prior: WatchSummaryData?,
        identity: WatchSummaryIdentity
    ) throws -> (data: WatchSummaryData, bytes: Data) {
        var merged = response
        let mergeResult = mergeTimers(
            prior: prior,
            into: response,
            excluding: pendingStopTimers(for: identity)
        )
        merged.activeTimers = mergeResult.list
        merged.activeTimer = mergeResult.list.first
        merged.activities.sleep.isActive = mergeResult.list.contains { $0.type == "sleep" }
        if mergeResult.preservedLocal, let priorLocalAsOf = prior?.localAsOf {
            merged.localAsOf = priorLocalAsOf
        }
        if mergeResult.list == (response.activeTimers ?? []) {
            return (response, responseBytes)
        }
        return (merged, try JSONEncoder().encode(merged))
    }

    private func mergeTimers(
        prior: WatchSummaryData?,
        into response: WatchSummaryData,
        excluding stoppedTimers: Set<TimerIdentity>
    ) -> TimerMergeResult {
        var result = response.activeTimers ?? []
        var presentTypes = Set(result.map(\.type))
        let responseAsOf = response.serverAsOf.flatMap(parseTimestamp)
        let priorAsOf = prior?.localAsOf.flatMap(parseTimestamp)
        var preservedLocal = false
        for priorTimer in prior?.activeTimers ?? [] {
            if presentTypes.contains(priorTimer.type) { continue }
            if stoppedTimers.contains(TimerIdentity(
                type: priorTimer.type,
                instanceId: priorTimer.timerInstanceId
            )) { continue }
            if priorTimer.isRemote == true { continue }
            if priorTimer.lockState == "accountless" || priorTimer.lockState == "offline" {
                var singleShotTimer = priorTimer
                singleShotTimer.lockState = nil
                result.append(singleShotTimer)
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
        return TimerMergeResult(list: result, preservedLocal: preservedLocal)
    }

    private func pendingStopTimers(for identity: WatchSummaryIdentity) -> Set<TimerIdentity> {
        loadOverlaysIfNeeded(for: identity)
        return Set((overlaysByScope[identity.cacheKey] ?? []).compactMap { overlay in
            guard overlay.action == .stop else { return nil }
            return TimerIdentity(type: overlay.activityType, instanceId: overlay.timerInstanceId)
        })
    }

    private func fetchCoalesced(for identity: WatchSummaryIdentity) async throws -> Data {
        let key = "\(identity.cacheKey).\(identity.generation)"
        if let existing = inFlightFetches[key] {
            return try await existing.value
        }
        let fetcher = self.fetcher
        let task = Task {
            try await fetcher.fetchSummary(for: identity)
        }
        inFlightFetches[key] = task
        do {
            let bytes = try await task.value
            inFlightFetches[key] = nil
            return bytes
        } catch {
            inFlightFetches[key] = nil
            throw error
        }
    }

    private func isLegacyOlder(_ candidate: WatchSummaryData, than cached: WatchSummaryData?) -> Bool {
        guard let cached else { return false }
        let formatter = ISO8601DateFormatter()
        guard let candidateDate = formatter.date(from: candidate.updatedAt),
              let cachedDate = formatter.date(from: cached.updatedAt) else {
            return true
        }
        return candidateDate < cachedDate
    }

    private func isLocalNewer(_ candidate: WatchSummaryData, than cached: WatchSummaryData?) -> Bool {
        guard let candidateValue = candidate.localAsOf,
              let candidateDate = parseTimestamp(candidateValue) else {
            return false
        }
        guard let cached else { return true }
        let cachedDates = [cached.localAsOf, cached.serverAsOf, cached.updatedAt]
            .compactMap { $0 }
            .compactMap(parseTimestamp)
        guard let freshestCachedDate = cachedDates.max() else { return false }
        return candidateDate > freshestCachedDate
    }

    private func reconcileOverlays(
        with summary: WatchSummaryData,
        previous: WatchSummaryData?,
        identity: WatchSummaryIdentity
    ) {
        guard let acceptedAtValue = summary.serverAsOf,
              let acceptedAt = parseTimestamp(acceptedAtValue) else {
            return
        }
        let timers = summary.activeTimers ?? []
        let previousTimers = previous?.activeTimers ?? []
        loadOverlaysIfNeeded(for: identity)
        let previousCount = overlaysByScope[identity.cacheKey]?.count ?? 0
        overlaysByScope[identity.cacheKey]?.removeAll { overlay in
            guard let requestedAt = parseTimestamp(overlay.requestedAt),
                  acceptedAt >= requestedAt else {
                return false
            }
            let matchingTimer = timers.first {
                $0.timerInstanceId == overlay.timerInstanceId && $0.type == overlay.activityType
            }
            switch overlay.action {
            case .start:
                return matchingTimer != nil
            case .pause:
                return matchingTimer?.isPaused == true
            case .resume:
                return matchingTimer != nil && matchingTimer?.isPaused != true
            case .stop:
                return matchingTimer == nil && previousTimers.contains {
                    $0.timerInstanceId == overlay.timerInstanceId && $0.type == overlay.activityType
                }
            }
        }
        if overlaysByScope[identity.cacheKey]?.count != previousCount {
            try? store.writeOverlays(overlaysByScope[identity.cacheKey] ?? [], for: identity)
        }
    }

    private func loadOverlaysIfNeeded(for identity: WatchSummaryIdentity) {
        guard !loadedOverlayScopes.contains(identity.cacheKey) else { return }
        overlaysByScope[identity.cacheKey] = store.readOverlays(for: identity)
        loadedOverlayScopes.insert(identity.cacheKey)
    }

    private func parseTimestamp(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
