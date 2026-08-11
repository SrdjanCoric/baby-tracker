import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

// MARK: - Data Models

struct WatchWidgetData: Codable {
    var babyId: String
    var babyName: String
    var activities: WatchActivityData
    var activeTimer: WatchActiveTimer?
    var activeTimers: [WatchActiveTimer]?
    var updatedAt: String
}

struct BabyWatchData: Codable {
    var id: String
    var name: String
    var activities: WatchActivityData
    var activeTimers: [WatchActiveTimer]
}

struct MultiBabyWatchData: Codable {
    var babies: [BabyWatchData]
    var selectedBabyId: String
    var updatedAt: String
}

struct WatchActivityData: Codable {
    var feeding: FeedingData
    var sleep: SleepData
    var diaper: DiaperData
    var pumping: PumpingData
    var tummyTime: TummyTimeData

    struct FeedingData: Codable {
        var lastTime: String?
        var todayCount: Int
        var lastSide: String?
        var lastType: String?
    }

    struct SleepData: Codable {
        var lastTime: String?
        var todayMinutes: Int
        var goalMinutes: Int?
        var lastDurationMinutes: Int?
        var isActive: Bool
        var sleepType: String?
        var wakeWindowMinutes: Int?
        var lastSleepEndedAt: String?
        var napCountToday: Int?
        var morningConfirmationPending: Bool?
    }

    struct DiaperData: Codable {
        var lastTime: String?
        var todayCounts: DiaperCounts

        struct DiaperCounts: Codable {
            var wet: Int
            var dirty: Int
            var mixed: Int
            var dry: Int
        }
    }

    struct PumpingData: Codable {
        var lastTime: String?
        var todayVolumeMl: Int
        var lastSide: String?
        var sessionCount: Int?
    }

    struct TummyTimeData: Codable {
        var lastTime: String?
        var todayMinutes: Int
        var goalMinutes: Int
        var lastDurationMinutes: Int?
    }
}

struct WatchActiveTimer: Codable {
    var type: String
    var startTime: String
    var timerInstanceId: String?
    var activityId: String?
    var context: String?
    var isRemote: Bool?
    var isPaused: Bool?
    var accumulatedSeconds: Int?
    var startedBy: String?
}

// MARK: - Activity Type

enum WatchActivityType: String, CaseIterable {
    case feeding, sleep, diaper, pumping, tummyTime

    var label: String {
        switch self {
        case .feeding: return L.feeding
        case .sleep: return L.sleep
        case .diaper: return L.diaper
        case .pumping: return L.pumping
        case .tummyTime: return L.tummyTime
        }
    }

    var sfSymbol: String {
        switch self {
        case .feeding: return "cup.and.saucer.fill"
        case .sleep: return "moon.fill"
        case .diaper: return "humidity.fill"
        case .pumping: return "drop.fill"
        case .tummyTime: return "figure.play"
        }
    }

    var emoji: String {
        switch self {
        case .feeding: return "🤱"
        case .sleep: return "😴"
        case .diaper: return "🚼"
        case .pumping: return "🫙"
        case .tummyTime: return "💪"
        }
    }

    var primaryColor: Color {
        switch self {
        case .feeding: return Color(red: 0.549, green: 0.702, blue: 0.412)
        case .sleep: return Color(red: 0.620, green: 0.553, blue: 0.663)
        case .diaper: return Color(red: 0.878, green: 0.627, blue: 0.600)
        case .pumping: return Color(red: 0.482, green: 0.639, blue: 0.659)
        case .tummyTime: return Color(red: 0.831, green: 0.647, blue: 0.455)
        }
    }

    var backgroundColor: Color {
        primaryColor.opacity(0.2)
    }

    var hasTimer: Bool {
        switch self {
        case .diaper: return false
        default: return true
        }
    }
}

final class AppGroupWatchSummaryStore: WatchSummaryStoring, @unchecked Sendable {
    private let defaults: UserDefaults

    init?(defaults: UserDefaults? = UserDefaults(suiteName: "group.com.sofibaby.app")) {
        guard let defaults else { return nil }
        self.defaults = defaults
    }

    func readSummary(for identity: WatchSummaryIdentity) -> Data? {
        let scopedKey = "watchSummary.\(identity.cacheKey)"
        if let value = defaults.string(forKey: scopedKey),
           let bytes = value.data(using: .utf8),
           let decoded = try? WatchSummaryDecoder.decodeCache(bytes),
           decoded.data.babyId == identity.babyId {
            return bytes
        }
        if WatchLegacyCacheOwnership.canRead(accountId: identity.accountId, from: defaults) {
            for legacyKey in ["watchData", "widgetData"] {
                if let value = defaults.string(forKey: legacyKey),
                   let bytes = value.data(using: .utf8),
                   let decoded = try? WatchSummaryDecoder.decodeCache(bytes),
                   decoded.data.babyId == identity.babyId {
                    return bytes
                }
            }
        }
        return nil
    }

    func writeSummary(_ bytes: Data, for identity: WatchSummaryIdentity) throws {
        guard let value = String(data: bytes, encoding: .utf8) else {
            throw WatchSummaryError.semanticFailure
        }
        defaults.set(value, forKey: "watchSummary.\(identity.cacheKey)")
        defaults.set(value, forKey: "watchData")
        WatchLegacyCacheOwnership.mark(accountId: identity.accountId, in: defaults)
    }

    func readOverlays(for identity: WatchSummaryIdentity) -> [WatchOptimisticOverlay] {
        guard let value = defaults.string(forKey: "watchPendingOverlays.\(identity.cacheKey)"),
              let bytes = value.data(using: .utf8) else {
            return []
        }
        return (try? JSONDecoder().decode([WatchOptimisticOverlay].self, from: bytes)) ?? []
    }

    func writeOverlays(_ overlays: [WatchOptimisticOverlay], for identity: WatchSummaryIdentity) throws {
        let bytes = try JSONEncoder().encode(overlays)
        guard let value = String(data: bytes, encoding: .utf8) else {
            throw WatchSummaryError.semanticFailure
        }
        defaults.set(value, forKey: "watchPendingOverlays.\(identity.cacheKey)")
    }
}

final class AppGroupWatchSummaryIdentityReader: WatchSummaryIdentityReading, @unchecked Sendable {
    private let defaults: UserDefaults

    init?(defaults: UserDefaults? = UserDefaults(suiteName: "group.com.sofibaby.app")) {
        guard let defaults else { return nil }
        self.defaults = defaults
    }

    func currentIdentity() -> WatchSummaryIdentity? {
        guard let accountId = defaults.string(forKey: "watchSupabaseUserId"),
              let babyId = defaults.string(forKey: "watchSelectedBabyId") else {
            return nil
        }
        let householdId = defaults.string(forKey: "watchHouseholdId") ?? "legacy-household"
        return WatchSummaryIdentity(
            accountId: accountId,
            babyId: babyId,
            generation: householdId,
            timezone: TimeZone.current.identifier
        )
    }
}

final class SupabaseWatchSummaryFetcher: WatchSummaryFetching, @unchecked Sendable {
    private let defaults: UserDefaults
    private let supabaseTransport: WatchSupabaseTransport

    init?(
        defaults: UserDefaults? = UserDefaults(suiteName: "group.com.sofibaby.app"),
        supabaseTransport: WatchSupabaseTransport = WatchSupabaseSessionEnvironment.transport
    ) {
        guard let defaults else { return nil }
        self.defaults = defaults
        self.supabaseTransport = supabaseTransport
    }

    func fetchSummary(for identity: WatchSummaryIdentity) async throws -> Data {
        guard let supabaseUrl = defaults.string(forKey: "watchSupabaseUrl"),
              let anonKey = defaults.string(forKey: "watchSupabaseAnonKey") else {
            throw WatchSummaryTransportError.missingCredentials
        }
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/rpc/get_baby_activity_snapshot") else {
            throw WatchSummaryTransportError.invalidURL
        }
        let body = try JSONSerialization.data(withJSONObject: [
            "p_baby_id": identity.babyId,
            "p_timezone": identity.timezone
        ])
        let config = WatchSupabaseEndpointConfig(supabaseUrl: supabaseUrl, anonKey: anonKey)
        let (status, bytes) = try await supabaseTransport.send(config: config) { token in
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 10
            request.httpBody = body
            return request
        }
        if status == 401 {
            throw WatchSummaryTransportError.unauthorized
        }
        guard (200..<300).contains(status) else {
            throw WatchSummaryTransportError.unsuccessfulResponse
        }
        return bytes
    }
}

// MARK: - Phone Connector

class PhoneConnector: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = PhoneConnector()

    @Published var widgetData: WatchWidgetData?
    @Published var multiBabyData: MultiBabyWatchData?
    @Published var isReachable = false
    @Published var selectedBabyId: String? {
        didSet {
            if let id = selectedBabyId {
                UserDefaults(suiteName: "group.com.sofibaby.app")?.set(id, forKey: "watchSelectedBabyId")
            }
        }
    }

    // The language chosen in the phone app, received via applicationContext and
    // persisted like the credentials below so a cold launch renders the caregiver's
    // language before the phone reconnects. Published so switching language on the
    // phone re-renders these views instead of requiring a relaunch or reinstall.
    @Published var language: String = NativeLanguageResolver.current

    // Non-secret Supabase metadata received via applicationContext.
    private var supabaseUrl: String?
    private var supabaseAnonKey: String?
    private var supabaseUserId: String?
    private let supabaseTransport = WatchSupabaseSessionEnvironment.transport

    private var liveActivityPushToken: String?
    private var pushToStartToken: String?

    private var networkPollTimer: Timer?

    private lazy var watchSummaryCoordinator: WatchSummaryCoordinator? = {
        guard let store = AppGroupWatchSummaryStore(),
              let identity = AppGroupWatchSummaryIdentityReader(),
              let fetcher = SupabaseWatchSummaryFetcher() else {
            return nil
        }
        return WatchSummaryCoordinator(
            store: store,
            identityReader: identity,
            fetcher: fetcher,
            reload: { WidgetCenter.shared.reloadAllTimelines() },
            requestCredentials: { [weak self] in
                DispatchQueue.main.async {
                    self?.isTokenStale = true
                    self?.sendAction(["action": "requestSync"])
                }
            }
        )
    }()

    @Published var isTokenStale = false

    // Local optimistic timers (shown before phone confirms)
    @Published var localActiveTimers: [WatchActiveTimer] = []

    // Locally stopped timers (hide server timers until phone confirms)
    @Published var locallyStoppedTimerTypes: Set<String> = []

    // Local optimistic diaper logs (pending confirmation from phone)
    @Published var pendingDiaperLogs: [(type: String, time: Date)] = []

    var activePendingDiaperLogs: [(type: String, time: Date)] {
        pendingDiaperLogs.filter { Date().timeIntervalSince($0.time) < 60 }
    }

    var lastLocalDiaperTime: Date? {
        activePendingDiaperLogs.last?.time
    }

    // Local stopped activity times (for "X ago" display after stopping timer offline)
    var localStoppedActivityTimes: [String: Date] = [:]

    private var session: WCSession?
    private var lastActionTime: Date = .distantPast
    private let actionDebounceInterval: TimeInterval = 0.5

    override init() {
        super.init()
        print("[WatchConnector] init: starting")
        let defaults = UserDefaults(suiteName: "group.com.sofibaby.app")
        selectedBabyId = defaults?.string(forKey: "watchSelectedBabyId")
        supabaseUrl = defaults?.string(forKey: "watchSupabaseUrl")
        supabaseAnonKey = defaults?.string(forKey: "watchSupabaseAnonKey")
        supabaseUserId = defaults?.string(forKey: "watchSupabaseUserId")
        liveActivityPushToken = defaults?.string(forKey: "watchLiveActivityPushToken")
        pushToStartToken = defaults?.string(forKey: "watchPushToStartToken")
        print("[WatchConnector] init: selectedBabyId = \(selectedBabyId ?? "nil"), hasAuth = \(WatchSupabaseSessionEnvironment.hasSession), hasLAPushToken = \(liveActivityPushToken != nil)")
        if WCSession.isSupported() {
            print("[WatchConnector] init: WCSession is supported, activating...")
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        } else {
            print("[WatchConnector] init: WCSession NOT supported!")
        }
    }

    var currentBabyId: String? {
        selectedBabyId ?? widgetData?.babyId ?? multiBabyData?.selectedBabyId
    }

    var currentBaby: BabyWatchData? {
        guard let babyId = currentBabyId else { return nil }
        if let data = widgetData, data.babyId == babyId {
            return BabyWatchData(
                id: data.babyId,
                name: data.babyName,
                activities: data.activities,
                activeTimers: data.activeTimers ?? (data.activeTimer.map { [$0] } ?? [])
            )
        }
        return multiBabyData?.babies.first { $0.id == babyId }
    }

    var allBabies: [BabyWatchData] {
        multiBabyData?.babies ?? []
    }

    /// Combined active timers: local optimistic timers take precedence over server data
    var combinedActiveTimers: [WatchActiveTimer] {
        var timers: [WatchActiveTimer] = []
        var includedTypes: Set<String> = []

        // Local timers take precedence (they reflect user's most recent action)
        for localTimer in localActiveTimers {
            if !locallyStoppedTimerTypes.contains(localTimer.type) {
                timers.append(localTimer)
                includedTypes.insert(localTimer.type)
            }
        }

        // Add server timers only if not overridden by local state
        var serverTimers: [WatchActiveTimer] = []
        if let baby = currentBaby {
            serverTimers = baby.activeTimers
        } else if let data = widgetData {
            serverTimers = data.activeTimers ?? (data.activeTimer.map { [$0] } ?? [])
        }

        for timer in serverTimers {
            // Skip if we have a local timer for this type, or if locally stopped
            if !includedTypes.contains(timer.type) && !locallyStoppedTimerTypes.contains(timer.type) {
                timers.append(timer)
            }
        }

        return timers
    }

    /// Combined diaper counts: server data + pending local logs
    func combinedDiaperCounts(serverCounts: WatchActivityData.DiaperData.DiaperCounts) -> WatchActivityData.DiaperData.DiaperCounts {
        var counts = serverCounts
        for log in activePendingDiaperLogs {
            switch log.type {
            case "wet": counts.wet += 1
            case "dirty": counts.dirty += 1
            case "mixed": counts.mixed += 1
            case "dry": counts.dry += 1
            default: break
            }
        }
        return counts
    }

    var hasPendingDiaperLogs: Bool {
        !activePendingDiaperLogs.isEmpty
    }

    /// Sync optimistic state to UserDefaults cache so complications can read it
    func syncOptimisticStateToCache() {
        guard let identity = AppGroupWatchSummaryIdentityReader()?.currentIdentity(),
              let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app") else {
            WidgetCenter.shared.reloadAllTimelines()
            return
        }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let payload: [String: Any] = [
            "localActiveTimers": (try? JSONSerialization.jsonObject(with: encoder.encode(localActiveTimers))) ?? [],
            "locallyStoppedTimerTypes": Array(locallyStoppedTimerTypes).sorted(),
            "localStoppedActivityTimes": localStoppedActivityTimes.mapValues {
                ISO8601DateFormatter().string(from: $0)
            },
            "pendingDiaperLogs": pendingDiaperLogs.map {
                ["type": $0.type, "time": ISO8601DateFormatter().string(from: $0.time)]
            }
        ]
        if let bytes = try? JSONSerialization.data(withJSONObject: payload),
           let value = String(data: bytes, encoding: .utf8) {
            userDefaults.set(value, forKey: "watchOptimisticState.\(identity.cacheKey)")
        }
        WidgetCenter.shared.reloadAllTimelines()
        print("[WatchConnector] syncOptimisticStateToCache: stored overlay separately from server base")
    }

    private func canPerformAction() -> Bool {
        let now = Date()
        let timeSinceLastAction = now.timeIntervalSince(lastActionTime)
        print("[WatchConnector] canPerformAction: timeSinceLastAction = \(timeSinceLastAction), debounceInterval = \(actionDebounceInterval)")
        if timeSinceLastAction < actionDebounceInterval {
            print("[WatchConnector] canPerformAction: BLOCKED by debounce")
            return false
        }
        lastActionTime = now
        print("[WatchConnector] canPerformAction: ALLOWED")
        return true
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        print("[WatchConnector] activationDidComplete: state = \(activationState.rawValue), error = \(error?.localizedDescription ?? "none")")
        let receivedContext = session.receivedApplicationContext
        print("[WatchConnector] activationDidComplete: receivedContext keys = \(receivedContext.keys)")
        parseApplicationContext(receivedContext)

        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            print("[WatchConnector] activationDidComplete: isReachable = \(session.isReachable)")
            if self.widgetData == nil && self.multiBabyData == nil {
                print("[WatchConnector] activationDidComplete: no data, loading cache")
                self.loadCachedData()
            }
            self.refreshCompleteSummary(.activation)
            self.requestFreshDataFromPhone()
        }
    }

    private func parseApplicationContext(_ context: [String: Any]) {
        WatchMainThreadDispatcher.dispatch { [weak self] in
            self?.parseApplicationContextOnMain(context)
        }
    }

    private func parseApplicationContextOnMain(_ context: [String: Any]) {
        if context["signedOut"] as? Bool == true {
            let defaults = UserDefaults(suiteName: "group.com.sofibaby.app")
            for key in [
                "watchSupabaseUrl",
                "watchSupabaseAnonKey",
                "watchSupabaseUserId",
                "watchHouseholdId"
            ] {
                defaults?.removeObject(forKey: key)
            }
            if let defaults {
                WatchAccountCachePurger.purge(from: defaults)
            }
            supabaseUrl = nil
            supabaseAnonKey = nil
            supabaseUserId = nil
            do {
                try WatchSupabaseSessionEnvironment.vault.remove()
            } catch {
                NSLog("[WatchSupabaseSession] sign-out cleanup failed")
            }
            isTokenStale = false
            widgetData = nil
            multiBabyData = nil
            selectedBabyId = nil
            defaults?.removeObject(forKey: "watchSelectedBabyId")
            localActiveTimers.removeAll()
            locallyStoppedTimerTypes.removeAll()
            localStoppedActivityTimes.removeAll()
            pendingDiaperLogs.removeAll()
            stopNetworkPolling()
            return
        }
        // The phone sends the language it resolved, never its stored "system"
        // preference, so an unrecognized value means a version mismatch and the
        // existing selection is kept rather than falling back to English.
        if let language = context["language"] as? String,
           L.supportedLanguages.contains(language) {
            UserDefaults(suiteName: "group.com.sofibaby.app")?
                .set(language, forKey: NativeLanguageResolver.storageKey)
            DispatchQueue.main.async {
                self.language = language
            }
            print("[WatchConnector] parseApplicationContext: stored language")
        }

        // Persist non-secret metadata in UserDefaults and the renewable capsule
        // in Watch-local Keychain.
        if let url = context["supabaseUrl"] as? String,
           let anonKey = context["supabaseAnonKey"] as? String,
           let sessionCapsule = context["sessionCapsule"] as? String,
           let userId = context["userId"] as? String {
            let defaults = UserDefaults(suiteName: "group.com.sofibaby.app")
            let incomingHouseholdId = context["householdId"] as? String
            let storedHouseholdId = defaults?.string(forKey: "watchHouseholdId")
            let scopeChanged = (supabaseUserId != nil && supabaseUserId != userId) ||
                (storedHouseholdId != nil && storedHouseholdId != incomingHouseholdId)
            do {
                try WatchSupabaseSessionEnvironment.vault.install(capsuleJson: sessionCapsule)
                if scopeChanged {
                    if let defaults {
                        WatchAccountCachePurger.purge(from: defaults)
                    }
                    widgetData = nil
                    multiBabyData = nil
                    selectedBabyId = nil
                    defaults?.removeObject(forKey: "watchSelectedBabyId")
                    localActiveTimers.removeAll()
                    locallyStoppedTimerTypes.removeAll()
                    localStoppedActivityTimes.removeAll()
                    pendingDiaperLogs.removeAll()
                    stopNetworkPolling()
                }
                self.supabaseUrl = url
                self.supabaseAnonKey = anonKey
                self.supabaseUserId = userId
                self.isTokenStale = false
                defaults?.set(url, forKey: "watchSupabaseUrl")
                defaults?.set(anonKey, forKey: "watchSupabaseAnonKey")
                defaults?.set(userId, forKey: "watchSupabaseUserId")
                if let householdId = incomingHouseholdId {
                    defaults?.set(householdId, forKey: "watchHouseholdId")
                } else {
                    defaults?.removeObject(forKey: "watchHouseholdId")
                }
                print("[WatchConnector] parseApplicationContext: stored renewable auth session")
            } catch {
                self.isTokenStale = true
                NSLog("[WatchSupabaseSession] rejected invalid application-context capsule")
            }
        }

        if let pushToken = context["liveActivityPushToken"] as? String, !pushToken.isEmpty {
            self.liveActivityPushToken = pushToken
            let defaults = UserDefaults(suiteName: "group.com.sofibaby.app")
            defaults?.set(pushToken, forKey: "watchLiveActivityPushToken")
            print("[WatchConnector] parseApplicationContext: stored LA push token")
        }

        if let ptsToken = context["pushToStartToken"] as? String, !ptsToken.isEmpty {
            self.pushToStartToken = ptsToken
            let defaults = UserDefaults(suiteName: "group.com.sofibaby.app")
            defaults?.set(ptsToken, forKey: "watchPushToStartToken")
            print("[WatchConnector] parseApplicationContext: stored push-to-start token")
        }

        if let dataString = context["watchData"] as? String,
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(MultiBabyWatchData.self, from: data) {
            DispatchQueue.main.async {
                print("[WatchConnector] parseApplicationContext: received multiBabyData")
                if let baby = decoded.babies.first {
                    print("[WatchConnector] parseApplicationContext: baby \(baby.name) has \(baby.activeTimers.count) active timers")
                }
                self.multiBabyData = decoded
                if self.selectedBabyId == nil {
                    self.selectedBabyId = decoded.selectedBabyId
                }
                self.cacheData(dataString, forKey: "multiBabyWatchData")
                self.acceptPhoneSummaryPayload(data)
            }
        }

        if let dataString = context["widgetData"] as? String,
           let data = dataString.data(using: .utf8) {
            DispatchQueue.main.async {
                print("[WatchConnector] parseApplicationContext: received widgetData")
                if self.selectedBabyId == nil,
                   let decoded = try? WatchSummaryDecoder.decodeCache(data) {
                    self.selectedBabyId = decoded.data.babyId
                }
                self.acceptPhoneSummaryPayload(data)
            }
        }
    }

    private func acceptPhoneSummaryPayload(_ bytes: Data) {
        guard let watchSummaryCoordinator else { return }
        Task {
            let accepted = await watchSummaryCoordinator.acceptPhonePayload(bytes)
            if let accepted {
                await MainActor.run {
                    self.installAcceptedSummary(accepted)
                }
            }
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable {
                self.refreshCompleteSummary(.reachability)
                self.requestFreshDataFromPhone()
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    self.requestFreshDataFromPhone()
                }
            } else {
                self.refreshCompleteSummary(.reachability)
            }
            // Always poll when timers are active — phone may be "reachable"
            // but app backgrounded and not processing widget pause/resume
            self.startNetworkPolling()
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        print("[WatchConnector] didReceiveApplicationContext: keys = \(applicationContext.keys)")
        parseApplicationContext(applicationContext)
        DispatchQueue.main.async {
            WidgetCenter.shared.reloadAllTimelines()
            // Restart polling based on current timer state
            self.startNetworkPolling()
        }
    }

    /// Send a message that expects a reply (for sync requests)
    func sendMessageWithReply(_ message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        print("[WatchConnector] sendMessageWithReply called")

        guard let session = session else {
            print("[WatchConnector] ERROR: session is nil!")
            return
        }

        guard session.isReachable else {
            print("[WatchConnector] Phone not reachable for reply message")
            return
        }

        print("[WatchConnector] Sending message expecting reply...")
        session.sendMessage(message, replyHandler: replyHandler) { error in
            print("[WatchConnector] sendMessageWithReply error: \(error)")
        }
    }

    /// Send an action message (single delivery: sendMessage if reachable, else transferUserInfo)
    @discardableResult
    func sendAction(_ message: [String: Any]) -> String {
        var messageWithId = message
        let requestId = UUID().uuidString
        messageWithId["requestId"] = requestId

        print("[WatchConnector] sendAction called with: \(messageWithId)")

        guard let session = session else {
            print("[WatchConnector] ERROR: session is nil!")
            return requestId
        }

        guard session.activationState == .activated else {
            print("[WatchConnector] ERROR: session not activated yet (state: \(session.activationState.rawValue))")
            return requestId
        }

        // Always queue via transferUserInfo for guaranteed delivery
        // (sendMessage is unreliable when the phone app is backgrounded)
        session.transferUserInfo(messageWithId)

        if session.isReachable {
            print("[WatchConnector] Sending immediate message + queued via transferUserInfo")
            session.sendMessage(messageWithId, replyHandler: { [weak self] reply in
                guard reply["success"] as? Bool == true,
                      let coordinator = self?.watchSummaryCoordinator else { return }
                Task {
                    await coordinator.acknowledge(requestId: requestId)
                    await MainActor.run {
                        PhoneConnector.shared.refreshCompleteSummary(.postAction)
                    }
                }
            }) { error in
                print("[WatchConnector] sendMessage failed (transferUserInfo already queued): \(error)")
            }
        } else {
            print("[WatchConnector] Action queued via transferUserInfo (not reachable)")
        }
        return requestId
    }

    private func recordTimerOverlay(
        requestId: String,
        timerInstanceId: String,
        activityId: String,
        activityType: String,
        action: WatchOverlayAction,
        requestedAt: String
    ) {
        guard let accountId = supabaseUserId,
              let babyId = currentBabyId,
              let watchSummaryCoordinator else {
            return
        }
        let overlay = WatchOptimisticOverlay(
            accountId: accountId,
            babyId: babyId,
            requestId: requestId,
            timerInstanceId: timerInstanceId,
            activityId: activityId,
            activityType: activityType,
            action: action,
            requestedAt: requestedAt
        )
        Task {
            await watchSummaryCoordinator.recordOverlay(overlay)
        }
    }

    func startTimer(activityType: String, context: String? = nil) {
        print("[WatchConnector] startTimer called for: \(activityType), context: \(context ?? "nil")")
        guard canPerformAction() else {
            print("[WatchConnector] startTimer: blocked by canPerformAction")
            return
        }

        let startTime = Date()
        let startTimeString = ISO8601DateFormatter().string(from: startTime)
        let timerInstanceId = UUID().uuidString
        let activityId = UUID().uuidString

        var message: [String: Any] = [
            "action": "startTimer",
            "activityType": activityType,
            "requestedStartTime": startTimeString,
            "timerInstanceId": timerInstanceId,
            "activityId": activityId
        ]
        if let babyId = currentBabyId {
            message["babyId"] = babyId
        }
        if let context = context {
            message["context"] = context
        }
        print("[WatchConnector] startTimer: sending action with requestedStartTime: \(startTimeString)")
        let requestId = sendAction(message)
        recordTimerOverlay(
            requestId: requestId,
            timerInstanceId: timerInstanceId,
            activityId: activityId,
            activityType: activityType,
            action: .start,
            requestedAt: startTimeString
        )

        if !(session?.isReachable ?? false) {
            supabaseStartTimer(
                activityType: activityType,
                startTime: startTimeString,
                context: context,
                timerInstanceId: timerInstanceId,
                activityId: activityId
            )
        }

        startLiveActivityViaEdgeFunction(activityType: activityType, startTimeUnix: Int(startTime.timeIntervalSince1970), context: context)

        // Add local optimistic timer
        let localTimer = WatchActiveTimer(
            type: activityType,
            startTime: startTimeString,
            timerInstanceId: timerInstanceId,
            activityId: activityId,
            context: context,
            startedBy: supabaseUserId
        )
        DispatchQueue.main.async {
            self.localActiveTimers.removeAll { $0.type == activityType }
            self.locallyStoppedTimerTypes.remove(activityType)
            self.localActiveTimers.append(localTimer)
            print("[WatchConnector] startTimer: added local optimistic timer")
            self.syncOptimisticStateToCache()
            self.startNetworkPolling()
        }

        WKInterfaceDevice.current().play(.start)
        print("[WatchConnector] startTimer: completed")
    }

    func stopTimer(activityType: String) {
        print("[WatchConnector] stopTimer called for: \(activityType)")
        guard canPerformAction() else {
            print("[WatchConnector] stopTimer: blocked by canPerformAction")
            return
        }

        let endTime = Date()
        let endTimeString = ISO8601DateFormatter().string(from: endTime)
        guard let babyId = currentBabyId,
              let timer = combinedActiveTimers.first(where: { $0.type == activityType }) else {
            return
        }
        let timerInstanceId = timer.timerInstanceId ?? "legacy:\(babyId):\(activityType):\(timer.startTime)"

        let dbType = activityType == "tummyTime" ? "tummy_time" : activityType
        let externalTimerCommand: [String: Any] = [
            "id": UUID().uuidString,
            "action": "stop",
            "activityType": dbType,
            "babyId": babyId,
            "timerInstanceId": timerInstanceId,
            "eventAt": endTimeString,
            "source": "watch",
            "legacy": timer.timerInstanceId == nil
        ]
        let message: [String: Any] = [
            "action": "stopTimer",
            "activityType": activityType,
            "requestedEndTime": endTimeString,
            "babyId": babyId,
            "externalTimerCommand": externalTimerCommand
        ]
        print("[WatchConnector] stopTimer: sending action with requestedEndTime: \(endTimeString)")
        let requestId = sendAction(message)
        recordTimerOverlay(
            requestId: requestId,
            timerInstanceId: timerInstanceId,
            activityId: timer.activityId ?? "legacy-activity:\(timerInstanceId)",
            activityType: activityType,
            action: .stop,
            requestedAt: endTimeString
        )

        if !(session?.isReachable ?? false) {
            supabaseStopTimer(activityType: activityType)
        }

        // Remove local optimistic timer and mark as locally stopped
        DispatchQueue.main.async {
            self.localActiveTimers.removeAll { $0.type == activityType }
            self.locallyStoppedTimerTypes.insert(activityType)
            self.localStoppedActivityTimes[activityType] = endTime
            print("[WatchConnector] stopTimer: removed local timer and marked as stopped")
            self.syncOptimisticStateToCache()
        }

        WKInterfaceDevice.current().play(.stop)
        print("[WatchConnector] stopTimer: completed")
    }

    func stopPumpingWithVolume(volumeMl: Int) {
        guard canPerformAction() else { return }

        let endTime = Date()
        let endTimeString = ISO8601DateFormatter().string(from: endTime)
        guard let babyId = currentBabyId,
              let timer = combinedActiveTimers.first(where: { $0.type == "pumping" }) else {
            return
        }
        let timerInstanceId = timer.timerInstanceId ?? "legacy:\(babyId):pumping:\(timer.startTime)"

        let externalTimerCommand: [String: Any] = [
            "id": UUID().uuidString,
            "action": "stop",
            "activityType": "pumping",
            "babyId": babyId,
            "timerInstanceId": timerInstanceId,
            "eventAt": endTimeString,
            "source": "watch",
            "legacy": timer.timerInstanceId == nil,
            "payload": ["volumeMl": volumeMl]
        ]
        let message: [String: Any] = [
            "action": "stopPumpingWithVolume",
            "activityType": "pumping",
            "volumeMl": volumeMl,
            "requestedEndTime": endTimeString,
            "babyId": babyId,
            "externalTimerCommand": externalTimerCommand
        ]
        let requestId = sendAction(message)
        recordTimerOverlay(
            requestId: requestId,
            timerInstanceId: timerInstanceId,
            activityId: timer.activityId ?? "legacy-activity:\(timerInstanceId)",
            activityType: "pumping",
            action: .stop,
            requestedAt: endTimeString
        )

        if !(session?.isReachable ?? false) {
            supabaseStopTimer(activityType: "pumping")
        }

        // Remove local optimistic timer and mark as locally stopped
        DispatchQueue.main.async {
            self.localActiveTimers.removeAll { $0.type == "pumping" }
            self.locallyStoppedTimerTypes.insert("pumping")
            self.localStoppedActivityTimes["pumping"] = endTime
            self.syncOptimisticStateToCache()
        }

        WKInterfaceDevice.current().play(.stop)
    }

    func logDiaper(type: String, stoolColor: String? = nil) {
        guard canPerformAction() else { return }

        let logTime = Date()
        let logTimeString = ISO8601DateFormatter().string(from: logTime)

        var message: [String: Any] = [
            "action": "logDiaper",
            "diaperType": type,
            "requestedLogTime": logTimeString
        ]
        if let color = stoolColor {
            message["stoolColor"] = color
        }
        if let babyId = currentBabyId {
            message["babyId"] = babyId
        }
        sendAction(message)

        // Add to pending logs for optimistic UI
        DispatchQueue.main.async {
            self.pendingDiaperLogs.append((type: type, time: logTime))
            print("[WatchConnector] logDiaper: added pending log for \(type)")
            self.syncOptimisticStateToCache()
        }

        WKInterfaceDevice.current().play(.success)
    }

    func logBottleFeeding(volumeMl: Int, contentType: String) {
        guard canPerformAction() else { return }

        let logTime = Date()
        let logTimeString = ISO8601DateFormatter().string(from: logTime)

        var message: [String: Any] = [
            "action": "logBottleFeeding",
            "volumeMl": volumeMl,
            "contentType": contentType,
            "requestedLogTime": logTimeString
        ]
        if let babyId = currentBabyId {
            message["babyId"] = babyId
        }
        sendAction(message)
        WKInterfaceDevice.current().play(.success)
    }

    private func findServerTimer(activityType: String) -> WatchActiveTimer? {
        if let baby = currentBaby {
            return baby.activeTimers.first { $0.type == activityType }
        }
        if let data = widgetData {
            let timers = data.activeTimers ?? (data.activeTimer.map { [$0] } ?? [])
            return timers.first { $0.type == activityType }
        }
        return nil
    }

    func pauseTimer(activityType: String) {
        guard canPerformAction(),
              let timer = combinedActiveTimers.first(where: { $0.type == activityType }),
              let babyId = currentBabyId else { return }
        let timerInstanceId = timer.timerInstanceId ?? "legacy:\(babyId):\(activityType):\(timer.startTime)"
        let requestedAt = ISO8601DateFormatter().string(from: Date())

        var message: [String: Any] = [
            "action": "pauseTimer",
            "activityType": activityType
        ]
        message["babyId"] = babyId
        let requestId = sendAction(message)
        recordTimerOverlay(
            requestId: requestId,
            timerInstanceId: timerInstanceId,
            activityId: timer.activityId ?? "legacy-activity:\(timerInstanceId)",
            activityType: activityType,
            action: .pause,
            requestedAt: requestedAt
        )

        DispatchQueue.main.async {
            var accumulated: Int?
            var timerContext: String?
            if let index = self.localActiveTimers.firstIndex(where: { $0.type == activityType }) {
                timerContext = self.localActiveTimers[index].context
                self.localActiveTimers[index].isPaused = true
                if let startTime = ISO8601DateFormatter().date(from: self.localActiveTimers[index].startTime) {
                    let secs = Int(Date().timeIntervalSince(startTime))
                    self.localActiveTimers[index].accumulatedSeconds = secs
                    accumulated = secs
                }
            } else if var serverTimer = self.findServerTimer(activityType: activityType) {
                timerContext = serverTimer.context
                serverTimer.isPaused = true
                if let startTime = ISO8601DateFormatter().date(from: serverTimer.startTime) {
                    let secs = Int(Date().timeIntervalSince(startTime))
                    serverTimer.accumulatedSeconds = secs
                    accumulated = secs
                }
                self.localActiveTimers.append(serverTimer)
            }
            self.syncOptimisticStateToCache()

            self.supabaseTogglePause(activityType: activityType, action: "pause", accumulatedSeconds: accumulated, timerContext: timerContext)
        }

        WKInterfaceDevice.current().play(.click)
    }

    func resumeTimer(activityType: String) {
        guard canPerformAction(),
              let timer = combinedActiveTimers.first(where: { $0.type == activityType }),
              let babyId = currentBabyId else { return }
        let timerInstanceId = timer.timerInstanceId ?? "legacy:\(babyId):\(activityType):\(timer.startTime)"
        let requestedAt = ISO8601DateFormatter().string(from: Date())

        var message: [String: Any] = [
            "action": "resumeTimer",
            "activityType": activityType
        ]
        message["babyId"] = babyId
        let requestId = sendAction(message)
        recordTimerOverlay(
            requestId: requestId,
            timerInstanceId: timerInstanceId,
            activityId: timer.activityId ?? "legacy-activity:\(timerInstanceId)",
            activityType: activityType,
            action: .resume,
            requestedAt: requestedAt
        )

        DispatchQueue.main.async {
            var accumulated: Int?
            var timerContext: String?
            var effectiveStartTime: String?
            if let index = self.localActiveTimers.firstIndex(where: { $0.type == activityType }) {
                accumulated = self.localActiveTimers[index].accumulatedSeconds
                timerContext = self.localActiveTimers[index].context
                effectiveStartTime = self.localActiveTimers[index].startTime
                self.localActiveTimers[index].isPaused = false
                self.localActiveTimers[index].accumulatedSeconds = nil
            } else if var serverTimer = self.findServerTimer(activityType: activityType) {
                accumulated = serverTimer.accumulatedSeconds
                timerContext = serverTimer.context
                effectiveStartTime = serverTimer.startTime
                serverTimer.isPaused = false
                serverTimer.accumulatedSeconds = nil
                self.localActiveTimers.append(serverTimer)
            }
            self.syncOptimisticStateToCache()

            self.supabaseTogglePause(
                activityType: activityType,
                action: "resume",
                accumulatedSeconds: accumulated,
                timerContext: timerContext,
                effectiveStartTime: effectiveStartTime
            )
        }

        WKInterfaceDevice.current().play(.click)
    }

    func switchSide(activityType: String, currentSide: String) {
        guard canPerformAction() else { return }
        var message: [String: Any] = [
            "action": "switchSide",
            "activityType": activityType,
            "currentSide": currentSide
        ]
        if let babyId = currentBabyId {
            message["babyId"] = babyId
        }
        sendAction(message)
        WKInterfaceDevice.current().play(.click)
    }

    func selectBaby(babyId: String) {
        selectedBabyId = babyId
        widgetData = nil
        localActiveTimers.removeAll()
        locallyStoppedTimerTypes.removeAll()
        localStoppedActivityTimes.removeAll()
        pendingDiaperLogs.removeAll()
        sendAction([
            "action": "selectBaby",
            "babyId": babyId
        ])
        loadCachedData()
        refreshCompleteSummary(.explicit)
        WKInterfaceDevice.current().play(.click)
    }

    private func installAcceptedSummary(_ summary: WatchSummaryData) {
        guard summary.babyId == currentBabyId else { return }
        let timers = (summary.activeTimers ?? []).map {
            WatchActiveTimer(
                type: $0.type,
                startTime: $0.startTime,
                timerInstanceId: $0.timerInstanceId,
                activityId: nil,
                context: $0.context,
                isRemote: $0.isRemote,
                isPaused: $0.isPaused,
                accumulatedSeconds: $0.accumulatedSeconds,
                startedBy: nil
            )
        }
        let activities = WatchActivityData(
            feeding: .init(
                lastTime: summary.activities.feeding.lastTime,
                todayCount: summary.activities.feeding.todayCount,
                lastSide: summary.activities.feeding.lastSide,
                lastType: summary.activities.feeding.lastType
            ),
            sleep: .init(
                lastTime: summary.activities.sleep.lastTime,
                todayMinutes: summary.activities.sleep.todayMinutes,
                goalMinutes: summary.activities.sleep.goalMinutes,
                lastDurationMinutes: summary.activities.sleep.lastDurationMinutes,
                isActive: summary.activities.sleep.isActive,
                sleepType: summary.activities.sleep.sleepType,
                wakeWindowMinutes: summary.activities.sleep.wakeWindowMinutes,
                lastSleepEndedAt: summary.activities.sleep.lastSleepEndedAt,
                napCountToday: summary.activities.sleep.napCountToday,
                morningConfirmationPending: summary.activities.sleep.morningConfirmationPending
            ),
            diaper: .init(
                lastTime: summary.activities.diaper.lastTime,
                todayCounts: .init(
                    wet: summary.activities.diaper.todayCounts.wet,
                    dirty: summary.activities.diaper.todayCounts.dirty,
                    mixed: summary.activities.diaper.todayCounts.mixed,
                    dry: summary.activities.diaper.todayCounts.dry
                )
            ),
            pumping: .init(
                lastTime: summary.activities.pumping.lastTime,
                todayVolumeMl: Int(summary.activities.pumping.todayVolumeMl.rounded()),
                lastSide: summary.activities.pumping.lastSide,
                sessionCount: summary.activities.pumping.sessionCount
            ),
            tummyTime: .init(
                lastTime: summary.activities.tummyTime.lastTime,
                todayMinutes: summary.activities.tummyTime.todayMinutes,
                goalMinutes: summary.activities.tummyTime.goalMinutes,
                lastDurationMinutes: summary.activities.tummyTime.lastDurationMinutes
            )
        )
        widgetData = WatchWidgetData(
            babyId: summary.babyId,
            babyName: summary.babyName,
            activities: activities,
            activeTimer: timers.first,
            activeTimers: timers,
            updatedAt: summary.updatedAt
        )
        reconcileLocalOptimism(with: summary)
        startNetworkPolling()
    }

    private func reconcileLocalOptimism(with summary: WatchSummaryData) {
        let serverTimers = summary.activeTimers ?? []
        localActiveTimers.removeAll { local in
            guard let timerInstanceId = local.timerInstanceId,
                  let server = serverTimers.first(where: { $0.timerInstanceId == timerInstanceId }) else {
                return false
            }
            return local.type == server.type &&
                local.startTime == server.startTime &&
                local.context == server.context &&
                local.isPaused == server.isPaused &&
                local.accumulatedSeconds == server.accumulatedSeconds
        }
        let serverTypes = Set(serverTimers.map(\.type))
        if let acceptedAt = summary.serverAsOf.flatMap(parseDate) {
            for type in locallyStoppedTimerTypes {
                guard !serverTypes.contains(type),
                      let requestedAt = localStoppedActivityTimes[type],
                      acceptedAt >= requestedAt else {
                    continue
                }
                locallyStoppedTimerTypes.remove(type)
                localStoppedActivityTimes.removeValue(forKey: type)
            }
            pendingDiaperLogs.removeAll { $0.time <= acceptedAt }
        }
    }

    private func loadCachedData() {
        let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app")
        var installedScopedSummary = false
        let canReadLegacy = userDefaults.map { defaults in
            guard let accountId = supabaseUserId else { return false }
            return WatchLegacyCacheOwnership.canRead(accountId: accountId, from: defaults)
        } ?? false

        if let store = AppGroupWatchSummaryStore(defaults: userDefaults),
           let identity = AppGroupWatchSummaryIdentityReader(defaults: userDefaults)?.currentIdentity(),
           let bytes = store.readSummary(for: identity),
           let summary = try? WatchSummaryDecoder.decodeCache(bytes).data {
            installAcceptedSummary(summary)
            installedScopedSummary = summary.schemaVersion != nil
        }

        if canReadLegacy,
           let dataString = userDefaults?.string(forKey: "multiBabyWatchData"),
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(MultiBabyWatchData.self, from: data) {
            self.multiBabyData = decoded
            if self.selectedBabyId == nil {
                self.selectedBabyId = decoded.selectedBabyId
            }
        }

        if canReadLegacy && !installedScopedSummary,
           let dataString = userDefaults?.string(forKey: "watchData"),
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data),
           decoded.babyId == currentBabyId {
            self.widgetData = decoded
        }
        if canReadLegacy && !installedScopedSummary && widgetData == nil,
           let dataString = userDefaults?.string(forKey: "widgetData"),
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data),
           decoded.babyId == currentBabyId {
            self.widgetData = decoded
        }
        loadOptimisticState(defaults: userDefaults)
    }

    private func loadOptimisticState(defaults: UserDefaults?) {
        guard let defaults,
              let identity = AppGroupWatchSummaryIdentityReader(defaults: defaults)?.currentIdentity(),
              let value = defaults.string(forKey: "watchOptimisticState.\(identity.cacheKey)"),
              let bytes = value.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
            return
        }
        if let timers = object["localActiveTimers"],
           let timerBytes = try? JSONSerialization.data(withJSONObject: timers),
           let decoded = try? JSONDecoder().decode([WatchActiveTimer].self, from: timerBytes) {
            localActiveTimers = decoded
        }
        locallyStoppedTimerTypes = Set(object["locallyStoppedTimerTypes"] as? [String] ?? [])
        if let stoppedTimes = object["localStoppedActivityTimes"] as? [String: String] {
            localStoppedActivityTimes = stoppedTimes.reduce(into: [:]) { result, item in
                if let date = parseDate(item.value) {
                    result[item.key] = date
                }
            }
        }
        if let pendingLogs = object["pendingDiaperLogs"] as? [[String: String]] {
            pendingDiaperLogs = pendingLogs.compactMap { item in
                guard let type = item["type"],
                      let value = item["time"],
                      let time = parseDate(value) else {
                    return nil
                }
                return (type: type, time: time)
            }
        }
    }

    func requestFreshData() {
        print("[WatchConnector] requestFreshData called")
        refreshCompleteSummary(.explicit)
        requestFreshDataFromPhone()
    }

    private func requestFreshDataFromPhone() {
        guard let session = session, session.isReachable else {
            print("[WatchConnector] requestFreshData: session not available or not reachable")
            return
        }
        sendMessageWithReply(["action": "requestSync"]) { reply in
            print("[WatchConnector] requestFreshData: got reply")
            if let dataString = reply["widgetData"] as? String,
               let data = dataString.data(using: .utf8) {
                DispatchQueue.main.async {
                    self.acceptPhoneSummaryPayload(data)
                }
            }
        }
    }

    private func refreshCompleteSummary(_ trigger: WatchSummaryRefreshTrigger) {
        guard let watchSummaryCoordinator else { return }
        Task {
            let accepted = await watchSummaryCoordinator.refresh(trigger: trigger)
            if let accepted {
                await MainActor.run {
                    self.installAcceptedSummary(accepted)
                }
            }
        }
    }

    // MARK: - Network Polling

    private func startNetworkPolling() {
        stopNetworkPolling()
        let hasActiveTimers = !combinedActiveTimers.isEmpty
        guard hasActiveTimers else {
            print("[WatchConnector] startNetworkPolling: disabled without active timers")
            return
        }
        let interval: TimeInterval = 30
        print("[WatchConnector] startNetworkPolling: \(Int(interval))s timer fingerprint probe")
        networkPollTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.refreshFromNetwork()
        }
    }

    private func stopNetworkPolling() {
        networkPollTimer?.invalidate()
        networkPollTimer = nil
    }

    // MARK: - Supabase Network Access

    private var supabaseConfig: WatchSupabaseEndpointConfig? {
        guard let supabaseUrl, let supabaseAnonKey else { return nil }
        return WatchSupabaseEndpointConfig(supabaseUrl: supabaseUrl, anonKey: supabaseAnonKey)
    }

    private var hasAuthCredentials: Bool {
        supabaseConfig != nil && supabaseUserId != nil && WatchSupabaseSessionEnvironment.hasSession
    }

    func refreshFromNetwork() {
        guard hasAuthCredentials else {
            print("[WatchConnector] refreshFromNetwork: no auth credentials")
            return
        }
        Task {
            guard let remoteTimers = await fetchActiveTimersFromNetwork() else {
                print("[WatchConnector] refreshFromNetwork: fetch failed")
                return
            }
            let fingerprint = WatchTimerFingerprint(timers: remoteTimers)
            let accepted = await watchSummaryCoordinator?.acceptTimerProbe(fingerprint)
            if let accepted {
                await MainActor.run {
                    self.installAcceptedSummary(accepted)
                }
            }
        }
    }

    private func fetchActiveTimersFromNetwork() async -> [WatchSummaryTimer]? {
        guard let config = supabaseConfig,
              let babyId = currentBabyId, let supabaseUserId else {
            return nil
        }

        let urlString = "\(config.supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&select=id,activity_type,started_by,started_at,timer_data"
        guard let url = URL(string: urlString) else { return nil }

        let result: (Int, Data)
        do {
            result = try await supabaseTransport.send(config: config) { token in
                var request = URLRequest(url: url)
                request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.timeoutInterval = 10
                return request
            }
        } catch {
            print("[WatchConnector] fetchActiveTimersFromNetwork: request failed")
            return nil
        }

        if result.0 == 401 {
            print("[WatchConnector] fetchActiveTimersFromNetwork: renewal retry returned 401")
            await MainActor.run {
                self.isTokenStale = true
            }
            sendAction(["action": "requestSync"])
            return nil
        }

        guard result.0 == 200 else {
            print("[WatchConnector] fetchActiveTimersFromNetwork: status \(result.0)")
            return nil
        }

        guard let remoteTimers = try? WatchTimerProbeDecoder.decode(
            result.1,
            currentUserId: supabaseUserId
        ) else {
            print("[WatchConnector] fetchActiveTimersFromNetwork: decode failed")
            return nil
        }
        return remoteTimers
    }

    // MARK: - Supabase Write Fallbacks

    private func supabaseStartTimer(
        activityType: String,
        startTime: String,
        context: String?,
        timerInstanceId: String,
        activityId: String
    ) {
        guard hasAuthCredentials, let config = supabaseConfig, let supabaseUserId,
              let babyId = currentBabyId else { return }

        let dbType = activityType == "tummyTime" ? "tummy_time" : activityType
        let urlString = "\(config.supabaseUrl)/rest/v1/rpc/acquire_timer_lock"
        guard let url = URL(string: urlString) else { return }

        var timerData: [String: Any] = [
            "timerInstanceId": timerInstanceId,
            "activityId": activityId
        ]
        if let context {
            if dbType == "feeding" || dbType == "pumping" {
                timerData["side"] = context
            } else if dbType == "sleep" {
                timerData["sleepType"] = context
            }
        }

        let body: [String: Any] = [
            "p_baby_id": babyId,
            "p_activity_type": dbType,
            "p_user_id": supabaseUserId,
            "p_timer_data": timerData
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else { return }

        Task {
            do {
                let (status, _) = try await supabaseTransport.send(config: config) { token in
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = jsonData
                    request.timeoutInterval = 10
                    return request
                }
                print("[WatchConnector] supabaseStartTimer: status \(status)")
            } catch {
                print("[WatchConnector] supabaseStartTimer: failed — \(error.localizedDescription)")
            }
        }
    }

    private func supabaseStopTimer(activityType: String) {
        guard hasAuthCredentials, let config = supabaseConfig, let supabaseUserId,
              let babyId = currentBabyId else { return }

        let dbType = activityType == "tummyTime" ? "tummy_time" : activityType
        let urlString = "\(config.supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&activity_type=eq.\(dbType)&started_by=eq.\(supabaseUserId)"
        guard let url = URL(string: urlString) else { return }

        let pushToken = self.liveActivityPushToken

        Task {
            do {
                let (status, _) = try await supabaseTransport.send(config: config) { token in
                    var request = URLRequest(url: url)
                    request.httpMethod = "DELETE"
                    request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    request.timeoutInterval = 10
                    return request
                }
                print("[WatchConnector] supabaseStopTimer: status \(status)")
            } catch {
                print("[WatchConnector] supabaseStopTimer: failed — \(error.localizedDescription)")
            }

            // End Live Activity via edge function
            if let pushToken, !pushToken.isEmpty {
                await endLiveActivityViaEdgeFunction(pushToken: pushToken)
            }
        }
    }

    private func endLiveActivityViaEdgeFunction(pushToken: String) async {
        guard let config = supabaseConfig else { return }

        let urlString = "\(config.supabaseUrl)/functions/v1/end-live-activity"
        guard let url = URL(string: urlString) else { return }

        var body: [String: Any] = ["pushToken": pushToken]
        #if DEBUG
        body["isSandbox"] = true
        #endif

        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else { return }

        do {
            let (status, _) = try await supabaseTransport.send(config: config) { token in
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.httpBody = jsonData
                request.timeoutInterval = 10
                return request
            }
            print("[WatchConnector] endLiveActivityViaEdgeFunction: status \(status)")
        } catch {
            print("[WatchConnector] endLiveActivityViaEdgeFunction: failed — \(error.localizedDescription)")
        }

        // Clear the push token since the Live Activity is ended
        await MainActor.run {
            PhoneConnector.shared.liveActivityPushToken = nil
            UserDefaults(suiteName: "group.com.sofibaby.app")?.removeObject(forKey: "watchLiveActivityPushToken")
        }
    }

    private func startLiveActivityViaEdgeFunction(activityType: String, startTimeUnix: Int, context: String?) {
        guard let config = supabaseConfig,
              let ptsToken = pushToStartToken, !ptsToken.isEmpty else { return }

        let babyName = currentBaby?.name ?? widgetData?.babyName ?? L.baby
        let urlString = "\(config.supabaseUrl)/functions/v1/start-live-activity"
        guard let url = URL(string: urlString) else { return }

        var body: [String: Any] = [
            "pushToStartToken": ptsToken,
            "activityType": activityType,
            "babyName": babyName,
            "startTimeUnix": startTimeUnix
        ]
        if let babyId = currentBabyId {
            body["babyId"] = babyId
        }
        if let context {
            body["context"] = context
        }
        #if DEBUG
        body["isSandbox"] = true
        #endif

        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else { return }

        Task {
            do {
                let (status, _) = try await supabaseTransport.send(config: config) { token in
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    request.httpBody = jsonData
                    request.timeoutInterval = 10
                    return request
                }
                print("[WatchConnector] startLiveActivityViaEdgeFunction: status \(status)")
            } catch {
                print("[WatchConnector] startLiveActivityViaEdgeFunction: failed — \(error.localizedDescription)")
            }
        }
    }

    private func supabaseTogglePause(
        activityType: String,
        action: String,
        accumulatedSeconds: Int?,
        timerContext: String? = nil,
        effectiveStartTime: String? = nil
    ) {
        guard hasAuthCredentials, let config = supabaseConfig, let supabaseUserId,
              let babyId = currentBabyId else { return }

        let dbType = activityType == "tummyTime" ? "tummy_time" : activityType
        let urlString = "\(config.supabaseUrl)/functions/v1/toggle-timer-pause"
        guard let url = URL(string: urlString) else { return }

        var timerData: [String: Any] = [:]
        var body: [String: Any] = [
            "babyId": babyId,
            "activityType": dbType,
            "userId": supabaseUserId,
            "action": action
        ]

        if action == "pause" {
            timerData["isPaused"] = true
            timerData["pausedAt"] = ISO8601DateFormatter().string(from: Date())
            if let accumulatedSeconds {
                timerData["accumulatedSeconds"] = accumulatedSeconds
                body["elapsedSeconds"] = accumulatedSeconds
            }
        } else {
            timerData["isPaused"] = false
            if let accumulatedSeconds {
                body["elapsedSeconds"] = accumulatedSeconds
                timerData["accumulatedSeconds"] = accumulatedSeconds
            }
            if let effectiveStartTime {
                body["effectiveStartTimeISO"] = effectiveStartTime
                timerData["effectiveStartTime"] = effectiveStartTime
            }
        }

        body["timerData"] = timerData
        if let timerContext {
            body["context"] = timerContext
        }

        if let pushToken = liveActivityPushToken, !pushToken.isEmpty {
            body["liveActivityPushToken"] = pushToken
        }

        #if DEBUG
        body["isSandbox"] = true
        #endif

        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else { return }

        Task {
            do {
                let (status, _) = try await supabaseTransport.send(config: config) { token in
                    var request = URLRequest(url: url)
                    request.httpMethod = "POST"
                    request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = jsonData
                    request.timeoutInterval = 10
                    return request
                }
                print("[WatchConnector] supabaseTogglePause: status \(status)")
            } catch {
                print("[WatchConnector] supabaseTogglePause: failed — \(error.localizedDescription)")
            }
        }
    }

    private func cacheData(_ dataString: String, forKey key: String = "watchData") {
        let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app")
        userDefaults?.set(dataString, forKey: key)
        if let userDefaults, let supabaseUserId {
            WatchLegacyCacheOwnership.mark(accountId: supabaseUserId, in: userDefaults)
        }
    }
}

// MARK: - Utility

func formatTimeSince(_ dateString: String?) -> String {
    guard let string = dateString else { return "--" }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var date = formatter.date(from: string)
    if date == nil {
        formatter.formatOptions = [.withInternetDateTime]
        date = formatter.date(from: string)
    }

    guard let parsedDate = date else { return "--" }
    return formatTimeSinceDate(parsedDate)
}

func parseDate(_ dateString: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: dateString) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: dateString)
}

func suggestedSide(lastSide: String?) -> String {
    guard let last = lastSide else { return "left" }
    return last == "left" ? "right" : "left"
}

/// Maps a raw data token (side, sleep type, diaper type, feeding type, etc.)
/// to its localized display string. Falls back to a capitalized version of
/// the raw token for values that aren't part of the known vocabulary.
func localizedToken(_ token: String) -> String {
    switch token.lowercased() {
    case "left": return L.left
    case "right": return L.right
    case "both": return L.both
    case "nap": return L.nap
    case "night": return L.night
    case "wet": return L.wet
    case "dirty": return L.dirty
    case "mixed": return L.mixed
    case "dry": return L.dry
    case "breast", "nursing": return L.breast
    case "bottle": return L.bottle
    case "solid": return L.solid
    case "formula": return L.formula
    default: return token.capitalized
    }
}

// MARK: - Content View

struct ContentView: View {
    @StateObject private var connector = PhoneConnector.shared
    @State private var navigationPath = NavigationPath()

    var hasData: Bool {
        connector.currentBaby != nil || connector.widgetData != nil
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            if hasData {
                MainView(connector: connector, navigationPath: $navigationPath)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "iphone.and.arrow.forward")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text(L.openSofiBaby)
                        .font(.headline)
                    Text(L.onYourIPhoneToSync)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button {
                        connector.requestFreshData()
                    } label: {
                        Label(L.retry, systemImage: "arrow.clockwise")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .padding(.top, 4)
                }
            }
        }
        .onOpenURL { url in
            guard url.scheme == "sofibaby-watch",
                  let host = url.host,
                  let activity = WatchActivityType(rawValue: host) else { return }
            navigationPath.removeLast(navigationPath.count)
            navigationPath.append(activity)
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Main View

struct MainView: View {
    @ObservedObject var connector: PhoneConnector
    @Binding var navigationPath: NavigationPath

    var currentBabyData: BabyWatchData? {
        connector.currentBaby
    }

    var legacyData: WatchWidgetData? {
        connector.widgetData
    }

    var babyName: String {
        currentBabyData?.name ?? legacyData?.babyName ?? L.baby
    }

    var activities: WatchActivityData {
        currentBabyData?.activities ?? legacyData?.activities ?? WatchActivityData(
            feeding: .init(lastTime: nil, todayCount: 0, lastSide: nil, lastType: nil),
            sleep: .init(lastTime: nil, todayMinutes: 0, lastDurationMinutes: nil, isActive: false, sleepType: nil),
            diaper: .init(lastTime: nil, todayCounts: .init(wet: 0, dirty: 0, mixed: 0, dry: 0)),
            pumping: .init(lastTime: nil, todayVolumeMl: 0, lastSide: nil, sessionCount: nil),
            tummyTime: .init(lastTime: nil, todayMinutes: 0, goalMinutes: 30, lastDurationMinutes: nil)
        )
    }

    var allTimers: [WatchActiveTimer] {
        connector.combinedActiveTimers
    }

    var showBabySelector: Bool {
        connector.allBabies.count > 1
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                if showBabySelector {
                    BabySelectorView(connector: connector)
                } else {
                    Text(babyName)
                        .font(.system(.headline, design: .serif))
                        .italic()
                        .padding(.bottom, 2)
                }

                if connector.isTokenStale {
                    Text(L.openIPhoneAppToRefresh)
                        .font(.system(.caption2))
                        .foregroundColor(.orange)
                        .multilineTextAlignment(.center)
                }

                ForEach(allTimers, id: \.type) { timer in
                    ActiveTimerCard(timer: timer, connector: connector)
                }

                ForEach(WatchActivityType.allCases, id: \.self) { activity in
                    NavigationLink(value: activity) {
                        ActivityRowView(
                            activity: activity,
                            activities: activities,
                            allTimers: allTimers,
                            localDiaperTime: activity == .diaper ? connector.lastLocalDiaperTime : nil
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 2)
        }
        .navigationDestination(for: WatchActivityType.self) { activity in
            destinationView(for: activity)
        }
    }

    @ViewBuilder
    func destinationView(for activity: WatchActivityType) -> some View {
        switch activity {
        case .feeding:
            FeedingMenuView(data: activities.feeding, allTimers: allTimers, connector: connector)
        case .sleep:
            SleepDetailView(data: activities.sleep, allTimers: allTimers, connector: connector)
        case .diaper:
            DiaperDetailView(data: activities.diaper, connector: connector, navigationPath: $navigationPath)
        case .pumping:
            PumpingDetailView(data: activities.pumping, allTimers: allTimers, connector: connector)
        case .tummyTime:
            TummyTimeDetailView(data: activities.tummyTime, allTimers: allTimers, connector: connector)
        }
    }
}

// MARK: - Baby Selector View

struct BabySelectorView: View {
    @ObservedObject var connector: PhoneConnector

    var currentBabyName: String {
        connector.currentBaby?.name ?? connector.widgetData?.babyName ?? L.selectBaby
    }

    var body: some View {
        NavigationLink {
            BabyPickerView(connector: connector)
        } label: {
            HStack(spacing: 4) {
                Text(currentBabyName)
                    .font(.system(.headline, design: .serif))
                    .italic()
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.white.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .padding(.bottom, 2)
    }
}

struct BabyPickerView: View {
    @ObservedObject var connector: PhoneConnector
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            ForEach(connector.allBabies, id: \.id) { baby in
                Button {
                    connector.selectBaby(babyId: baby.id)
                    dismiss()
                } label: {
                    HStack {
                        Text(baby.name)
                            .font(.system(.body, design: .serif))
                        Spacer()
                        if baby.id == connector.selectedBabyId {
                            Image(systemName: "checkmark")
                                .foregroundStyle(.green)
                        }
                    }
                }
            }
        }
        .navigationTitle(L.selectBaby)
    }
}

// MARK: - Activity Row

struct ActivityRowView: View {
    let activity: WatchActivityType
    let activities: WatchActivityData
    let allTimers: [WatchActiveTimer]
    var localDiaperTime: Date? = nil

    var isActive: Bool {
        allTimers.contains { $0.type == activity.rawValue }
    }

    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(activity.backgroundColor)
                    .frame(width: 26, height: 26)
                Text(activity.emoji)
                    .font(.system(size: 12))
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(activity.label)
                    .font(.system(size: 11, weight: .medium))
                if isActive {
                    Text(L.active)
                        .font(.system(size: 9))
                        .foregroundStyle(activity.primaryColor)
                } else {
                    TimelineView(.periodic(from: .now, by: 60)) { _ in
                        Text(String(format: L.timeAgo, getTimeSince()))
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            ZStack {
                Circle()
                    .fill(activity.primaryColor.opacity(0.25))
                    .frame(width: 22, height: 22)
                Image(systemName: "plus")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(activity.primaryColor)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(Color.white.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    func getTimeSince() -> String {
        switch activity {
        case .feeding: return formatTimeSince(activities.feeding.lastTime)
        case .sleep: return formatTimeSince(activities.sleep.lastTime)
        case .diaper:
            // Use local time if available and more recent
            if let localTime = localDiaperTime {
                return formatTimeSinceDate(localTime)
            }
            return formatTimeSince(activities.diaper.lastTime)
        case .pumping: return formatTimeSince(activities.pumping.lastTime)
        case .tummyTime: return formatTimeSince(activities.tummyTime.lastTime)
        }
    }
}

func formatTimeSinceDate(_ date: Date, now: Date = Date()) -> String {
    let totalMinutes = max(0, Int(now.timeIntervalSince(date)) / 60)
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60
    let days = hours / 24

    if days >= 365 {
        let years = days / 365
        return L.yearsCount(years)
    }
    if days >= 60 {
        let months = min(11, days / 30)
        return L.monthsCount(months)
    }
    if days >= 1 {
        return L.daysCount(days)
    }
    if hours > 0 {
        return String(format: L.durationHoursMinutesShort, hours, minutes)
    }
    return String(format: L.durationMinutesShort, totalMinutes)
}

// MARK: - Active Timer Card

struct ActiveTimerCard: View {
    let timer: WatchActiveTimer
    @ObservedObject var connector: PhoneConnector

    var activityType: WatchActivityType? {
        WatchActivityType(rawValue: timer.type)
    }

    var startDate: Date? {
        parseDate(timer.startTime)
    }

    var hasSideSwitch: Bool {
        (timer.type == "feeding" || timer.type == "pumping") && timer.isRemote != true
    }

    var isPaused: Bool {
        timer.isPaused == true
    }

    var isRemote: Bool {
        timer.isRemote == true
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                if let activity = activityType {
                    Text(activity.emoji)
                        .font(.system(size: 11))
                    Text(activity.label)
                        .font(.system(size: 9, weight: .semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(activity.primaryColor)
                }
                if isRemote {
                    Image(systemName: "person.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if isPaused, let accumulated = timer.accumulatedSeconds {
                    Text(formatElapsedSeconds(accumulated))
                        .font(.system(.body, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                } else if let start = startDate {
                    Text(start, style: .timer)
                        .font(.system(.body, design: .monospaced))
                        .monospacedDigit()
                }
            }

            HStack(spacing: 4) {
                if let context = timer.context {
                    Text(isRemote ? context : localizedToken(context))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if isPaused {
                    Text(L.paused)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.orange)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if !isRemote {
                HStack(spacing: 6) {
                    if hasSideSwitch, let context = timer.context {
                        Button {
                            connector.switchSide(activityType: timer.type, currentSide: context)
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: "arrow.left.arrow.right")
                                    .font(.system(size: 8))
                                Text(L.switchLabel)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                        }
                        .buttonStyle(.bordered)
                    }

                    if isPaused {
                        Button {
                            connector.resumeTimer(activityType: timer.type)
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 8))
                                Text(L.resume)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    } else {
                        Button {
                            connector.pauseTimer(activityType: timer.type)
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: "pause.fill")
                                    .font(.system(size: 8))
                                Text(L.pause)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                        }
                        .buttonStyle(.bordered)
                    }

                    Button {
                        connector.stopTimer(activityType: timer.type)
                    } label: {
                        Text(L.stop)
                            .font(.system(size: 10, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                }
            }
        }
        .padding(8)
        .background(activityType?.backgroundColor ?? Color.gray.opacity(0.2))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

func formatElapsedSeconds(_ seconds: Int) -> String {
    let h = seconds / 3600
    let m = (seconds % 3600) / 60
    let s = seconds % 60
    if h > 0 {
        return String(format: "%d:%02d:%02d", h, m, s)
    }
    return String(format: "%d:%02d", m, s)
}

// MARK: - Feeding Menu View

struct FeedingMenuView: View {
    let data: WatchActivityData.FeedingData
    let allTimers: [WatchActiveTimer]
    @ObservedObject var connector: PhoneConnector

    var feedingTimer: WatchActiveTimer? {
        allTimers.first { $0.type == "feeding" }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let timer = feedingTimer {
                    ActiveTimerCard(timer: timer, connector: connector)
                }

                TimelineView(.periodic(from: .now, by: 60)) { _ in
                    InfoRow(label: L.last, value: String(format: L.timeAgo, formatTimeSince(data.lastTime)))
                }
                InfoRow(label: L.today, value: L.todayFeedingsCount(data.todayCount))

                Divider().padding(.vertical, 2)

                NavigationLink {
                    BreastFeedingView(data: data, allTimers: allTimers, connector: connector)
                } label: {
                    OptionRow(emoji: "🤱", label: L.breast, color: WatchActivityType.feeding.primaryColor)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    BottleFeedingView(connector: connector)
                } label: {
                    OptionRow(emoji: "🍼", label: L.bottle, color: WatchActivityType.feeding.primaryColor)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(L.feeding)
    }
}

struct OptionRow: View {
    let emoji: String
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 7)
                    .fill(color.opacity(0.15))
                    .frame(width: 24, height: 24)
                Text(emoji)
                    .font(.system(size: 11))
            }
            Text(label)
                .font(.system(size: 12, weight: .medium))
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .opacity(0.5)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(Color.white.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Breast Feeding View

struct BreastFeedingView: View {
    let data: WatchActivityData.FeedingData
    let allTimers: [WatchActiveTimer]
    @ObservedObject var connector: PhoneConnector

    var feedingTimer: WatchActiveTimer? {
        allTimers.first { $0.type == "feeding" }
    }

    var suggested: String {
        suggestedSide(lastSide: data.lastSide)
    }

    var body: some View {
        VStack(spacing: 10) {
            if let timer = feedingTimer {
                ActiveTimerCard(timer: timer, connector: connector)
            } else {
                Text(String(format: L.suggestedSide, localizedToken(suggested)))
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WatchActivityType.feeding.primaryColor)

                HStack(spacing: 20) {
                    SideButton(
                        letter: "L",
                        label: L.left,
                        color: WatchActivityType.feeding.primaryColor,
                        isHighlighted: suggested == "left"
                    ) {
                        connector.startTimer(activityType: "feeding", context: "left")
                    }

                    SideButton(
                        letter: "R",
                        label: L.right,
                        color: WatchActivityType.feeding.primaryColor,
                        isHighlighted: suggested == "right"
                    ) {
                        connector.startTimer(activityType: "feeding", context: "right")
                    }
                }
            }

            TimelineView(.periodic(from: .now, by: 60)) { _ in
                if let side = data.lastSide {
                    Text(String(format: L.lastSideAgo, localizedToken(side), formatTimeSince(data.lastTime)))
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .navigationTitle(L.breast)
    }
}

// MARK: - Bottle Feeding View

struct BottleFeedingView: View {
    @ObservedObject var connector: PhoneConnector

    @State private var volumeDouble: Double = 120
    var volumeMl: Int { Int(volumeDouble) }
    @State private var contentType: String = "formula"
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("\(volumeMl)")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .monospacedDigit()
                + Text(L.ml)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)

                HStack(spacing: 20) {
                    Button {
                        volumeDouble = max(0, volumeDouble - 10)
                    } label: {
                        Image(systemName: "minus")
                            .font(.system(size: 14))
                            .frame(width: 32, height: 32)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)

                    Button {
                        volumeDouble = min(500, volumeDouble + 10)
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 14))
                            .frame(width: 32, height: 32)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }

                Text(L.useDigitalCrown)
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)

                HStack(spacing: 4) {
                    ToggleButton(label: L.formula, isActive: contentType == "formula", color: WatchActivityType.feeding.primaryColor) {
                        contentType = "formula"
                    }
                    ToggleButton(label: L.breastMilk, isActive: contentType == "breastMilk", color: WatchActivityType.feeding.primaryColor) {
                        contentType = "breastMilk"
                    }
                }
                .padding(3)
                .background(Color.white.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))

                Button {
                    connector.logBottleFeeding(volumeMl: volumeMl, contentType: contentType)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { dismiss() }
                } label: {
                    Text(L.save)
                        .font(.system(size: 11, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .tint(WatchActivityType.feeding.primaryColor)
            }
            .padding(.horizontal, 4)
        }
        .focusable()
        .digitalCrownRotation($volumeDouble, from: 0, through: 500, by: 5)
        .navigationTitle(L.bottle)
    }
}

struct ToggleButton: View {
    let label: String
    let isActive: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 9, weight: isActive ? .semibold : .regular))
                .foregroundStyle(isActive ? .white : .secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(isActive ? color : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Sleep Detail View

struct SleepDetailView: View {
    let data: WatchActivityData.SleepData
    let allTimers: [WatchActiveTimer]
    @ObservedObject var connector: PhoneConnector

    var sleepTimer: WatchActiveTimer? {
        allTimers.first { $0.type == "sleep" }
    }

    var awakeMinutes: Int? {
        guard let endedAt = data.lastSleepEndedAt, let date = parseDate(endedAt) else { return nil }
        let minutes = Int(Date().timeIntervalSince(date)) / 60
        return minutes >= 0 ? minutes : nil
    }

    var body: some View {
        VStack(spacing: 10) {
            if data.morningConfirmationPending == true {
                Text(L.confirmInSofiBaby)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(WatchActivityType.sleep.primaryColor)
                    .multilineTextAlignment(.center)
            }

            if let timer = sleepTimer {
                ActiveTimerCard(timer: timer, connector: connector)
            } else {
                TimelineView(.periodic(from: .now, by: 60)) { _ in
                    if let awake = awakeMinutes, let window = data.wakeWindowMinutes, window > 0 {
                        VStack(spacing: 4) {
                            Text(String(format: L.awakeDuration, formatSleepDuration(awake)))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(awake >= window ? .red : .primary)
                            Text(String(format: L.nextNapIn, formatSleepDuration(max(0, window - awake))))
                                .font(.system(size: 10))
                                .foregroundStyle(awake >= window ? .red : WatchActivityType.sleep.primaryColor)
                        }
                    } else if let awake = awakeMinutes {
                        Text(String(format: L.awakeDuration, formatSleepDuration(awake)))
                            .font(.system(size: 12, weight: .semibold))
                    }
                }

                SideButton(
                    letter: "😴",
                    label: L.sleep,
                    color: WatchActivityType.sleep.primaryColor,
                    isHighlighted: true,
                    isEmoji: true
                ) {
                    connector.startTimer(activityType: "sleep", context: "auto")
                }
            }

            TimelineView(.periodic(from: .now, by: 60)) { _ in
                if sleepTimer == nil, awakeMinutes == nil, let window = data.wakeWindowMinutes, window > 0 {
                    Text(String(format: L.wakeWindowDuration, formatSleepDuration(window)))
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .navigationTitle(L.sleep)
    }
}

func formatSleepDuration(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    if h > 0 {
        return String(format: L.durationHoursMinutesShort, h, m)
    }
    return String(format: L.durationMinutesShort, m)
}

// MARK: - Diaper Detail View

struct DiaperDetailView: View {
    let data: WatchActivityData.DiaperData
    @ObservedObject var connector: PhoneConnector
    @Binding var navigationPath: NavigationPath
    @Environment(\.dismiss) private var dismiss
    @State private var showColorPicker = false
    @State private var colorPickerDiaperType = "dirty"

    var combinedCounts: WatchActivityData.DiaperData.DiaperCounts {
        connector.combinedDiaperCounts(serverCounts: data.todayCounts)
    }

    var lastDiaperTimeText: String? {
        if let localTime = connector.lastLocalDiaperTime {
            return String(format: L.lastTimeAgo, formatTimeSinceDate(localTime))
        }
        if let lastTime = data.lastTime {
            return String(format: L.lastTimeAgo, formatTimeSince(lastTime))
        }
        return nil
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if connector.hasPendingDiaperLogs {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 10))
                        Text(L.syncing)
                            .font(.system(size: 10))
                    }
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 2)
                }

                TimelineView(.periodic(from: .now, by: 60)) { _ in
                    if let timeText = lastDiaperTimeText {
                        Text(timeText)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }

                HStack(spacing: 3) {
                    StatBadge(value: "\(combinedCounts.wet)", label: L.wet, color: WatchActivityType.diaper.primaryColor)
                    StatBadge(value: "\(combinedCounts.dirty)", label: L.dirty, color: WatchActivityType.diaper.primaryColor)
                    StatBadge(value: "\(combinedCounts.mixed)", label: L.mixed, color: WatchActivityType.diaper.primaryColor)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    DiaperButton(emoji: "\u{1F4A7}", color: WatchActivityType.diaper.primaryColor) {
                        connector.logDiaper(type: "wet")
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { dismiss() }
                    }
                    DiaperButton(emoji: "\u{1F4A9}", color: WatchActivityType.diaper.primaryColor) {
                        colorPickerDiaperType = "dirty"
                        showColorPicker = true
                    }
                    DiaperButton(emoji: "\u{1F4A7}\u{1F4A9}", color: WatchActivityType.diaper.primaryColor) {
                        colorPickerDiaperType = "mixed"
                        showColorPicker = true
                    }
                    DiaperButton(emoji: "\u{2728}", color: WatchActivityType.diaper.primaryColor) {
                        connector.logDiaper(type: "dry")
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { dismiss() }
                    }
                }
                .padding(.horizontal, 6)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(L.diaper)
        .navigationDestination(isPresented: $showColorPicker) {
            StoolColorPickerView(diaperType: colorPickerDiaperType, connector: connector, navigationPath: $navigationPath)
        }
    }
}

struct StoolColorPickerView: View {
    let diaperType: String
    @ObservedObject var connector: PhoneConnector
    @Binding var navigationPath: NavigationPath

    private let stoolColors: [(name: String, color: Color)] = [
        ("yellow", Color(red: 0.918, green: 0.702, blue: 0.031)),
        ("brown", Color(red: 0.573, green: 0.251, blue: 0.055)),
        ("green", Color(red: 0.086, green: 0.639, blue: 0.290)),
        ("orange", Color(red: 0.918, green: 0.345, blue: 0.047)),
        ("black", Color(red: 0.110, green: 0.098, blue: 0.090)),
        ("white", Color(red: 0.831, green: 0.831, blue: 0.847)),
        ("red", Color(red: 0.863, green: 0.149, blue: 0.149)),
    ]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(stoolColors, id: \.name) { item in
                    Button {
                        connector.logDiaper(type: diaperType, stoolColor: item.name)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { navigationPath = NavigationPath() }
                    } label: {
                        Circle()
                            .fill(item.color)
                            .frame(width: 40, height: 40)
                            .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle(L.color)
    }
}

struct DiaperButton: View {
    let emoji: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(emoji)
                .font(.system(size: 28))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(color.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }
}

struct StatBadge: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 7))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
        .background(Color.white.opacity(0.08).opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

// MARK: - Pumping Volume Entry View

struct PumpingVolumeEntryView: View {
    @ObservedObject var connector: PhoneConnector
    @Environment(\.dismiss) private var dismiss
    @State private var volumeDouble: Double = 0
    var volumeMl: Int { Int(volumeDouble) }

    var body: some View {
        VStack(spacing: 8) {
            Text("\(volumeMl)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .monospacedDigit()
            + Text(L.ml)
                .font(.system(size: 11))
                .foregroundColor(.secondary)

            HStack(spacing: 20) {
                Button {
                    volumeDouble = max(0, volumeDouble - 10)
                } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 14))
                        .frame(width: 32, height: 32)
                        .background(Color.white.opacity(0.12))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)

                Button {
                    volumeDouble = min(500, volumeDouble + 10)
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 14))
                        .frame(width: 32, height: 32)
                        .background(Color.white.opacity(0.12))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }

            Text(L.useDigitalCrown)
                .font(.system(size: 8))
                .foregroundStyle(.secondary)

            Button {
                connector.stopPumpingWithVolume(volumeMl: volumeMl)
                dismiss()
            } label: {
                Text(L.save)
                    .font(.system(size: 11, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(WatchActivityType.pumping.primaryColor)
        }
        .focusable()
        .digitalCrownRotation($volumeDouble, from: 0, through: 500, by: 5)
        .navigationTitle(L.volume)
    }
}

// MARK: - Pumping Active Card

struct PumpingActiveCard: View {
    let timer: WatchActiveTimer
    @ObservedObject var connector: PhoneConnector
    @Binding var showVolumeEntry: Bool

    var startDate: Date? {
        parseDate(timer.startTime)
    }

    var isPaused: Bool {
        timer.isPaused == true
    }

    var isRemote: Bool {
        timer.isRemote == true
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text(WatchActivityType.pumping.emoji)
                    .font(.system(size: 11))
                Text(WatchActivityType.pumping.label)
                    .font(.system(size: 9, weight: .semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(WatchActivityType.pumping.primaryColor)
                if isRemote {
                    Image(systemName: "person.fill")
                        .font(.system(size: 8))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if isPaused, let accumulated = timer.accumulatedSeconds {
                    Text(formatElapsedSeconds(accumulated))
                        .font(.system(.body, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                } else if let start = startDate {
                    Text(start, style: .timer)
                        .font(.system(.body, design: .monospaced))
                        .monospacedDigit()
                }
            }

            HStack(spacing: 4) {
                if let context = timer.context {
                    Text(isRemote ? context : localizedToken(context))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if isPaused {
                    Text(L.paused)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.orange)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if !isRemote {
                HStack(spacing: 6) {
                    if let context = timer.context, !isPaused {
                        Button {
                            connector.switchSide(activityType: timer.type, currentSide: context)
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: "arrow.left.arrow.right")
                                    .font(.system(size: 8))
                                Text(L.switchLabel)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                        }
                        .buttonStyle(.bordered)
                    }

                    if isPaused {
                        Button {
                            connector.resumeTimer(activityType: timer.type)
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 8))
                                Text(L.resume)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    } else {
                        Button {
                            connector.pauseTimer(activityType: timer.type)
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: "pause.fill")
                                    .font(.system(size: 8))
                                Text(L.pause)
                                    .font(.system(size: 10, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                        }
                        .buttonStyle(.bordered)
                    }

                    Button {
                        showVolumeEntry = true
                    } label: {
                        Text(L.stop)
                            .font(.system(size: 10, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 5)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                }
            }
        }
        .padding(8)
        .background(WatchActivityType.pumping.backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Pumping Detail View

struct PumpingDetailView: View {
    let data: WatchActivityData.PumpingData
    let allTimers: [WatchActiveTimer]
    @ObservedObject var connector: PhoneConnector
    @State private var showVolumeEntry = false

    var pumpingTimer: WatchActiveTimer? {
        allTimers.first { $0.type == "pumping" }
    }

    var suggested: String {
        suggestedSide(lastSide: data.lastSide)
    }

    var body: some View {
        VStack(spacing: 6) {
            if let timer = pumpingTimer {
                PumpingActiveCard(timer: timer, connector: connector, showVolumeEntry: $showVolumeEntry)
            } else {
                Text(String(format: L.suggestedSide, localizedToken(suggested)))
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WatchActivityType.pumping.primaryColor)

                HStack(spacing: 24) {
                    SideButton(
                        letter: "L",
                        label: L.left,
                        color: WatchActivityType.pumping.primaryColor,
                        isHighlighted: suggested == "left"
                    ) {
                        connector.startTimer(activityType: "pumping", context: "left")
                    }

                    SideButton(
                        letter: "R",
                        label: L.right,
                        color: WatchActivityType.pumping.primaryColor,
                        isHighlighted: suggested == "right"
                    ) {
                        connector.startTimer(activityType: "pumping", context: "right")
                    }
                }
            }

            Text(String(format: L.todayVolumeMl, data.todayVolumeMl))
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
        .padding()
        .navigationTitle(L.pumping)
        .navigationDestination(isPresented: $showVolumeEntry) {
            PumpingVolumeEntryView(connector: connector)
        }
    }
}

// MARK: - Tummy Time Detail View

struct TummyTimeDetailView: View {
    let data: WatchActivityData.TummyTimeData
    let allTimers: [WatchActiveTimer]
    @ObservedObject var connector: PhoneConnector

    var tummyTimer: WatchActiveTimer? {
        allTimers.first { $0.type == "tummyTime" }
    }

    var body: some View {
        VStack(spacing: 6) {
            if let timer = tummyTimer {
                ActiveTimerCard(timer: timer, connector: connector)
            } else {
                Button {
                    connector.startTimer(activityType: "tummyTime")
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 22))
                        Text(L.start)
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(WatchActivityType.tummyTime.primaryColor)
                    .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }

            Text(String(format: L.todayMinutes, data.todayMinutes))
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
        .padding()
        .navigationTitle(L.tummyTime)
    }
}

// MARK: - Shared Components

struct SideButton: View {
    let letter: String
    let label: String
    let color: Color
    var isHighlighted: Bool = true
    var isEmoji: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                ZStack {
                    Circle()
                        .fill(color)
                        .frame(width: 60, height: 60)
                        .opacity(isHighlighted ? 1.0 : 0.4)
                        .shadow(color: isHighlighted ? color.opacity(0.3) : .clear, radius: 8)
                    if isEmoji {
                        Text(letter)
                            .font(.system(size: 22))
                    } else {
                        Text(letter)
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                Text(label)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
    }
}

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
        .font(.caption)
    }
}

struct ProgressRingView: View {
    let progress: Double
    let color: Color
    let valueText: String
    let labelText: String

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.15), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .frame(width: 72, height: 72)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .frame(width: 72, height: 72)
                .rotationEffect(.degrees(-90))

            VStack(spacing: 1) {
                Text(valueText)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(color)
                Text(labelText)
                    .font(.system(size: 7))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
            }
        }
    }
}

// MARK: - App Entry Point

@main
struct SofiBabyWatchApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

// MARK: - Previews

#Preview {
    ContentView()
}
