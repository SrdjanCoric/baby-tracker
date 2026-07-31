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
        case .feeding: return "Feeding"
        case .sleep: return "Sleep"
        case .diaper: return "Diaper"
        case .pumping: return "Pumping"
        case .tummyTime: return "Tummy Time"
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

    // Supabase auth credentials (received via applicationContext, persisted to UserDefaults)
    private var supabaseUrl: String?
    private var supabaseAnonKey: String?
    private var supabaseAccessToken: String?
    private var supabaseUserId: String?

    private var liveActivityPushToken: String?
    private var pushToStartToken: String?

    private var networkPollTimer: Timer?

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
        supabaseAccessToken = defaults?.string(forKey: "watchSupabaseAccessToken")
        supabaseUserId = defaults?.string(forKey: "watchSupabaseUserId")
        liveActivityPushToken = defaults?.string(forKey: "watchLiveActivityPushToken")
        pushToStartToken = defaults?.string(forKey: "watchPushToStartToken")
        print("[WatchConnector] init: selectedBabyId = \(selectedBabyId ?? "nil"), hasAuth = \(supabaseAccessToken != nil), hasLAPushToken = \(liveActivityPushToken != nil)")
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
        return multiBabyData?.babies.first { $0.id == babyId } ?? multiBabyData?.babies.first
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
        let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app")

        // Build combined active timers
        let combinedTimers = combinedActiveTimers

        // Update multiBabyData cache if available
        if var multiBaby = multiBabyData {
            // Update the selected baby's active timers
            if let babyIndex = multiBaby.babies.firstIndex(where: { $0.id == currentBabyId }) {
                multiBaby.babies[babyIndex].activeTimers = combinedTimers

                // Update diaper counts for the selected baby
                let serverCounts = multiBaby.babies[babyIndex].activities.diaper.todayCounts
                let combinedCounts = combinedDiaperCounts(serverCounts: serverCounts)
                multiBaby.babies[babyIndex].activities.diaper.todayCounts = combinedCounts

                // Update last diaper time if we have local logs
                if let localTime = lastLocalDiaperTime {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    multiBaby.babies[babyIndex].activities.diaper.lastTime = formatter.string(from: localTime)
                }

                // Update last activity times for stopped timers
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let feedingTime = localStoppedActivityTimes["feeding"] {
                    multiBaby.babies[babyIndex].activities.feeding.lastTime = formatter.string(from: feedingTime)
                }
                if let sleepTime = localStoppedActivityTimes["sleep"] {
                    multiBaby.babies[babyIndex].activities.sleep.lastTime = formatter.string(from: sleepTime)
                }
                if let pumpingTime = localStoppedActivityTimes["pumping"] {
                    multiBaby.babies[babyIndex].activities.pumping.lastTime = formatter.string(from: pumpingTime)
                }
                if let tummyTime = localStoppedActivityTimes["tummyTime"] {
                    multiBaby.babies[babyIndex].activities.tummyTime.lastTime = formatter.string(from: tummyTime)
                }
            }

            multiBaby.updatedAt = ISO8601DateFormatter().string(from: Date())

            if let encoded = try? JSONEncoder().encode(multiBaby),
               let jsonString = String(data: encoded, encoding: .utf8) {
                userDefaults?.set(jsonString, forKey: "multiBabyWatchData")
                print("[WatchConnector] syncOptimisticStateToCache: updated multiBabyWatchData with \(combinedTimers.count) timers")
            }
        }

        // Update widgetData cache if available
        if var widget = widgetData {
            widget.activeTimers = combinedTimers
            widget.activeTimer = combinedTimers.first

            // Update diaper counts
            let serverCounts = widget.activities.diaper.todayCounts
            let combinedCounts = combinedDiaperCounts(serverCounts: serverCounts)
            widget.activities.diaper.todayCounts = combinedCounts

            // Update last diaper time if we have local logs
            if let localTime = lastLocalDiaperTime {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                widget.activities.diaper.lastTime = formatter.string(from: localTime)
            }

            // Update last activity times for stopped timers
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let feedingTime = localStoppedActivityTimes["feeding"] {
                widget.activities.feeding.lastTime = formatter.string(from: feedingTime)
            }
            if let sleepTime = localStoppedActivityTimes["sleep"] {
                widget.activities.sleep.lastTime = formatter.string(from: sleepTime)
            }
            if let pumpingTime = localStoppedActivityTimes["pumping"] {
                widget.activities.pumping.lastTime = formatter.string(from: pumpingTime)
            }
            if let tummyTime = localStoppedActivityTimes["tummyTime"] {
                widget.activities.tummyTime.lastTime = formatter.string(from: tummyTime)
            }

            widget.updatedAt = ISO8601DateFormatter().string(from: Date())

            if let encoded = try? JSONEncoder().encode(widget),
               let jsonString = String(data: encoded, encoding: .utf8) {
                userDefaults?.set(jsonString, forKey: "watchData")
                // Also update "widgetData" key which iOS widget reads for complications
                userDefaults?.set(jsonString, forKey: "widgetData")
                print("[WatchConnector] syncOptimisticStateToCache: updated watchData and widgetData with \(combinedTimers.count) timers")
            }
        }

        // Trigger complication refresh
        WidgetCenter.shared.reloadAllTimelines()
        print("[WatchConnector] syncOptimisticStateToCache: triggered WidgetCenter reload")
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
            self.requestFreshData()
        }
    }

    private func parseApplicationContext(_ context: [String: Any]) {
        // Extract and persist auth credentials
        if let url = context["supabaseUrl"] as? String,
           let anonKey = context["supabaseAnonKey"] as? String,
           let token = context["accessToken"] as? String,
           let userId = context["userId"] as? String {
            self.supabaseUrl = url
            self.supabaseAnonKey = anonKey
            self.supabaseAccessToken = token
            self.supabaseUserId = userId
            self.isTokenStale = false
            let defaults = UserDefaults(suiteName: "group.com.sofibaby.app")
            defaults?.set(url, forKey: "watchSupabaseUrl")
            defaults?.set(anonKey, forKey: "watchSupabaseAnonKey")
            defaults?.set(token, forKey: "watchSupabaseAccessToken")
            defaults?.set(userId, forKey: "watchSupabaseUserId")
            print("[WatchConnector] parseApplicationContext: stored auth credentials")
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
                self.selectedBabyId = decoded.selectedBabyId
                self.cacheData(dataString, forKey: "multiBabyWatchData")
                // Clear local optimistic data - phone data is source of truth
                self.localActiveTimers.removeAll()
                self.locallyStoppedTimerTypes.removeAll()
                self.localStoppedActivityTimes.removeAll()
                self.pendingDiaperLogs.removeAll()
                print("[WatchConnector] parseApplicationContext: cleared local data, using server data")
            }
        }

        if let dataString = context["widgetData"] as? String,
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data) {
            DispatchQueue.main.async {
                print("[WatchConnector] parseApplicationContext: received widgetData")
                let timerCount = decoded.activeTimers?.count ?? (decoded.activeTimer != nil ? 1 : 0)
                print("[WatchConnector] parseApplicationContext: \(timerCount) active timers in widgetData")
                self.widgetData = decoded
                self.cacheData(dataString, forKey: "watchData")
                if self.selectedBabyId == nil {
                    self.selectedBabyId = decoded.babyId
                }
                // Clear local optimistic data - phone data is source of truth
                self.localActiveTimers.removeAll()
                self.locallyStoppedTimerTypes.removeAll()
                self.localStoppedActivityTimes.removeAll()
                self.pendingDiaperLogs.removeAll()
                print("[WatchConnector] parseApplicationContext: cleared local data, using server data")
            }
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable {
                self.requestFreshData()
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    self.requestFreshData()
                }
            } else {
                self.refreshFromNetwork()
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
    func sendAction(_ message: [String: Any]) {
        var messageWithId = message
        messageWithId["requestId"] = UUID().uuidString

        print("[WatchConnector] sendAction called with: \(messageWithId)")

        guard let session = session else {
            print("[WatchConnector] ERROR: session is nil!")
            return
        }

        guard session.activationState == .activated else {
            print("[WatchConnector] ERROR: session not activated yet (state: \(session.activationState.rawValue))")
            return
        }

        // Always queue via transferUserInfo for guaranteed delivery
        // (sendMessage is unreliable when the phone app is backgrounded)
        session.transferUserInfo(messageWithId)

        if session.isReachable {
            print("[WatchConnector] Sending immediate message + queued via transferUserInfo")
            session.sendMessage(messageWithId, replyHandler: nil) { error in
                print("[WatchConnector] sendMessage failed (transferUserInfo already queued): \(error)")
            }
        } else {
            print("[WatchConnector] Action queued via transferUserInfo (not reachable)")
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
        sendAction(message)

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
        sendAction(message)

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
        sendAction(message)

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
        guard canPerformAction() else { return }

        var message: [String: Any] = [
            "action": "pauseTimer",
            "activityType": activityType
        ]
        if let babyId = currentBabyId {
            message["babyId"] = babyId
        }
        sendAction(message)

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
        guard canPerformAction() else { return }

        var message: [String: Any] = [
            "action": "resumeTimer",
            "activityType": activityType
        ]
        if let babyId = currentBabyId {
            message["babyId"] = babyId
        }
        sendAction(message)

        DispatchQueue.main.async {
            var accumulated: Int?
            var timerContext: String?
            if let index = self.localActiveTimers.firstIndex(where: { $0.type == activityType }) {
                accumulated = self.localActiveTimers[index].accumulatedSeconds
                timerContext = self.localActiveTimers[index].context
                if let acc = accumulated {
                    let newStart = Date().addingTimeInterval(-Double(acc))
                    self.localActiveTimers[index].startTime = ISO8601DateFormatter().string(from: newStart)
                }
                self.localActiveTimers[index].isPaused = false
                self.localActiveTimers[index].accumulatedSeconds = nil
            } else if var serverTimer = self.findServerTimer(activityType: activityType) {
                accumulated = serverTimer.accumulatedSeconds
                timerContext = serverTimer.context
                if let acc = accumulated {
                    let newStart = Date().addingTimeInterval(-Double(acc))
                    serverTimer.startTime = ISO8601DateFormatter().string(from: newStart)
                }
                serverTimer.isPaused = false
                serverTimer.accumulatedSeconds = nil
                self.localActiveTimers.append(serverTimer)
            }
            self.syncOptimisticStateToCache()

            self.supabaseTogglePause(activityType: activityType, action: "resume", accumulatedSeconds: accumulated, timerContext: timerContext)
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
        localActiveTimers.removeAll()
        locallyStoppedTimerTypes.removeAll()
        localStoppedActivityTimes.removeAll()
        pendingDiaperLogs.removeAll()
        sendAction([
            "action": "selectBaby",
            "babyId": babyId
        ])
        WKInterfaceDevice.current().play(.click)
    }

    private func loadCachedData() {
        let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app")

        if let dataString = userDefaults?.string(forKey: "multiBabyWatchData"),
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(MultiBabyWatchData.self, from: data) {
            self.multiBabyData = decoded
            if self.selectedBabyId == nil {
                self.selectedBabyId = decoded.selectedBabyId
            }
        }

        if let dataString = userDefaults?.string(forKey: "watchData"),
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data) {
            self.widgetData = decoded
            return
        }
        if let dataString = userDefaults?.string(forKey: "widgetData"),
           let data = dataString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data) {
            self.widgetData = decoded
        }
    }

    func requestFreshData() {
        print("[WatchConnector] requestFreshData called")
        guard let session = session, session.isReachable else {
            print("[WatchConnector] requestFreshData: session not available or not reachable")
            return
        }
        sendMessageWithReply(["action": "requestSync"]) { reply in
            print("[WatchConnector] requestFreshData: got reply")
            if let dataString = reply["widgetData"] as? String,
               let data = dataString.data(using: .utf8),
               let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data) {
                DispatchQueue.main.async {
                    self.widgetData = decoded
                    self.cacheData(dataString)
                    WidgetCenter.shared.reloadAllTimelines()
                }
            }
        }
    }

    // MARK: - Network Polling

    private func startNetworkPolling() {
        stopNetworkPolling()
        let hasActiveTimers = !combinedActiveTimers.isEmpty
        let interval: TimeInterval = hasActiveTimers ? 30 : 120
        print("[WatchConnector] startNetworkPolling: \(Int(interval))s poll (activeTimers=\(hasActiveTimers))")
        networkPollTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.refreshFromNetwork()
        }
    }

    private func stopNetworkPolling() {
        networkPollTimer?.invalidate()
        networkPollTimer = nil
    }

    // MARK: - Supabase Network Access

    private var hasAuthCredentials: Bool {
        supabaseUrl != nil && supabaseAnonKey != nil && supabaseAccessToken != nil && supabaseUserId != nil && !isTokenStale
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
            await MainActor.run {
                reconcileWithNetworkTimers(remoteTimers)
            }
        }
    }

    private func reconcileWithNetworkTimers(_ remoteTimers: [WatchActiveTimer]) {
        print("[WatchConnector] reconcileWithNetworkTimers: remote has \(remoteTimers.count) timers")

        typealias TimerKey = String
        func makeKey(type: String, startedBy: String?) -> TimerKey {
            "\(type)|\(startedBy ?? "unknown")"
        }

        let remoteKeys = Set(remoteTimers.map { makeKey(type: $0.type, startedBy: $0.startedBy) })
        let remoteTypes = Set(remoteTimers.map { $0.type })

        // Timers stopped externally (widget/other device) — remove from local state
        for type in locallyStoppedTimerTypes {
            if !remoteTypes.contains(type) {
                print("[WatchConnector] reconcileWithNetworkTimers: confirmed stop for \(type)")
            }
        }

        // Local timers that no longer exist on server — they were stopped externally
        for localTimer in localActiveTimers {
            let key = makeKey(type: localTimer.type, startedBy: localTimer.startedBy)
            if !remoteKeys.contains(key) {
                print("[WatchConnector] reconcileWithNetworkTimers: timer \(localTimer.type) stopped externally")
                localStoppedActivityTimes[localTimer.type] = Date()
            }
        }

        // Clear all local optimistic state and use network as source of truth
        localActiveTimers.removeAll()
        locallyStoppedTimerTypes.removeAll()

        // Server timers that watch doesn't know about — adopt them
        if let baby = currentBaby {
            var updatedBaby = baby
            updatedBaby.activeTimers = remoteTimers
            if var multi = multiBabyData,
               let index = multi.babies.firstIndex(where: { $0.id == baby.id }) {
                multi.babies[index] = updatedBaby
                multiBabyData = multi
            }
        } else if var widget = widgetData {
            widget.activeTimers = remoteTimers
            widget.activeTimer = remoteTimers.first
            widgetData = widget
        }

        syncOptimisticStateToCache()

        // Stop polling if no active timers remain
        if combinedActiveTimers.isEmpty {
            stopNetworkPolling()
        }
    }

    private func fetchActiveTimersFromNetwork() async -> [WatchActiveTimer]? {
        guard let supabaseUrl, let supabaseAnonKey, let supabaseAccessToken,
              let babyId = currentBabyId, let supabaseUserId else {
            return nil
        }

        let urlString = "\(supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&select=id,activity_type,started_by,started_at,timer_data"
        guard let url = URL(string: urlString) else { return nil }

        var request = URLRequest(url: url)
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAccessToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let httpResponse = response as? HTTPURLResponse else {
            print("[WatchConnector] fetchActiveTimersFromNetwork: request failed")
            return nil
        }

        if httpResponse.statusCode == 401 {
            print("[WatchConnector] fetchActiveTimersFromNetwork: 401 — stale token")
            await MainActor.run {
                self.isTokenStale = true
            }
            sendAction(["action": "requestSync"])
            return nil
        }

        guard httpResponse.statusCode == 200 else {
            print("[WatchConnector] fetchActiveTimersFromNetwork: status \(httpResponse.statusCode)")
            return nil
        }

        struct RemoteTimer: Decodable {
            let id: String
            let activity_type: String
            let started_by: String
            let started_at: String
            let timer_data: TimerDataPayload?

            struct TimerDataPayload: Decodable {
                let side: String?
                let sleepType: String?
                let isPaused: Bool?
                let accumulatedSeconds: Int?
                let effectiveStartTime: String?
                let timerInstanceId: String?
                let activityId: String?
            }
        }

        guard let remoteTimers = try? JSONDecoder().decode([RemoteTimer].self, from: data) else {
            print("[WatchConnector] fetchActiveTimersFromNetwork: decode failed")
            return nil
        }

        let activityTypeMap: [String: String] = [
            "feeding": "feeding",
            "sleep": "sleep",
            "pumping": "pumping",
            "tummy_time": "tummyTime"
        ]

        return remoteTimers.compactMap { timer in
            guard let watchType = activityTypeMap[timer.activity_type] else { return nil }
            let isRemote = timer.started_by != supabaseUserId
            let context = timer.timer_data?.side ?? timer.timer_data?.sleepType
            let startTime: String
            if !(timer.timer_data?.isPaused ?? false), let effective = timer.timer_data?.effectiveStartTime {
                startTime = effective
            } else {
                startTime = timer.started_at
            }
            return WatchActiveTimer(
                type: watchType,
                startTime: startTime,
                timerInstanceId: timer.timer_data?.timerInstanceId,
                activityId: timer.timer_data?.activityId,
                context: context,
                isRemote: isRemote,
                isPaused: timer.timer_data?.isPaused,
                accumulatedSeconds: timer.timer_data?.accumulatedSeconds,
                startedBy: timer.started_by
            )
        }
    }

    // MARK: - Supabase Write Fallbacks

    private func supabaseStartTimer(
        activityType: String,
        startTime: String,
        context: String?,
        timerInstanceId: String,
        activityId: String
    ) {
        guard hasAuthCredentials, let supabaseUrl, let supabaseAnonKey,
              let supabaseAccessToken, let supabaseUserId,
              let babyId = currentBabyId else { return }

        let dbType = activityType == "tummyTime" ? "tummy_time" : activityType
        let urlString = "\(supabaseUrl)/rest/v1/rpc/acquire_timer_lock"
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

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        request.timeoutInterval = 10

        Task {
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse {
                    print("[WatchConnector] supabaseStartTimer: status \(http.statusCode)")
                }
            } catch {
                print("[WatchConnector] supabaseStartTimer: failed — \(error.localizedDescription)")
            }
        }
    }

    private func supabaseStopTimer(activityType: String) {
        guard hasAuthCredentials, let supabaseUrl, let supabaseAnonKey,
              let supabaseAccessToken, let supabaseUserId,
              let babyId = currentBabyId else { return }

        let dbType = activityType == "tummyTime" ? "tummy_time" : activityType
        let urlString = "\(supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&activity_type=eq.\(dbType)&started_by=eq.\(supabaseUserId)"
        guard let url = URL(string: urlString) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAccessToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10

        let pushToken = self.liveActivityPushToken

        Task {
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse {
                    print("[WatchConnector] supabaseStopTimer: status \(http.statusCode)")
                }
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
        guard let supabaseUrl, let supabaseAnonKey, let supabaseAccessToken else { return }

        let urlString = "\(supabaseUrl)/functions/v1/end-live-activity"
        guard let url = URL(string: urlString) else { return }

        var body: [String: Any] = ["pushToken": pushToken]
        #if DEBUG
        body["isSandbox"] = true
        #endif

        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAccessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = jsonData
        request.timeoutInterval = 10

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse {
                print("[WatchConnector] endLiveActivityViaEdgeFunction: status \(http.statusCode)")
            }
        } catch {
            print("[WatchConnector] endLiveActivityViaEdgeFunction: failed — \(error.localizedDescription)")
        }

        // Clear the push token since the Live Activity is ended
        DispatchQueue.main.async {
            self.liveActivityPushToken = nil
            UserDefaults(suiteName: "group.com.sofibaby.app")?.removeObject(forKey: "watchLiveActivityPushToken")
        }
    }

    private func startLiveActivityViaEdgeFunction(activityType: String, startTimeUnix: Int, context: String?) {
        guard let supabaseUrl, let supabaseAnonKey, let supabaseAccessToken,
              let ptsToken = pushToStartToken, !ptsToken.isEmpty else { return }

        let babyName = currentBaby?.name ?? widgetData?.babyName ?? "Baby"
        let urlString = "\(supabaseUrl)/functions/v1/start-live-activity"
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

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAccessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = jsonData
        request.timeoutInterval = 10

        Task {
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse {
                    print("[WatchConnector] startLiveActivityViaEdgeFunction: status \(http.statusCode)")
                }
            } catch {
                print("[WatchConnector] startLiveActivityViaEdgeFunction: failed — \(error.localizedDescription)")
            }
        }
    }

    private func supabaseTogglePause(activityType: String, action: String, accumulatedSeconds: Int?, timerContext: String? = nil) {
        guard hasAuthCredentials, let supabaseUrl, let supabaseAnonKey,
              let supabaseAccessToken, let supabaseUserId,
              let babyId = currentBabyId else { return }

        let dbType = activityType == "tummyTime" ? "tummy_time" : activityType
        let urlString = "\(supabaseUrl)/functions/v1/toggle-timer-pause"
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
                let newStart = Date().addingTimeInterval(-Double(accumulatedSeconds))
                let effectiveISO = ISO8601DateFormatter().string(from: newStart)
                body["effectiveStartTimeISO"] = effectiveISO
                timerData["effectiveStartTime"] = effectiveISO
                timerData["accumulatedSeconds"] = accumulatedSeconds
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

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData
        request.timeoutInterval = 10

        Task {
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse {
                    print("[WatchConnector] supabaseTogglePause: status \(http.statusCode)")
                }
            } catch {
                print("[WatchConnector] supabaseTogglePause: failed — \(error.localizedDescription)")
            }
        }
    }

    private func cacheData(_ dataString: String, forKey key: String = "watchData") {
        let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app")
        userDefaults?.set(dataString, forKey: key)
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
                    Text("Open SofiBaby")
                        .font(.headline)
                    Text("on your iPhone to sync")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button {
                        connector.requestFreshData()
                    } label: {
                        Label("Retry", systemImage: "arrow.clockwise")
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
        currentBabyData?.name ?? legacyData?.babyName ?? "Baby"
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
                    Text("Open iPhone app to refresh")
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
        connector.currentBaby?.name ?? connector.widgetData?.babyName ?? "Select Baby"
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
        .navigationTitle("Select Baby")
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
                    Text("Active")
                        .font(.system(size: 9))
                        .foregroundStyle(activity.primaryColor)
                } else {
                    TimelineView(.periodic(from: .now, by: 60)) { _ in
                        Text(getTimeSince() + " ago")
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
        return "\(years) year\(years == 1 ? "" : "s")"
    }
    if days >= 60 {
        let months = min(11, days / 30)
        return "\(months) month\(months == 1 ? "" : "s")"
    }
    if days >= 1 {
        return "\(days) day\(days == 1 ? "" : "s")"
    }
    if hours > 0 {
        return "\(hours)h \(minutes)m"
    }
    return "\(totalMinutes)m"
}

// MARK: - Active Timer Card

struct ActiveTimerCard: View {
    let timer: WatchActiveTimer
    let connector: PhoneConnector

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
                    Text(isRemote ? context : context.capitalized)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if isPaused {
                    Text("Paused")
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
                                Text("Switch")
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
                                Text("Resume")
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
                                Text("Pause")
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
                        Text("Stop")
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
    let connector: PhoneConnector

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
                    InfoRow(label: "Last", value: formatTimeSince(data.lastTime) + " ago")
                }
                InfoRow(label: "Today", value: "\(data.todayCount) feedings")

                Divider().padding(.vertical, 2)

                NavigationLink {
                    BreastFeedingView(data: data, allTimers: allTimers, connector: connector)
                } label: {
                    OptionRow(emoji: "🤱", label: "Breast", color: WatchActivityType.feeding.primaryColor)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    BottleFeedingView(connector: connector)
                } label: {
                    OptionRow(emoji: "🍼", label: "Bottle", color: WatchActivityType.feeding.primaryColor)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Feeding")
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
    let connector: PhoneConnector

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
                Text("\(suggested.capitalized) suggested")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WatchActivityType.feeding.primaryColor)

                HStack(spacing: 20) {
                    SideButton(
                        letter: "L",
                        label: "Left",
                        color: WatchActivityType.feeding.primaryColor,
                        isHighlighted: suggested == "left"
                    ) {
                        connector.startTimer(activityType: "feeding", context: "left")
                    }

                    SideButton(
                        letter: "R",
                        label: "Right",
                        color: WatchActivityType.feeding.primaryColor,
                        isHighlighted: suggested == "right"
                    ) {
                        connector.startTimer(activityType: "feeding", context: "right")
                    }
                }
            }

            TimelineView(.periodic(from: .now, by: 60)) { _ in
                if let side = data.lastSide {
                    Text("Last: \(side.capitalized) \u{2022} \(formatTimeSince(data.lastTime)) ago")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .navigationTitle("Breast")
    }
}

// MARK: - Bottle Feeding View

struct BottleFeedingView: View {
    let connector: PhoneConnector

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
                + Text(" ml")
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

                Text("Use Digital Crown")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)

                HStack(spacing: 4) {
                    ToggleButton(label: "Formula", isActive: contentType == "formula", color: WatchActivityType.feeding.primaryColor) {
                        contentType = "formula"
                    }
                    ToggleButton(label: "Breast Milk", isActive: contentType == "breastMilk", color: WatchActivityType.feeding.primaryColor) {
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
                    Text("Save")
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
        .navigationTitle("Bottle")
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
    let connector: PhoneConnector

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
                Text("Confirm in SofiBaby")
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
                            Text("Awake \(formatSleepDuration(awake))")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(awake >= window ? .red : .primary)
                            Text("Next nap in \(formatSleepDuration(max(0, window - awake)))")
                                .font(.system(size: 10))
                                .foregroundStyle(awake >= window ? .red : WatchActivityType.sleep.primaryColor)
                        }
                    } else if let awake = awakeMinutes {
                        Text("Awake \(formatSleepDuration(awake))")
                            .font(.system(size: 12, weight: .semibold))
                    }
                }

                SideButton(
                    letter: "😴",
                    label: "Sleep",
                    color: WatchActivityType.sleep.primaryColor,
                    isHighlighted: true,
                    isEmoji: true
                ) {
                    connector.startTimer(activityType: "sleep", context: "auto")
                }
            }

            TimelineView(.periodic(from: .now, by: 60)) { _ in
                if sleepTimer == nil, awakeMinutes == nil, let window = data.wakeWindowMinutes, window > 0 {
                    Text("Wake window: \(formatSleepDuration(window))")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .navigationTitle("Sleep")
    }
}

func formatSleepDuration(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    if h > 0 {
        return "\(h)h \(m)m"
    }
    return "\(m)m"
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
            return "Last: \(formatTimeSinceDate(localTime)) ago"
        }
        if let lastTime = data.lastTime {
            return "Last: \(formatTimeSince(lastTime)) ago"
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
                        Text("Syncing...")
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
                    StatBadge(value: "\(combinedCounts.wet)", label: "Wet", color: WatchActivityType.diaper.primaryColor)
                    StatBadge(value: "\(combinedCounts.dirty)", label: "Dirty", color: WatchActivityType.diaper.primaryColor)
                    StatBadge(value: "\(combinedCounts.mixed)", label: "Mixed", color: WatchActivityType.diaper.primaryColor)
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
        .navigationTitle("Diaper")
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
        .navigationTitle("Color")
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
    let connector: PhoneConnector
    @Environment(\.dismiss) private var dismiss
    @State private var volumeDouble: Double = 0
    var volumeMl: Int { Int(volumeDouble) }

    var body: some View {
        VStack(spacing: 8) {
            Text("\(volumeMl)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .monospacedDigit()
            + Text(" ml")
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

            Text("Use Digital Crown")
                .font(.system(size: 8))
                .foregroundStyle(.secondary)

            Button {
                connector.stopPumpingWithVolume(volumeMl: volumeMl)
                dismiss()
            } label: {
                Text("Save")
                    .font(.system(size: 11, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(WatchActivityType.pumping.primaryColor)
        }
        .focusable()
        .digitalCrownRotation($volumeDouble, from: 0, through: 500, by: 5)
        .navigationTitle("Volume")
    }
}

// MARK: - Pumping Active Card

struct PumpingActiveCard: View {
    let timer: WatchActiveTimer
    let connector: PhoneConnector
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
                    Text(isRemote ? context : context.capitalized)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if isPaused {
                    Text("Paused")
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
                                Text("Switch")
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
                                Text("Resume")
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
                                Text("Pause")
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
                        Text("Stop")
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
    let connector: PhoneConnector
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
                Text("\(suggested.capitalized) suggested")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WatchActivityType.pumping.primaryColor)

                HStack(spacing: 24) {
                    SideButton(
                        letter: "L",
                        label: "Left",
                        color: WatchActivityType.pumping.primaryColor,
                        isHighlighted: suggested == "left"
                    ) {
                        connector.startTimer(activityType: "pumping", context: "left")
                    }

                    SideButton(
                        letter: "R",
                        label: "Right",
                        color: WatchActivityType.pumping.primaryColor,
                        isHighlighted: suggested == "right"
                    ) {
                        connector.startTimer(activityType: "pumping", context: "right")
                    }
                }
            }

            Text("Today: \(data.todayVolumeMl) ml")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
        .padding()
        .navigationTitle("Pumping")
        .navigationDestination(isPresented: $showVolumeEntry) {
            PumpingVolumeEntryView(connector: connector)
        }
    }
}

// MARK: - Tummy Time Detail View

struct TummyTimeDetailView: View {
    let data: WatchActivityData.TummyTimeData
    let allTimers: [WatchActiveTimer]
    let connector: PhoneConnector

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
                        Text("Start")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(WatchActivityType.tummyTime.primaryColor)
                    .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }

            Text("Today: \(data.todayMinutes)m")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
        .padding()
        .navigationTitle("Tummy Time")
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
