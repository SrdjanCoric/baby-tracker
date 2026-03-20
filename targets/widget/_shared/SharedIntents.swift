import SwiftUI
import AppIntents
import ActivityKit
import WidgetKit

// MARK: - App Group Constants

let appGroupId = "group.com.sofibaby.app"

// MARK: - Timer Activity Type (excludes diaper which has no timer)

enum TimerActivityType: String, CaseIterable, AppEnum {
    case feeding, sleep, pumping, tummyTime

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Timer Activity"
    static var caseDisplayRepresentations: [TimerActivityType: DisplayRepresentation] = [
        .feeding: DisplayRepresentation(title: "Feeding", image: .init(systemName: "drop.fill")),
        .sleep: DisplayRepresentation(title: "Sleep", image: .init(systemName: "moon.fill")),
        .pumping: DisplayRepresentation(title: "Pumping", image: .init(systemName: "flask.fill")),
        .tummyTime: DisplayRepresentation(title: "Tummy Time", image: .init(systemName: "figure.play"))
    ]

    var asActivityType: ActivityType {
        switch self {
        case .feeding: return .feeding
        case .sleep: return .sleep
        case .pumping: return .pumping
        case .tummyTime: return .tummyTime
        }
    }
}

// MARK: - Activity Type Definition

enum ActivityType: String, CaseIterable, AppEnum {
    case feeding, sleep, diaper, pumping, tummyTime

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Activity Type"
    static var caseDisplayRepresentations: [ActivityType: DisplayRepresentation] = [
        .feeding: DisplayRepresentation(title: "Feeding", image: .init(systemName: "drop.fill")),
        .sleep: DisplayRepresentation(title: "Sleep", image: .init(systemName: "moon.fill")),
        .diaper: DisplayRepresentation(title: "Diaper", image: .init(systemName: "leaf.fill")),
        .pumping: DisplayRepresentation(title: "Pumping", image: .init(systemName: "flask.fill")),
        .tummyTime: DisplayRepresentation(title: "Tummy Time", image: .init(systemName: "figure.play"))
    ]

    var icon: String {
        switch self {
        case .feeding: return "drop.fill"
        case .sleep: return "moon.fill"
        case .diaper: return "leaf.fill"
        case .pumping: return "flask.fill"
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

    var label: String {
        switch self {
        case .feeding: return "Feeding"
        case .sleep: return "Sleep"
        case .diaper: return "Diaper"
        case .pumping: return "Pumping"
        case .tummyTime: return "Tummy Time"
        }
    }

    var primaryColor: Color {
        switch self {
        case .feeding: return Color("feedingPrimary")
        case .sleep: return Color("sleepPrimary")
        case .diaper: return Color("diaperPrimary")
        case .pumping: return Color("pumpingPrimary")
        case .tummyTime: return Color("tummyTimePrimary")
        }
    }

    var backgroundColor: Color {
        switch self {
        case .feeding: return Color("feedingBackground")
        case .sleep: return Color("sleepBackground")
        case .diaper: return Color("diaperBackground")
        case .pumping: return Color("pumpingBackground")
        case .tummyTime: return Color("tummyTimeBackground")
        }
    }

    var accentColor: Color {
        switch self {
        case .feeding: return Color(hex: WidgetColors.Accent.feeding)
        case .sleep: return Color(hex: WidgetColors.Accent.sleep)
        case .diaper: return Color(hex: WidgetColors.Accent.diaper)
        case .pumping: return Color(hex: WidgetColors.Accent.pumping)
        case .tummyTime: return Color(hex: WidgetColors.Accent.tummyTime)
        }
    }

    var mutedColor: Color {
        switch self {
        case .feeding: return Color(hex: WidgetColors.MutedLight.feeding)
        case .sleep: return Color(hex: WidgetColors.MutedLight.sleep)
        case .diaper: return Color(hex: WidgetColors.MutedLight.diaper)
        case .pumping: return Color(hex: WidgetColors.MutedLight.pumping)
        case .tummyTime: return Color(hex: WidgetColors.MutedLight.tummyTime)
        }
    }

    var mutedColorDark: Color {
        switch self {
        case .feeding: return Color(hex: WidgetColors.MutedDark.feeding)
        case .sleep: return Color(hex: WidgetColors.MutedDark.sleep)
        case .diaper: return Color(hex: WidgetColors.MutedDark.diaper)
        case .pumping: return Color(hex: WidgetColors.MutedDark.pumping)
        case .tummyTime: return Color(hex: WidgetColors.MutedDark.tummyTime)
        }
    }

    func mutedColor(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? mutedColorDark : mutedColor
    }

    var deepLinkURL: URL {
        URL(string: "sofibaby://\(self.rawValue)")!
    }

    var startTimerURL: URL {
        URL(string: "sofibaby://\(self.rawValue)?action=start")!
    }

    var pauseTimerURL: URL {
        URL(string: "sofibaby://\(self.rawValue)?action=pause")!
    }

    var resumeTimerURL: URL {
        URL(string: "sofibaby://\(self.rawValue)?action=resume")!
    }

    var stopTimerURL: URL {
        URL(string: "sofibaby://\(self.rawValue)?action=stop")!
    }
}

// MARK: - Diaper Enums

enum DiaperTypeEnum: String, CaseIterable, AppEnum {
    case wet, dirty, mixed, dry

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Diaper Type"
    static var caseDisplayRepresentations: [DiaperTypeEnum: DisplayRepresentation] = [
        .wet: "Wet",
        .dirty: "Dirty",
        .mixed: "Mixed",
        .dry: "Dry"
    ]
}

enum StoolColorEnum: String, CaseIterable, AppEnum {
    case yellow, brown, green, orange, black, white, red

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Stool Color"
    static var caseDisplayRepresentations: [StoolColorEnum: DisplayRepresentation] = [
        .yellow: "Yellow",
        .brown: "Brown",
        .green: "Green",
        .orange: "Orange",
        .black: "Black",
        .white: "White",
        .red: "Red"
    ]
}

// MARK: - Breast Side Enum

enum BreastSideEnum: String, CaseIterable, AppEnum {
    case left, right, both

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Breast Side"
    static var caseDisplayRepresentations: [BreastSideEnum: DisplayRepresentation] = [
        .left: "Left",
        .right: "Right",
        .both: "Both"
    ]
}

// MARK: - Volume Unit Enum

enum VolumeUnitEnum: String, CaseIterable, AppEnum {
    case oz, ml

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Volume Unit"
    static var caseDisplayRepresentations: [VolumeUnitEnum: DisplayRepresentation] = [
        .oz: "Ounces",
        .ml: "Milliliters"
    ]
}

// MARK: - Bottle Feeding Type Enum

enum BottleFeedingTypeEnum: String, CaseIterable, AppEnum {
    case formula, breastMilk

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Bottle Type"
    static var caseDisplayRepresentations: [BottleFeedingTypeEnum: DisplayRepresentation] = [
        .formula: "Formula",
        .breastMilk: "Breast Milk"
    ]
}

// MARK: - Data Models

struct WidgetActivityData: Codable {
    var feeding: FeedingData
    var sleep: SleepData
    var diaper: DiaperData
    var pumping: PumpingData
    var growth: GrowthData
    var tummyTime: TummyTimeData

    struct FeedingData: Codable {
        var lastTime: String?
        var todayCount: Int
        var lastType: String?
        var lastSide: String?
    }

    struct SleepData: Codable {
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
    }

    struct DiaperData: Codable {
        var lastTime: String?
        var todayCounts: DiaperCounts
        var lastType: String?

        struct DiaperCounts: Codable {
            var wet: Int
            var dirty: Int
            var mixed: Int
            var dry: Int
        }
    }

    struct PumpingData: Codable {
        var lastTime: String?
        var todayVolumeMl: Double
        var sessionCount: Int
        var lastSide: String?
    }

    struct GrowthData: Codable {
        var lastMeasurement: Measurement?

        struct Measurement: Codable {
            var date: String
            var weightKg: Double?
            var heightCm: Double?
            var headCircumferenceCm: Double?
        }
    }

    struct TummyTimeData: Codable {
        var lastTime: String?
        var todayMinutes: Int
        var goalMinutes: Int
        var lastDurationMinutes: Int?
    }
}

struct ActiveTimerData: Codable {
    var type: String
    var startTime: String
    var context: String?
    var isRemote: Bool?
    var isPaused: Bool?
    var accumulatedSeconds: Int?
}

struct WidgetDataModel: Codable {
    var babyId: String
    var babyName: String
    var activities: WidgetActivityData
    var activeTimer: ActiveTimerData?
    var activeTimers: [ActiveTimerData]?
    var updatedAt: String

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
        return getActiveTimer(for: type) != nil
    }

    func isRemoteTimer(for type: ActivityType) -> Bool {
        return getActiveTimer(for: type)?.isRemote == true
    }

    func isTimerPaused(for type: ActivityType) -> Bool {
        return getActiveTimer(for: type)?.isPaused == true
    }
}

// MARK: - Interactive App Intents

struct StartActivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Activity"
    static var description = IntentDescription("Start tracking an activity")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Activity")
    var activity: ActivityType

    @Parameter(title: "Side")
    var side: BreastSideEnum?

    init() {
        self.activity = .feeding
        self.side = nil
    }

    init(activity: ActivityType, side: BreastSideEnum? = nil) {
        self.activity = activity
        self.side = side
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            NSLog("[StartActivity] ERROR: UserDefaults nil for app group \(appGroupId)")
            return .result(value: "Failed to start \(activity.label). Please open the app.")
        }

        if !isUserAuthenticated() {
            NSLog("[StartActivity] User not authenticated")
            return .result(value: "Please sign in to Sofi Baby first.")
        }

        let babyName = userDefaults.string(forKey: "selectedBabyName") ?? "baby"

        if let data = loadWidgetData(), data.hasActiveTimer(for: activity) {
            NSLog("[StartActivity] Timer already running for \(activity.rawValue)")
            return .result(value: "\(activity.label) timer is already running for \(babyName). Stop it first or open the app.")
        }

        let dbType = activity == .tummyTime ? "tummy_time" : activity.rawValue

        var resolvedSide: String? = side?.rawValue
        if resolvedSide == nil && (activity == .feeding || activity == .pumping),
           let data = loadWidgetData() {
            let lastSide = activity == .feeding
                ? data.activities.feeding.lastSide
                : data.activities.pumping.lastSide
            if lastSide == "left" {
                resolvedSide = "right"
            } else if lastSide == "right" {
                resolvedSide = "left"
            }
        }

        var pending: [String: String] = [
            "activityType": dbType,
            "requestedAt": ISO8601DateFormatter().string(from: Date())
        ]
        if let resolvedSide = resolvedSide {
            pending["side"] = resolvedSide
        }
        if let json = try? JSONSerialization.data(withJSONObject: pending),
           let jsonString = String(data: json, encoding: .utf8) {
            userDefaults.set(jsonString, forKey: "pendingWidgetStart")
        }
        userDefaults.synchronize()

        var timeSinceText = ""
        if let data = loadWidgetData() {
            if let lastTime = getLastActivityTime(for: activity, data: data) {
                let interval = Date().timeIntervalSince(lastTime)
                let hours = Int(interval) / 3600
                let minutes = (Int(interval) % 3600) / 60
                if hours > 0 {
                    timeSinceText = ". It's been \(hours)h \(minutes)m since the last \(activity.label.lowercased())."
                } else if minutes > 0 {
                    timeSinceText = ". It's been \(minutes)m since the last \(activity.label.lowercased())."
                }
            }
        }

        let sideText = resolvedSide != nil ? " on \(resolvedSide!) side" : ""
        return .result(value: "Opening \(activity.label)\(sideText) for \(babyName)\(timeSinceText)")
    }
}


func captureRunningActivityPushToken() {
    guard #available(iOS 16.2, *) else { return }
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else { return }

    for activity in Activity<TimerActivityAttributes>.activities {
        if let tokenData = activity.pushToken {
            let token = tokenData.map { String(format: "%02x", $0) }.joined()
            if !token.isEmpty {
                userDefaults.set(token, forKey: "liveActivityPushToken")
                NSLog("[WidgetPushToken] Captured liveActivityPushToken from running activity: \(token.prefix(12))...")
                return
            }
        }
    }
    NSLog("[WidgetPushToken] No running activities with push token found (count=\(Activity<TimerActivityAttributes>.activities.count))")
}

struct StopActivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Stop Activity"
    static var description = IntentDescription("Stop the current timer")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity")
    var activity: TimerActivityType

    @Parameter(title: "Amount")
    var amount: Double?

    @Parameter(title: "Unit")
    var unit: VolumeUnitEnum?

    init() {
        self.activity = .feeding
        self.amount = nil
        self.unit = nil
    }

    init(activity: TimerActivityType) {
        self.activity = activity
        self.amount = nil
        self.unit = nil
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let activity = self.activity.asActivityType
        NSLog("[StopActivity] perform() called for activity: \(activity.rawValue)")

        captureRunningActivityPushToken()

        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            NSLog("[StopActivity] ERROR: UserDefaults nil")
            return .result(value: "Failed to stop \(activity.label)")
        }

        let babyName = userDefaults.string(forKey: "selectedBabyName") ?? "baby"

        var hasActiveTimer = false
        if let data = loadWidgetData() {
            hasActiveTimer = data.hasActiveTimer(for: activity)
        }
        if !hasActiveTimer {
            if let networkTimers = await fetchActiveTimersFromNetwork() {
                let dbType = activity == .tummyTime ? "tummy_time" : activity.rawValue
                let widgetType = activity.rawValue
                hasActiveTimer = networkTimers.contains { $0.type == widgetType || $0.type == dbType }
            }
        }
        if !hasActiveTimer {
            NSLog("[StopActivity] No active timer found for \(activity.rawValue)")
            return .result(value: "No active \(activity.label) timer for \(babyName)")
        }

        let dbType = activity == .tummyTime ? "tummy_time" : activity.rawValue

        let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
        let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
        let accessToken = userDefaults.string(forKey: "supabaseAccessToken")
        let babyId = userDefaults.string(forKey: "selectedBabyId")
        let userId = userDefaults.string(forKey: "userId")
        let laPushToken = userDefaults.string(forKey: "liveActivityPushToken")
        NSLog("[StopActivity] liveActivityPushToken=\(laPushToken != nil ? "present" : "nil")")

        if let supabaseUrl, let anonKey, let accessToken, let babyId, let userId {
            let urlString = "\(supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&activity_type=eq.\(dbType)&started_by=eq.\(userId)"
            if let url = URL(string: urlString) {
                var request = URLRequest(url: url)
                request.httpMethod = "DELETE"
                request.setValue(anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
                request.timeoutInterval = 10
                do {
                    let (_, response) = try await URLSession.shared.data(for: request)
                    let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                    NSLog("[StopActivity] DELETE response status: \(statusCode)")
                    if statusCode >= 400 {
                        NSLog("[StopActivity] WARNING: Supabase DELETE failed with status \(statusCode)")
                    }
                } catch {
                    NSLog("[StopActivity] ERROR: Supabase DELETE failed: \(error.localizedDescription)")
                }
            }
        } else {
            NSLog("[StopActivity] WARNING: Missing auth credentials, skipping Supabase DELETE")
        }

        var volumeMl: Double? = nil
        if let amount = amount, activity == .pumping {
            switch unit ?? .oz {
            case .oz: volumeMl = amount * 29.5735
            case .ml: volumeMl = amount
            }
        }

        var stop: [String: Any] = [
            "activityType": dbType,
            "stoppedAt": ISO8601DateFormatter().string(from: Date())
        ]
        if let volumeMl = volumeMl {
            stop["volumeMl"] = volumeMl
        }
        if let json = try? JSONSerialization.data(withJSONObject: stop),
           let jsonString = String(data: json, encoding: .utf8) {
            userDefaults.set(jsonString, forKey: "pendingWidgetStop")
        }

        userDefaults.removeObject(forKey: "pendingWidgetPauseToggle")

        if let pushToken = userDefaults.string(forKey: "liveActivityPushToken"),
           !pushToken.isEmpty,
           let supabaseUrl = supabaseUrl {
            let edgeUrl = "\(supabaseUrl)/functions/v1/end-live-activity"
            if let url = URL(string: edgeUrl) {
                var laRequest = URLRequest(url: url)
                laRequest.httpMethod = "POST"
                laRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                laRequest.setValue(anonKey ?? "", forHTTPHeaderField: "apikey")
                laRequest.setValue("Bearer \(accessToken ?? anonKey ?? "")", forHTTPHeaderField: "Authorization")
                laRequest.timeoutInterval = 10
                var laBody: [String: Any] = ["pushToken": pushToken]
                #if DEBUG
                laBody["isSandbox"] = true
                #endif
                laRequest.httpBody = try? JSONSerialization.data(withJSONObject: laBody)
                _ = try? await URLSession.shared.data(for: laRequest)
            }
            userDefaults.removeObject(forKey: "liveActivityPushToken")
        }

        var durationText = ""
        var stoppedTimerContext: String? = nil

        if let dataString = userDefaults.string(forKey: "widgetData"),
           let data = dataString.data(using: .utf8),
           var widgetData = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let widgetType = activity.rawValue
            var stoppedTimerStart: String? = nil
            if var timers = widgetData["activeTimers"] as? [[String: Any]] {
                if let stoppedTimer = timers.first(where: { ($0["type"] as? String) == widgetType }) {
                    stoppedTimerStart = stoppedTimer["startTime"] as? String
                    stoppedTimerContext = stoppedTimer["context"] as? String
                }
                timers.removeAll { ($0["type"] as? String) == widgetType }
                widgetData["activeTimers"] = timers
                widgetData["activeTimer"] = timers.first
            } else {
                if let single = widgetData["activeTimer"] as? [String: Any],
                   (single["type"] as? String) == widgetType {
                    stoppedTimerStart = single["startTime"] as? String
                    stoppedTimerContext = single["context"] as? String
                }
                widgetData["activeTimer"] = nil
            }

            let now = ISO8601DateFormatter().string(from: Date())
            if var activities = widgetData["activities"] as? [String: Any] {
                switch activity {
                case .feeding:
                    if var feeding = activities["feeding"] as? [String: Any] {
                        feeding["lastTime"] = now
                        let count = (feeding["todayCount"] as? Int) ?? 0
                        feeding["todayCount"] = count + 1
                        if let side = stoppedTimerContext {
                            feeding["lastSide"] = side
                            feeding["lastType"] = "breast"
                        }
                        activities["feeding"] = feeding
                    }
                case .sleep:
                    if var sleep = activities["sleep"] as? [String: Any] {
                        sleep["lastTime"] = now
                        sleep["isActive"] = false
                        if let sleepType = stoppedTimerContext {
                            sleep["sleepType"] = sleepType
                        }
                        if let startStr = stoppedTimerStart {
                            let durationMin = durationMinutes(from: startStr, to: Date())
                            if let durationMin {
                                sleep["lastDurationMinutes"] = durationMin
                                let todayMin = (sleep["todayMinutes"] as? Int) ?? 0
                                sleep["todayMinutes"] = todayMin + durationMin
                                durationText = formatDurationText(minutes: durationMin)
                            }
                        }
                        activities["sleep"] = sleep
                    }
                case .pumping:
                    if var pumping = activities["pumping"] as? [String: Any] {
                        pumping["lastTime"] = now
                        let sessions = (pumping["sessionCount"] as? Int) ?? 0
                        pumping["sessionCount"] = sessions + 1
                        if let side = stoppedTimerContext {
                            pumping["lastSide"] = side
                        }
                        if let volumeMl = volumeMl {
                            let currentVolume = (pumping["todayVolumeMl"] as? Double) ?? 0
                            pumping["todayVolumeMl"] = currentVolume + volumeMl
                        }
                        activities["pumping"] = pumping
                    }
                case .tummyTime:
                    if var tummyTime = activities["tummyTime"] as? [String: Any] {
                        tummyTime["lastTime"] = now
                        if let startStr = stoppedTimerStart {
                            let durationMin = durationMinutes(from: startStr, to: Date())
                            if let durationMin {
                                tummyTime["lastDurationMinutes"] = durationMin
                                let todayMin = (tummyTime["todayMinutes"] as? Int) ?? 0
                                tummyTime["todayMinutes"] = todayMin + durationMin
                                durationText = formatDurationText(minutes: durationMin)
                            }
                        }
                        activities["tummyTime"] = tummyTime
                    }
                case .diaper:
                    break
                }
                widgetData["activities"] = activities
            }

            widgetData["updatedAt"] = now
            if let updatedData = try? JSONSerialization.data(withJSONObject: widgetData),
               let updatedString = String(data: updatedData, encoding: .utf8) {
                userDefaults.set(updatedString, forKey: "widgetData")
            }
        }

        userDefaults.synchronize()

        reloadAllWidgetTimelines()

        var contextText = ""
        if let stoppedTimerContext = stoppedTimerContext {
            contextText = " (\(stoppedTimerContext))"
        }

        let resultMessage: String
        if durationText.isEmpty {
            resultMessage = "Stopped \(activity.label)\(contextText) for \(babyName)"
        } else {
            resultMessage = "Stopped \(activity.label)\(contextText) for \(babyName). Duration: \(durationText)"
        }
        return .result(value: resultMessage)
    }
}

// MARK: - Toggle Pause Intent

struct TogglePauseActivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Pause/Resume Activity"
    static var description = IntentDescription("Toggle pause on the current timer")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity")
    var activity: TimerActivityType

    init() {
        self.activity = .feeding
    }

    init(activity: TimerActivityType) {
        self.activity = activity
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let activity = self.activity.asActivityType
        NSLog("[TogglePause] perform() called for activity: \(activity.rawValue)")

        captureRunningActivityPushToken()

        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            NSLog("[TogglePause] ERROR: UserDefaults nil")
            return .result(value: "Failed")
        }

        let dbType = activity == .tummyTime ? "tummy_time" : activity.rawValue
        let widgetType = activity.rawValue

        let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
        let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
        let accessToken = userDefaults.string(forKey: "supabaseAccessToken")
        let babyId = userDefaults.string(forKey: "selectedBabyId")
        let userId = userDefaults.string(forKey: "userId")

        NSLog("[TogglePause] supabaseUrl=\(supabaseUrl != nil) anonKey=\(anonKey != nil) accessToken=\(accessToken != nil) babyId=\(babyId != nil) userId=\(userId != nil)")

        if accessToken == nil {
            NSLog("[TogglePause] WARNING: No access token found. Please open the app to authenticate.")
        }

        var widgetData: [String: Any] = [:]
        if let dataString = userDefaults.string(forKey: "widgetData"),
           let data = dataString.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            widgetData = parsed
        }

        var timers = widgetData["activeTimers"] as? [[String: Any]] ?? []
        var timerIndex = timers.firstIndex(where: { ($0["type"] as? String) == widgetType })

        if timerIndex == nil {
            NSLog("[TogglePause] Timer not in local widgetData, fetching from network...")
            if let networkTimers = await fetchActiveTimersFromNetwork() {
                let matchingTimer = networkTimers.first(where: { $0.type == widgetType })
                if let matchingTimer {
                    let timerDict: [String: Any] = [
                        "type": matchingTimer.type,
                        "startTime": matchingTimer.startTime,
                        "context": matchingTimer.context as Any,
                        "isRemote": matchingTimer.isRemote as Any,
                        "isPaused": matchingTimer.isPaused as Any,
                        "accumulatedSeconds": matchingTimer.accumulatedSeconds as Any,
                    ]
                    timers.append(timerDict)
                    timerIndex = timers.count - 1
                    NSLog("[TogglePause] Found timer from network: isPaused=\(matchingTimer.isPaused ?? false)")
                }
            }
        }

        guard let timerIndex else {
            NSLog("[TogglePause] ERROR: no timer found for type \(widgetType) (local or network)")
            return .result(value: "No active \(activity.label) timer found")
        }

        var timer = timers[timerIndex]
        let currentlyPaused = (timer["isPaused"] as? Bool) ?? false
        let timerContext = timer["context"] as? String
        let now = Date()
        let isoNow = ISO8601DateFormatter().string(from: now)
        let liveActivityPushToken = userDefaults.string(forKey: "liveActivityPushToken")

        let widgetBabyId = widgetData["babyId"] as? String
        NSLog("[TogglePause] currentlyPaused=\(currentlyPaused) context=\(timerContext ?? "nil") laPushToken=\(liveActivityPushToken != nil) widgetBabyId=\(widgetBabyId ?? "nil")")

        let effectiveBabyId = babyId ?? widgetBabyId
        let effectiveUserId = userId ?? ""

        if currentlyPaused {
            let pausedAtStr = timer["pausedAt"] as? String
            var pauseDurationMs = 0
            if let pausedAtStr {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                var pausedAt = formatter.date(from: pausedAtStr)
                if pausedAt == nil {
                    formatter.formatOptions = [.withInternetDateTime]
                    pausedAt = formatter.date(from: pausedAtStr)
                }
                if let pausedAt {
                    pauseDurationMs = Int(now.timeIntervalSince(pausedAt) * 1000)
                }
            }

            let accumulatedSeconds = (timer["accumulatedSeconds"] as? Int) ?? 0
            let newStartTime = Date(timeIntervalSince1970: now.timeIntervalSince1970 - Double(accumulatedSeconds))
            let effectiveStartISO = ISO8601DateFormatter().string(from: newStartTime)
            timer["startTime"] = effectiveStartISO
            timer["isPaused"] = false
            timer.removeValue(forKey: "pausedAt")
            timer.removeValue(forKey: "accumulatedSeconds")

            timers[timerIndex] = timer
            widgetData["activeTimers"] = timers
            widgetData["activeTimer"] = timers.first
            widgetData["updatedAt"] = isoNow

            if let updatedData = try? JSONSerialization.data(withJSONObject: widgetData),
               let updatedString = String(data: updatedData, encoding: .utf8) {
                userDefaults.set(updatedString, forKey: "widgetData")
            }

            let pendingAction: [String: Any] = [
                "activityType": dbType,
                "action": "resume",
                "resumedAt": isoNow,
                "pauseDurationMs": pauseDurationMs
            ]
            if let json = try? JSONSerialization.data(withJSONObject: pendingAction),
               let jsonString = String(data: json, encoding: .utf8) {
                userDefaults.set(jsonString, forKey: "pendingWidgetPauseToggle")
            }

            if let supabaseUrl, let effectiveBabyId {
                NSLog("[TogglePause] calling edge function: action=resume babyId=\(effectiveBabyId.prefix(8))")
                var edgeBody: [String: Any] = [
                    "babyId": effectiveBabyId,
                    "activityType": dbType,
                    "userId": effectiveUserId,
                    "action": "resume",
                    "timerData": [
                        "isPaused": false,
                        "effectiveStartTime": effectiveStartISO,
                        "accumulatedSeconds": accumulatedSeconds
                    ] as [String: Any],
                    "elapsedSeconds": accumulatedSeconds,
                    "effectiveStartTimeISO": effectiveStartISO
                ]
                if let timerContext { edgeBody["context"] = timerContext }
                if let liveActivityPushToken, !liveActivityPushToken.isEmpty {
                    edgeBody["liveActivityPushToken"] = liveActivityPushToken
                }
                #if DEBUG
                edgeBody["isSandbox"] = true
                #endif
                await callTogglePauseEdgeFunction(supabaseUrl: supabaseUrl, anonKey: anonKey ?? "", accessToken: accessToken, body: edgeBody)
                NSLog("[TogglePause] edge function returned")
            } else {
                NSLog("[TogglePause] SKIPPED edge function: supabaseUrl=\(supabaseUrl != nil) babyId=\(effectiveBabyId != nil)")
            }
        } else {
            let startTimeStr = timer["startTime"] as? String
            var accumulatedSeconds = 0
            if let startTimeStr {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                var startDate = formatter.date(from: startTimeStr)
                if startDate == nil {
                    formatter.formatOptions = [.withInternetDateTime]
                    startDate = formatter.date(from: startTimeStr)
                }
                if let startDate {
                    accumulatedSeconds = max(0, Int(now.timeIntervalSince(startDate)))
                }
            }

            timer["isPaused"] = true
            timer["pausedAt"] = isoNow
            timer["accumulatedSeconds"] = accumulatedSeconds

            timers[timerIndex] = timer
            widgetData["activeTimers"] = timers
            widgetData["activeTimer"] = timers.first
            widgetData["updatedAt"] = isoNow

            if let updatedData = try? JSONSerialization.data(withJSONObject: widgetData),
               let updatedString = String(data: updatedData, encoding: .utf8) {
                userDefaults.set(updatedString, forKey: "widgetData")
            }

            let pendingAction: [String: Any] = [
                "activityType": dbType,
                "action": "pause",
                "pausedAt": isoNow,
                "accumulatedSeconds": accumulatedSeconds
            ]
            if let json = try? JSONSerialization.data(withJSONObject: pendingAction),
               let jsonString = String(data: json, encoding: .utf8) {
                userDefaults.set(jsonString, forKey: "pendingWidgetPauseToggle")
            }

            if let supabaseUrl, let effectiveBabyId {
                NSLog("[TogglePause] calling edge function: action=pause accumulated=\(accumulatedSeconds) babyId=\(effectiveBabyId.prefix(8))")
                var edgeBody: [String: Any] = [
                    "babyId": effectiveBabyId,
                    "activityType": dbType,
                    "userId": effectiveUserId,
                    "action": "pause",
                    "timerData": ["isPaused": true, "pausedAt": isoNow, "accumulatedSeconds": accumulatedSeconds],
                    "elapsedSeconds": accumulatedSeconds
                ]
                if let timerContext { edgeBody["context"] = timerContext }
                if let liveActivityPushToken, !liveActivityPushToken.isEmpty {
                    edgeBody["liveActivityPushToken"] = liveActivityPushToken
                }
                #if DEBUG
                edgeBody["isSandbox"] = true
                #endif
                await callTogglePauseEdgeFunction(supabaseUrl: supabaseUrl, anonKey: anonKey ?? "", accessToken: accessToken, body: edgeBody)
                NSLog("[TogglePause] edge function returned")
            } else {
                NSLog("[TogglePause] SKIPPED edge function: supabaseUrl=\(supabaseUrl != nil) babyId=\(effectiveBabyId != nil)")
            }
        }

        userDefaults.synchronize()
        reloadAllWidgetTimelines()
        NSLog("[TogglePause] done, reloaded timelines")

        let resultMessage = currentlyPaused ? "Resumed \(activity.label)" : "Paused \(activity.label)"
        return .result(value: resultMessage)
    }

    private func callTogglePauseEdgeFunction(supabaseUrl: String, anonKey: String, accessToken: String?, body: [String: Any]) async {
        let edgeUrl = "\(supabaseUrl)/functions/v1/toggle-timer-pause"
        guard let url = URL(string: edgeUrl) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken ?? anonKey)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                let bodyStr = String(data: data, encoding: .utf8) ?? ""
                NSLog("[TogglePause] edge response: status=\(httpResponse.statusCode) body=\(bodyStr.prefix(200))")
            }
        } catch {
            NSLog("[TogglePause] edge request error: \(error.localizedDescription)")
        }
    }
}

// MARK: - Log Diaper Intent

struct LogDiaperIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Diaper"
    static var description = IntentDescription("Log a diaper change")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Type")
    var diaperType: DiaperTypeEnum

    @Parameter(title: "Stool Color")
    var stoolColor: StoolColorEnum?

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            return .result(value: "Failed to log diaper")
        }

        let babyName = userDefaults.string(forKey: "selectedBabyName") ?? "baby"
        let now = ISO8601DateFormatter().string(from: Date())

        if let dataString = userDefaults.string(forKey: "widgetData"),
           let data = dataString.data(using: .utf8),
           var widgetData = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if var activities = widgetData["activities"] as? [String: Any],
               var diaper = activities["diaper"] as? [String: Any] {
                diaper["lastTime"] = now
                diaper["lastType"] = diaperType.rawValue
                if var counts = diaper["todayCounts"] as? [String: Int] {
                    let key = diaperType.rawValue
                    counts[key] = (counts[key] ?? 0) + 1
                    diaper["todayCounts"] = counts
                }
                activities["diaper"] = diaper
                widgetData["activities"] = activities
                widgetData["updatedAt"] = now
                if let updatedData = try? JSONSerialization.data(withJSONObject: widgetData),
                   let updatedString = String(data: updatedData, encoding: .utf8) {
                    userDefaults.set(updatedString, forKey: "widgetData")
                }
            }
        }

        userDefaults.synchronize()
        reloadAllWidgetTimelines()

        var networkSuccess = false
        let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
        let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
        let accessToken = userDefaults.string(forKey: "supabaseAccessToken")
        let babyId = userDefaults.string(forKey: "selectedBabyId")
        let userId = userDefaults.string(forKey: "userId")

        if let supabaseUrl, let anonKey, let accessToken, let babyId, let userId {
            let urlString = "\(supabaseUrl)/rest/v1/diapers"
            if let url = URL(string: urlString) {
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue(anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
                request.timeoutInterval = 10

                var body: [String: Any] = [
                    "id": UUID().uuidString,
                    "baby_id": babyId,
                    "logged_by": userId,
                    "type": diaperType.rawValue,
                    "changed_at": now
                ]
                if let color = stoolColor {
                    body["stool_color"] = color.rawValue
                }
                request.httpBody = try? JSONSerialization.data(withJSONObject: body)

                do {
                    let (_, response) = try await URLSession.shared.data(for: request)
                    let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                    if statusCode < 400 {
                        networkSuccess = true
                        NSLog("[LogDiaper] Supabase insert success (status \(statusCode))")
                    } else {
                        NSLog("[LogDiaper] Supabase insert failed (status \(statusCode)), writing pending for app fallback")
                    }
                } catch {
                    NSLog("[LogDiaper] Network error: \(error.localizedDescription), writing pending for app fallback")
                }
            }
        }

        if !networkSuccess {
            var pending: [String: String] = [
                "type": diaperType.rawValue,
                "requestedAt": now
            ]
            if let color = stoolColor {
                pending["stoolColor"] = color.rawValue
            }
            if let json = try? JSONSerialization.data(withJSONObject: pending),
               let jsonString = String(data: json, encoding: .utf8) {
                userDefaults.set(jsonString, forKey: "pendingDiaperLog")
                userDefaults.synchronize()
            }
        }

        let colorText = stoolColor != nil ? " (\(stoolColor!.rawValue))" : ""
        return .result(value: "Logged \(diaperType.rawValue) diaper\(colorText) for \(babyName)")
    }
}

// MARK: - Query Last Activity Intent

struct QueryLastActivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Last Activity"
    static var description = IntentDescription("Check when the last activity was")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity")
    var activity: ActivityType

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let data = loadWidgetData() else {
            return .result(value: "No data available. Please open the app first.")
        }

        let babyName = data.babyName

        guard let lastTime = getLastActivityTime(for: activity, data: data) else {
            return .result(value: "No \(activity.label) recorded yet for \(babyName)")
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        let relativeTime = formatter.localizedString(for: lastTime, relativeTo: Date())

        var extraInfo = ""
        switch activity {
        case .feeding:
            extraInfo = ". Today's count: \(data.activities.feeding.todayCount)"
        case .sleep:
            let mins = data.activities.sleep.todayMinutes
            let hours = mins / 60
            let remainder = mins % 60
            extraInfo = ". Total sleep today: \(hours)h \(remainder)m"
            if let wakeWindowMinutes = data.activities.sleep.wakeWindowMinutes,
               let lastSleepEndedAtStr = data.activities.sleep.lastSleepEndedAt {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                var endedAt = formatter.date(from: lastSleepEndedAtStr)
                if endedAt == nil {
                    formatter.formatOptions = [.withInternetDateTime]
                    endedAt = formatter.date(from: lastSleepEndedAtStr)
                }
                if let endedAt = endedAt {
                    let awakeMinutes = Int(Date().timeIntervalSince(endedAt)) / 60
                    let remaining = wakeWindowMinutes - awakeMinutes
                    if remaining > 0 {
                        extraInfo += ". Wake window: \(wakeWindowMinutes)m (\(remaining)m remaining)"
                    } else {
                        extraInfo += ". Wake window: \(wakeWindowMinutes)m (exceeded by \(-remaining)m)"
                    }
                }
            }
        case .diaper:
            let counts = data.activities.diaper.todayCounts
            let total = counts.wet + counts.dirty + counts.mixed + counts.dry
            extraInfo = ". Today: \(total) diapers (\(counts.wet) wet, \(counts.dirty) dirty)"
        case .pumping:
            extraInfo = ". Sessions today: \(data.activities.pumping.sessionCount)"
        case .tummyTime:
            extraInfo = ". Today: \(data.activities.tummyTime.todayMinutes) minutes"
        }

        return .result(value: "Last \(activity.label) for \(babyName) was \(relativeTime)\(extraInfo)")
    }
}

// MARK: - Query Active Timer Intent

struct QueryActiveTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Timer"
    static var description = IntentDescription("Check how long a timer has been running")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity")
    var activity: TimerActivityType

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let activityType = activity.asActivityType
        let data = loadWidgetData()
        let babyName = data?.babyName ?? (UserDefaults(suiteName: appGroupId)?.string(forKey: "selectedBabyName") ?? "baby")

        var timer = data?.getActiveTimer(for: activityType)

        if timer == nil {
            NSLog("[QueryTimer] Timer not in local widgetData for \(activityType.rawValue), fetching from network...")
            if let networkTimers = await fetchActiveTimersFromNetwork() {
                timer = networkTimers.first(where: { $0.type == activityType.rawValue })
            }
        }

        guard let timer else {
            return .result(value: "No active \(activityType.label) timer for \(babyName)")
        }

        if timer.isPaused == true {
            let accumulated = timer.accumulatedSeconds ?? 0
            let text = formatDurationText(minutes: accumulated / 60)
            return .result(value: "\(activityType.label) is paused at \(text) for \(babyName)")
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var startDate = formatter.date(from: timer.startTime)
        if startDate == nil {
            formatter.formatOptions = [.withInternetDateTime]
            startDate = formatter.date(from: timer.startTime)
        }
        guard let start = startDate else {
            return .result(value: "\(activityType.label) timer is running for \(babyName)")
        }

        let elapsed = Int(Date().timeIntervalSince(start))
        let text = formatDurationText(minutes: elapsed / 60)
        var contextText = ""
        if let context = timer.context {
            contextText = " (\(context))"
        }
        return .result(value: "\(activityType.label)\(contextText) has been going for \(text) for \(babyName)")
    }
}

// MARK: - Query Daily Summary Intent

struct QueryDailySummaryIntent: AppIntent {
    static var title: LocalizedStringResource = "Daily Summary"
    static var description = IntentDescription("Get a summary of today's activities")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let data = loadWidgetData() else {
            return .result(value: "No data available. Please open the app first.")
        }

        let babyName = data.babyName
        var parts: [String] = []

        let feeding = data.activities.feeding
        if feeding.todayCount > 0 {
            var feedingText = "\(feeding.todayCount) feeding\(feeding.todayCount == 1 ? "" : "s")"
            if let lastTime = getLastActivityTime(for: .feeding, data: data) {
                let formatter = RelativeDateTimeFormatter()
                formatter.unitsStyle = .abbreviated
                feedingText += " (last \(formatter.localizedString(for: lastTime, relativeTo: Date())))"
            }
            parts.append(feedingText)
        }

        let sleep = data.activities.sleep
        if sleep.todayMinutes > 0 {
            let hours = sleep.todayMinutes / 60
            let mins = sleep.todayMinutes % 60
            if hours > 0 && mins > 0 {
                parts.append("Sleep: \(hours)h \(mins)m")
            } else if hours > 0 {
                parts.append("Sleep: \(hours)h")
            } else {
                parts.append("Sleep: \(mins)m")
            }
        }

        let diaper = data.activities.diaper
        let totalDiapers = diaper.todayCounts.wet + diaper.todayCounts.dirty + diaper.todayCounts.mixed + diaper.todayCounts.dry
        if totalDiapers > 0 {
            var diaperText = "Diapers: \(totalDiapers)"
            var details: [String] = []
            if diaper.todayCounts.wet > 0 { details.append("\(diaper.todayCounts.wet) wet") }
            if diaper.todayCounts.dirty > 0 { details.append("\(diaper.todayCounts.dirty) dirty") }
            if diaper.todayCounts.mixed > 0 { details.append("\(diaper.todayCounts.mixed) mixed") }
            if !details.isEmpty {
                diaperText += " (\(details.joined(separator: ", ")))"
            }
            parts.append(diaperText)
        }

        let pumping = data.activities.pumping
        if pumping.sessionCount > 0 {
            let preferredUnit = UserDefaults(suiteName: appGroupId)?.string(forKey: "preferredVolumeUnit")
            let useMetric = preferredUnit == "ml"
            let volumeText: String
            if useMetric {
                volumeText = "\(String(format: "%.0f", pumping.todayVolumeMl)) ml"
            } else {
                let volumeOz = pumping.todayVolumeMl / 29.5735
                volumeText = "\(String(format: "%.1f", volumeOz)) oz"
            }
            parts.append("Pumping: \(pumping.sessionCount) session\(pumping.sessionCount == 1 ? "" : "s"), \(volumeText)")
        }

        let tummyTime = data.activities.tummyTime
        if tummyTime.todayMinutes > 0 {
            parts.append("Tummy time: \(tummyTime.todayMinutes)m")
        }

        if parts.isEmpty {
            return .result(value: "No activities recorded today for \(babyName)")
        }

        return .result(value: "Today for \(babyName): \(parts.joined(separator: ". ")).")
    }
}

// MARK: - Log Bottle Feeding Intent

struct LogBottleFeedingIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Bottle Feeding"
    static var description = IntentDescription("Log a bottle feeding")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Amount")
    var amount: Double

    @Parameter(title: "Type")
    var feedingType: BottleFeedingTypeEnum

    @Parameter(title: "Unit")
    var unit: VolumeUnitEnum?

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            return .result(value: "Failed to log bottle feeding")
        }

        let babyName = userDefaults.string(forKey: "selectedBabyName") ?? "baby"
        let preferredUnit = userDefaults.string(forKey: "preferredVolumeUnit")
        let effectiveUnit = unit ?? (preferredUnit == "ml" ? VolumeUnitEnum.ml : VolumeUnitEnum.oz)
        let amountMl: Double
        switch effectiveUnit {
        case .oz: amountMl = amount * 29.5735
        case .ml: amountMl = amount
        }

        let contentType = feedingType == .formula ? "formula" : "breast_milk"
        let now = ISO8601DateFormatter().string(from: Date())

        if let dataString = userDefaults.string(forKey: "widgetData"),
           let data = dataString.data(using: .utf8),
           var widgetData = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if var activities = widgetData["activities"] as? [String: Any],
               var feeding = activities["feeding"] as? [String: Any] {
                feeding["lastTime"] = now
                let count = (feeding["todayCount"] as? Int) ?? 0
                feeding["todayCount"] = count + 1
                feeding["lastType"] = "bottle"
                activities["feeding"] = feeding
                widgetData["activities"] = activities
                widgetData["updatedAt"] = now
                if let updatedData = try? JSONSerialization.data(withJSONObject: widgetData),
                   let updatedString = String(data: updatedData, encoding: .utf8) {
                    userDefaults.set(updatedString, forKey: "widgetData")
                }
            }
        }

        userDefaults.synchronize()
        reloadAllWidgetTimelines()

        var networkSuccess = false
        let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
        let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
        let accessToken = userDefaults.string(forKey: "supabaseAccessToken")
        let babyId = userDefaults.string(forKey: "selectedBabyId")
        let userId = userDefaults.string(forKey: "userId")

        if let supabaseUrl, let anonKey, let accessToken, let babyId, let userId {
            let urlString = "\(supabaseUrl)/rest/v1/feedings"
            if let url = URL(string: urlString) {
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue(anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
                request.timeoutInterval = 10

                let body: [String: Any] = [
                    "id": UUID().uuidString,
                    "baby_id": babyId,
                    "logged_by": userId,
                    "type": "bottle",
                    "started_at": now,
                    "ended_at": now,
                    "amount_ml": amountMl,
                    "content_type": contentType
                ]
                request.httpBody = try? JSONSerialization.data(withJSONObject: body)

                do {
                    let (_, response) = try await URLSession.shared.data(for: request)
                    let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                    if statusCode < 400 {
                        networkSuccess = true
                        NSLog("[LogBottle] Supabase insert success (status \(statusCode))")
                    } else {
                        NSLog("[LogBottle] Supabase insert failed (status \(statusCode)), writing pending for app fallback")
                    }
                } catch {
                    NSLog("[LogBottle] Network error: \(error.localizedDescription), writing pending for app fallback")
                }
            }
        }

        if !networkSuccess {
            let pending: [String: Any] = [
                "amountMl": amountMl,
                "contentType": contentType,
                "requestedAt": now
            ]
            if let json = try? JSONSerialization.data(withJSONObject: pending),
               let jsonString = String(data: json, encoding: .utf8) {
                userDefaults.set(jsonString, forKey: "pendingBottleLog")
                userDefaults.synchronize()
            }
        }

        let unitLabel = effectiveUnit == .oz ? "oz" : "ml"
        let typeLabel = feedingType == .formula ? "formula" : "breast milk"
        return .result(value: "Logged \(String(format: "%.1f", amount)) \(unitLabel) \(typeLabel) bottle for \(babyName)")
    }
}

// MARK: - Helper Functions

func durationMinutes(from isoString: String, to end: Date) -> Int? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var start = formatter.date(from: isoString)
    if start == nil {
        formatter.formatOptions = [.withInternetDateTime]
        start = formatter.date(from: isoString)
    }
    guard let start else { return nil }
    return max(0, Int(end.timeIntervalSince(start)) / 60)
}

func formatDurationText(minutes: Int) -> String {
    let hours = minutes / 60
    let mins = minutes % 60
    if hours > 0 && mins > 0 {
        return "\(hours) hour\(hours == 1 ? "" : "s") \(mins) minute\(mins == 1 ? "" : "s")"
    } else if hours > 0 {
        return "\(hours) hour\(hours == 1 ? "" : "s")"
    } else {
        return "\(mins) minute\(mins == 1 ? "" : "s")"
    }
}

func reloadAllWidgetTimelines() {
    WidgetCenter.shared.reloadAllTimelines()
}

// MARK: - Network Fetch for Active Timers

struct RemoteActiveTimer: Decodable {
    let id: String
    let activity_type: String
    let started_by: String
    let started_at: String
    let timer_data: RemoteTimerData?

    struct RemoteTimerData: Decodable {
        let side: String?
        let sleepType: String?
        let isPaused: Bool?
        let accumulatedSeconds: Int?
        let effectiveStartTime: String?
    }
}

func fetchActiveTimersFromNetwork() async -> [ActiveTimerData]? {
    guard let userDefaults = UserDefaults(suiteName: appGroupId),
          let supabaseUrl = userDefaults.string(forKey: "supabaseUrl"),
          let anonKey = userDefaults.string(forKey: "supabaseAnonKey"),
          let accessToken = userDefaults.string(forKey: "supabaseAccessToken"),
          let babyId = userDefaults.string(forKey: "selectedBabyId"),
          let userId = userDefaults.string(forKey: "userId") else {
        NSLog("[WidgetTimeline] fetchActiveTimersFromNetwork: missing credentials")
        return nil
    }

    let urlString = "\(supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&select=id,activity_type,started_by,started_at,timer_data"
    guard let url = URL(string: urlString) else { return nil }

    var request = URLRequest(url: url)
    request.setValue(anonKey, forHTTPHeaderField: "apikey")
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.timeoutInterval = 10

    guard let (data, response) = try? await URLSession.shared.data(for: request),
          let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        NSLog("[WidgetTimeline] fetchActiveTimersFromNetwork: request failed or non-200")
        return nil
    }

    guard let remoteTimers = try? JSONDecoder().decode([RemoteActiveTimer].self, from: data) else {
        NSLog("[WidgetTimeline] fetchActiveTimersFromNetwork: decode failed")
        return nil
    }

    NSLog("[WidgetTimeline] fetchActiveTimersFromNetwork: returned \(remoteTimers.count) timers")
    for rt in remoteTimers {
        NSLog("[WidgetTimeline]   timer: type=\(rt.activity_type) isPaused=\(rt.timer_data?.isPaused ?? false) accumulated=\(rt.timer_data?.accumulatedSeconds ?? 0) effectiveStart=\(rt.timer_data?.effectiveStartTime ?? "nil")")
    }

    let activityTypeMap: [String: String] = [
        "feeding": "feeding",
        "sleep": "sleep",
        "pumping": "pumping",
        "tummy_time": "tummyTime"
    ]

    return remoteTimers.compactMap { timer in
        guard let widgetType = activityTypeMap[timer.activity_type] else { return nil }
        let context = timer.timer_data?.side ?? timer.timer_data?.sleepType
        let startTime: String
        if !(timer.timer_data?.isPaused ?? false), let effective = timer.timer_data?.effectiveStartTime {
            startTime = effective
        } else {
            startTime = timer.started_at
        }
        return ActiveTimerData(
            type: widgetType,
            startTime: startTime,
            context: context,
            isRemote: timer.started_by != userId,
            isPaused: timer.timer_data?.isPaused,
            accumulatedSeconds: timer.timer_data?.accumulatedSeconds
        )
    }
}

func filterStoppedTimers(_ timers: [ActiveTimerData]?) -> [ActiveTimerData]? {
    guard var timers = timers else { return nil }
    guard let userDefaults = UserDefaults(suiteName: appGroupId),
          let stopJson = userDefaults.string(forKey: "pendingWidgetStop"),
          !stopJson.isEmpty,
          let stopData = stopJson.data(using: .utf8),
          let stop = try? JSONSerialization.jsonObject(with: stopData) as? [String: String],
          let stoppedType = stop["activityType"],
          let stoppedAtStr = stop["stoppedAt"] else {
        return timers
    }
    let widgetType = stoppedType == "tummy_time" ? "tummyTime" : stoppedType

    let isoFormatter = ISO8601DateFormatter()
    isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var stoppedAtDate = isoFormatter.date(from: stoppedAtStr)
    if stoppedAtDate == nil {
        isoFormatter.formatOptions = [.withInternetDateTime]
        stoppedAtDate = isoFormatter.date(from: stoppedAtStr)
    }
    guard let stoppedAt = stoppedAtDate else {
        timers.removeAll { $0.type == widgetType }
        return timers
    }

    let hasNewerTimer = timers.contains { timer in
        guard timer.type == widgetType else { return false }
        var timerStart: Date?
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        timerStart = fmt.date(from: timer.startTime)
        if timerStart == nil {
            fmt.formatOptions = [.withInternetDateTime]
            timerStart = fmt.date(from: timer.startTime)
        }
        guard let start = timerStart else { return false }
        return start > stoppedAt
    }

    if hasNewerTimer {
        userDefaults.removeObject(forKey: "pendingWidgetStop")
        return timers
    }

    timers.removeAll { timer in
        guard timer.type == widgetType else { return false }
        var timerStart: Date?
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        timerStart = fmt.date(from: timer.startTime)
        if timerStart == nil {
            fmt.formatOptions = [.withInternetDateTime]
            timerStart = fmt.date(from: timer.startTime)
        }
        guard let start = timerStart else { return true }
        return start <= stoppedAt
    }
    return timers
}

func mergeNetworkTimers(cached: WidgetDataModel?, networkTimers: [ActiveTimerData]?) -> WidgetDataModel? {
    guard var model = cached else { return nil }
    guard let networkTimers = networkTimers else { return model }

    var mergedTimers: [ActiveTimerData] = []

    for timer in networkTimers {
        if timer.isRemote == true {
            mergedTimers.append(timer)
        } else {
            if var cachedTimer = model.activeTimers?.first(where: { $0.type == timer.type }) {
                if timer.isPaused != nil {
                    cachedTimer.isPaused = timer.isPaused
                    if let networkAccumulated = timer.accumulatedSeconds {
                        cachedTimer.accumulatedSeconds = networkAccumulated
                    }
                }
                if timer.isPaused != true {
                    cachedTimer.startTime = timer.startTime
                }
                if cachedTimer.context == nil, let networkContext = timer.context {
                    cachedTimer.context = networkContext
                }
                mergedTimers.append(cachedTimer)
            } else {
                mergedTimers.append(timer)
            }
        }
    }

    if let cachedTimers = model.activeTimers {
        for cachedTimer in cachedTimers where cachedTimer.isRemote != true {
            if !mergedTimers.contains(where: { $0.type == cachedTimer.type }) {
                // Timer exists in cache but not on network — it was stopped externally
            }
        }
    }

    model.activeTimers = mergedTimers
    model.activeTimer = mergedTimers.first

    return model
}

// MARK: - Shared Widget Data Functions

func loadWidgetData() -> WidgetDataModel? {
    guard let userDefaults = UserDefaults(suiteName: appGroupId),
          let dataString = userDefaults.string(forKey: "widgetData"),
          let data = dataString.data(using: .utf8) else {
        return nil
    }
    return try? JSONDecoder().decode(WidgetDataModel.self, from: data)
}

func saveWidgetDataToAppGroup(_ model: WidgetDataModel) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId),
          let encoded = try? JSONEncoder().encode(model),
          let jsonString = String(data: encoded, encoding: .utf8) else { return }
    userDefaults.set(jsonString, forKey: "widgetData")
}

func isUserAuthenticated() -> Bool {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else { return false }
    return userDefaults.string(forKey: "supabaseAccessToken") != nil
}

func getLastActivityTime(for activity: ActivityType, data: WidgetDataModel?) -> Date? {
    guard let data = data else { return nil }

    let isoString: String?
    switch activity {
    case .feeding: isoString = data.activities.feeding.lastTime
    case .sleep: isoString = data.activities.sleep.lastTime
    case .diaper: isoString = data.activities.diaper.lastTime
    case .pumping: isoString = data.activities.pumping.lastTime
    case .tummyTime: isoString = data.activities.tummyTime.lastTime
    }

    guard let string = isoString else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: string) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: string)
}

func getActiveTimerStartDate(data: WidgetDataModel?) -> Date? {
    guard let timer = data?.activeTimer else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: timer.startTime) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: timer.startTime)
}

func getActiveTimerStartDate(for type: ActivityType, data: WidgetDataModel?) -> Date? {
    guard let timer = data?.getActiveTimer(for: type) else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: timer.startTime) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: timer.startTime)
}

func isTimerPausedForActivity(_ type: ActivityType, data: WidgetDataModel?) -> Bool {
    return data?.isTimerPaused(for: type) ?? false
}

func getPausedElapsedSeconds(_ type: ActivityType, data: WidgetDataModel?) -> Int {
    return data?.getActiveTimer(for: type)?.accumulatedSeconds ?? 0
}

func formatWidgetElapsed(_ seconds: Int) -> String {
    let h = seconds / 3600
    let m = (seconds % 3600) / 60
    let s = seconds % 60
    if h > 0 {
        return String(format: "%d:%02d:%02d", h, m, s)
    }
    return String(format: "%d:%02d", m, s)
}

func getTimerContext(data: WidgetDataModel?) -> String? {
    return data?.activeTimer?.context
}

func getTimerContext(for type: ActivityType, data: WidgetDataModel?) -> String? {
    return data?.getActiveTimer(for: type)?.context
}

func getUpdatedAtDate(data: WidgetDataModel?) -> Date? {
    guard let data = data else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: data.updatedAt) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: data.updatedAt)
}

func isCachedDataFresh(data: WidgetDataModel?, now: Date = Date()) -> Bool {
    guard let updatedAt = getUpdatedAtDate(data: data) else { return false }
    return now.timeIntervalSince(updatedAt) <= 30
}

func isDataStale(data: WidgetDataModel?, now: Date = Date()) -> Bool {
    guard let updatedAt = getUpdatedAtDate(data: data) else { return true }
    let staleThresholdSeconds: TimeInterval = 60 * 60
    return now.timeIntervalSince(updatedAt) > staleThresholdSeconds
}

func formatStalenessIndicator(data: WidgetDataModel?, now: Date = Date()) -> String? {
    guard let updatedAt = getUpdatedAtDate(data: data) else { return nil }
    let interval = now.timeIntervalSince(updatedAt)
    let staleThresholdSeconds: TimeInterval = 60 * 60

    if interval <= staleThresholdSeconds {
        return nil
    }

    let hours = Int(interval) / 3600
    if hours >= 24 {
        let days = hours / 24
        return "Synced \(days)d ago"
    } else {
        return "Synced \(hours)h ago"
    }
}

func createSampleWidgetData() -> WidgetDataModel {
    let now = Date()
    let oneHourAgo = now.addingTimeInterval(-3600)
    let twoHoursAgo = now.addingTimeInterval(-7200)
    let threeHoursAgo = now.addingTimeInterval(-10800)

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    return WidgetDataModel(
        babyId: "sample",
        babyName: "Sofi",
        activities: WidgetActivityData(
            feeding: WidgetActivityData.FeedingData(
                lastTime: formatter.string(from: oneHourAgo),
                todayCount: 6,
                lastType: "breast",
                lastSide: "left"
            ),
            sleep: WidgetActivityData.SleepData(
                lastTime: formatter.string(from: twoHoursAgo),
                todayMinutes: 180,
                goalMinutes: 840,
                lastDurationMinutes: 45,
                isActive: false,
                sleepType: "nap"
            ),
            diaper: WidgetActivityData.DiaperData(
                lastTime: formatter.string(from: threeHoursAgo),
                todayCounts: WidgetActivityData.DiaperData.DiaperCounts(wet: 4, dirty: 2, mixed: 1, dry: 0),
                lastType: "wet"
            ),
            pumping: WidgetActivityData.PumpingData(
                lastTime: formatter.string(from: twoHoursAgo),
                todayVolumeMl: 120.0,
                sessionCount: 3,
                lastSide: "both"
            ),
            growth: WidgetActivityData.GrowthData(lastMeasurement: nil),
            tummyTime: WidgetActivityData.TummyTimeData(
                lastTime: formatter.string(from: oneHourAgo),
                todayMinutes: 15,
                goalMinutes: 30,
                lastDurationMinutes: 8
            )
        ),
        activeTimer: nil,
        activeTimers: nil,
        updatedAt: formatter.string(from: now)
    )
}

// MARK: - Color Extension for Hex

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Widget Colors

struct WidgetColors {
    struct Accent {
        static let feeding = "8CB369"
        static let sleep = "9E8DA9"
        static let diaper = "E0A099"
        static let pumping = "7BA3A8"
        static let growth = "6AAB9C"
        static let tummyTime = "D4A574"
    }

    struct MutedLight {
        static let feeding = "EEF4E9"
        static let sleep = "F2EFF4"
        static let diaper = "FBF0EE"
        static let pumping = "EDF3F4"
        static let growth = "EBF4F2"
        static let tummyTime = "F9F2EA"
    }

    struct MutedDark {
        static let feeding = "2A3327"
        static let sleep = "2D2A31"
        static let diaper = "332A28"
        static let pumping = "272E30"
        static let growth = "273230"
        static let tummyTime = "332D26"
    }

    struct Background {
        static let light = "F5EDE8"
        static let dark = "1C1C1E"
    }

    struct Button {
        static let light = "FFFFFF"
        static let dark = "2C2C2E"
    }
}
