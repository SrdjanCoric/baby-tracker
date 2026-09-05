import WidgetKit
import SwiftUI
import AppIntents
import ActivityKit

// MARK: - App Group Constants

let appGroupId = "group.com.sofibaby.app"

// MARK: - Color Extension for Hex

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
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
// These colors match the app's color scheme. Copy to src/constants/widget-colors.ts for React Native.
// Hex values can be used in both Swift (Color(hex:)) and TypeScript.

struct WidgetColors {
    // Activity accent colors (primary/vibrant)
    struct Accent {
        static let feeding = "8CB369"     // Green
        static let sleep = "9E8DA9"       // Lavender
        static let diaper = "E0A099"      // Coral/Pink
        static let pumping = "7BA3A8"     // Teal
        static let growth = "6AAB9C"      // Mint
        static let tummyTime = "D4A574"   // Tan/Orange
    }

    // Light mode muted backgrounds
    struct MutedLight {
        static let feeding = "EEF4E9"     // Light green
        static let sleep = "F2EFF4"       // Light lavender
        static let diaper = "FBF0EE"      // Light coral
        static let pumping = "EDF3F4"     // Light teal
        static let growth = "EBF4F2"      // Light mint
        static let tummyTime = "F9F2EA"   // Light tan
    }

    // Dark mode muted backgrounds
    struct MutedDark {
        static let feeding = "2A3327"     // Dark green tint
        static let sleep = "2D2A31"       // Dark lavender tint
        static let diaper = "332A28"      // Dark coral tint
        static let pumping = "272E30"     // Dark teal tint
        static let growth = "273230"      // Dark mint tint
        static let tummyTime = "332D26"   // Dark tan tint
    }

    // Widget container backgrounds
    struct Background {
        static let light = "F5EDE8"       // Warm cream
        static let dark = "1C1C1E"        // System dark
    }

    // Button backgrounds
    struct Button {
        static let light = "FFFFFF"       // White
        static let dark = "2C2C2E"        // Dark gray
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
        case .feeding: return L.feeding
        case .sleep: return L.sleep
        case .diaper: return L.diaper
        case .pumping: return L.pumping
        case .tummyTime: return L.tummyTime
        }
    }

    func runningSentence(for context: String) -> String {
        switch self {
        case .feeding: return String(format: L.timerRunningFeeding, context)
        case .sleep: return String(format: L.timerRunningSleep, context)
        case .diaper: return String(format: L.timerRunningDiaper, context)
        case .pumping: return String(format: L.timerRunningPumping, context)
        case .tummyTime: return String(format: L.timerRunningTummyTime, context)
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

    // Accent colors (from WidgetColors)
    var accentColor: Color {
        switch self {
        case .feeding: return Color(hex: WidgetColors.Accent.feeding)
        case .sleep: return Color(hex: WidgetColors.Accent.sleep)
        case .diaper: return Color(hex: WidgetColors.Accent.diaper)
        case .pumping: return Color(hex: WidgetColors.Accent.pumping)
        case .tummyTime: return Color(hex: WidgetColors.Accent.tummyTime)
        }
    }

    // Muted background colors (light mode)
    var mutedColor: Color {
        switch self {
        case .feeding: return Color(hex: WidgetColors.MutedLight.feeding)
        case .sleep: return Color(hex: WidgetColors.MutedLight.sleep)
        case .diaper: return Color(hex: WidgetColors.MutedLight.diaper)
        case .pumping: return Color(hex: WidgetColors.MutedLight.pumping)
        case .tummyTime: return Color(hex: WidgetColors.MutedLight.tummyTime)
        }
    }

    // Muted background colors (dark mode)
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
}

func routedStopURL(for activity: ActivityType, data: WidgetDataModel?) -> URL {
    guard let data,
          let timerInstanceId = data.getActiveTimer(for: activity)?.timerInstanceId else {
        return activity.deepLinkURL
    }
    var components = URLComponents(string: "sofibaby://\(activity.rawValue)")!
    components.queryItems = [
        URLQueryItem(name: "action", value: "stop"),
        URLQueryItem(name: "babyId", value: data.babyId),
        URLQueryItem(name: "timerInstanceId", value: timerInstanceId),
        URLQueryItem(name: "commandId", value: "routed:\(data.babyId):\(timerInstanceId)")
    ]
    return components.url ?? activity.deepLinkURL
}

let externalTimerCommandQueueKey = "externalTimerCommandQueue"
let externalTimerCommandQueueLock = NSLock()

struct ExternalTimerCommand: Codable {
    var id: String
    var action: String
    var activityType: String
    var babyId: String
    var timerInstanceId: String
    var eventAt: String
    var source: String
    var legacy: Bool?
    var payload: Payload?

    struct Payload: Codable {
        var volumeMl: Double?
    }
}

struct ExternalTimerCommandQueue: Codable {
    var version: Int = 1
    var commands: [ExternalTimerCommand] = []
}

func readExternalTimerCommandQueue(from userDefaults: UserDefaults) -> ExternalTimerCommandQueue {
    let decoder = JSONDecoder()
    if let data = userDefaults.data(forKey: externalTimerCommandQueueKey),
       let decoded = try? decoder.decode(ExternalTimerCommandQueue.self, from: data),
       decoded.version == 1 {
        return decoded
    }
    if let json = userDefaults.string(forKey: externalTimerCommandQueueKey),
       let data = json.data(using: .utf8),
       let decoded = try? decoder.decode(ExternalTimerCommandQueue.self, from: data),
       decoded.version == 1 {
        return decoded
    }
    return ExternalTimerCommandQueue()
}

func pendingSleepStopAt(for babyId: String) -> String? {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else { return nil }
    return readExternalTimerCommandQueue(from: userDefaults).commands.last(where: {
        $0.action == "stop"
            && $0.activityType == "sleep"
            && $0.babyId == babyId
    })?.eventAt
}

/// Widget-side reader of pending stop commands for the snapshot coordinator's
/// timer-list merge. A locally-known timer whose DB activity type has a queued
/// stop command is dropped on the next refresh so the widget's own Stop button
/// can clear accountless/offline timers that have no server row to delete.
final class AppGroupPendingStopReader: WidgetSnapshotPendingStopReading, @unchecked Sendable {
    private let userDefaults: UserDefaults

    init(userDefaults: UserDefaults) {
        self.userDefaults = userDefaults
    }

    func pendingStopActivityTypes(for babyId: String) -> Set<String> {
        readExternalTimerCommandQueue(from: userDefaults)
            .commands
            .filter { $0.action == "stop" && $0.babyId == babyId }
            .map { $0.activityType }
            .reduce(into: Set<String>()) { $0.insert($1) }
    }
}

func writeExternalTimerCommandQueue(_ queue: ExternalTimerCommandQueue, to userDefaults: UserDefaults) {
    if let data = try? JSONEncoder().encode(queue),
       let json = String(data: data, encoding: .utf8) {
        userDefaults.set(json, forKey: externalTimerCommandQueueKey)
    }
}

func appendExternalTimerCommand(_ command: ExternalTimerCommand, to userDefaults: UserDefaults) {
    externalTimerCommandQueueLock.lock()
    defer { externalTimerCommandQueueLock.unlock() }
    var queue = readExternalTimerCommandQueue(from: userDefaults)
    guard !queue.commands.contains(where: { $0.id == command.id }) else { return }
    queue.commands.append(command)
    writeExternalTimerCommandQueue(queue, to: userDefaults)
}

func removeExternalTimerCommand(id: String, from userDefaults: UserDefaults) {
    externalTimerCommandQueueLock.lock()
    defer { externalTimerCommandQueueLock.unlock() }
    var queue = readExternalTimerCommandQueue(from: userDefaults)
    let originalCount = queue.commands.count
    queue.commands.removeAll { $0.id == id }
    guard queue.commands.count != originalCount else { return }
    writeExternalTimerCommandQueue(queue, to: userDefaults)
}

// MARK: - Interactive App Intents (iOS 17+)

struct StartActivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Activity"
    static var description = IntentDescription("Start tracking an activity")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Activity")
    var activity: ActivityType

    init() {
        self.activity = .feeding
    }

    init(activity: ActivityType) {
        self.activity = activity
    }

    func perform() async throws -> some IntentResult {
        // The app will be opened due to openAppWhenRun = true
        // URL handling happens via the deep link
        return .result()
    }
}

struct QuickLogIntent: AppIntent {
    static var title: LocalizedStringResource = "Quick Log"
    static var description = IntentDescription("Quickly log an activity")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Activity")
    var activity: ActivityType

    init() {
        self.activity = .feeding
    }

    init(activity: ActivityType) {
        self.activity = activity
    }

    func perform() async throws -> some IntentResult {
        return .result()
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
    var activity: ActivityType

    init() {
        self.activity = .feeding
    }

    init(activity: ActivityType) {
        self.activity = activity
    }

    func perform() async throws -> some IntentResult {
        NSLog("[StopActivity] perform() called for activity: \(activity.rawValue)")

        captureRunningActivityPushToken()

        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            NSLog("[StopActivity] ERROR: UserDefaults nil")
            return .result()
        }

        guard let identity = widgetSnapshotRuntime?.identity.currentIdentity() else {
            NSLog("[StopActivity] ERROR: no signed-in identity; ignoring unauthenticated stop")
            return .result()
        }

        let dbType = activity == .tummyTime ? "tummy_time" : activity.rawValue

        let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
        let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
        let babyId = userDefaults.string(forKey: "selectedBabyId")
        let laPushToken = userDefaults.string(forKey: "liveActivityPushToken")
        NSLog("[StopActivity] liveActivityPushToken=\(laPushToken != nil ? "present" : "nil")")

        let stopRequestedAt = Date()
        var effectiveStopDate = stopRequestedAt
        if let pendingPauseString = userDefaults.string(forKey: "pendingWidgetPauseToggle"),
           let pendingPauseData = pendingPauseString.data(using: .utf8),
           let pendingPause = try? JSONSerialization.jsonObject(with: pendingPauseData) as? [String: Any],
           pendingPause["action"] as? String == "pause",
           pendingPause["activityType"] as? String == dbType,
           let pausedAtString = pendingPause["pausedAt"] as? String {
            let pauseFormatter = ISO8601DateFormatter()
            pauseFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            var parsedPauseAt = pauseFormatter.date(from: pausedAtString)
            if parsedPauseAt == nil {
                pauseFormatter.formatOptions = [.withInternetDateTime]
                parsedPauseAt = pauseFormatter.date(from: pausedAtString)
            }
            if let parsedPauseAt, parsedPauseAt <= stopRequestedAt {
                effectiveStopDate = parsedPauseAt
            }
        }
        let eventAt = ISO8601DateFormatter().string(from: effectiveStopDate)
        let activeTimer = loadWidgetData()?.getActiveTimer(for: activity)
        if let babyId {
            let timerInstanceId = activeTimer?.timerInstanceId
            let resolvedTimerInstanceId = timerInstanceId ?? "legacy:\(babyId):\(dbType):\(eventAt)"
            let command = ExternalTimerCommand(
                id: UUID().uuidString,
                action: "stop",
                activityType: dbType,
                babyId: babyId,
                timerInstanceId: resolvedTimerInstanceId,
                eventAt: eventAt,
                source: "widget",
                legacy: timerInstanceId == nil ? true : nil,
                payload: nil
            )
            appendExternalTimerCommand(command, to: userDefaults)
        }

        if activeTimer?.isRemote != true,
           let supabaseUrl, let anonKey, let babyId,
           let url = URL(string: "\(supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&activity_type=eq.\(dbType)&started_by=eq.\(identity.accountId)") {
            _ = try? await widgetSnapshotRuntime?.transport.send { token in
                var request = URLRequest(url: url)
                request.httpMethod = "DELETE"
                request.setValue(anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.timeoutInterval = 10
                return request
            }
        }

        userDefaults.removeObject(forKey: "pendingWidgetPauseToggle")

        if let pushToken = userDefaults.string(forKey: "liveActivityPushToken"),
           !pushToken.isEmpty,
           let supabaseUrl = supabaseUrl,
           let url = URL(string: "\(supabaseUrl)/functions/v1/end-live-activity") {
            var laBody: [String: Any] = ["pushToken": pushToken]
            #if DEBUG
            laBody["isSandbox"] = true
            #endif
            let bodyData = try? JSONSerialization.data(withJSONObject: laBody)
            _ = try? await widgetSnapshotRuntime?.transport.send { token in
                var laRequest = URLRequest(url: url)
                laRequest.httpMethod = "POST"
                laRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                laRequest.setValue(anonKey ?? "", forHTTPHeaderField: "apikey")
                laRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                laRequest.timeoutInterval = 10
                laRequest.httpBody = bodyData
                return laRequest
            }
            userDefaults.removeObject(forKey: "liveActivityPushToken")
        }

        userDefaults.synchronize()
        _ = await refreshWidgetSnapshot()
        return .result()
    }
}

// MARK: - Toggle Pause Intent

struct TogglePauseActivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Pause/Resume Activity"
    static var description = IntentDescription("Toggle pause on the current timer")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity")
    var activity: ActivityType

    init() {
        self.activity = .feeding
    }

    init(activity: ActivityType) {
        self.activity = activity
    }

    func perform() async throws -> some IntentResult {
        NSLog("[TogglePause] perform() called for activity: \(activity.rawValue)")

        captureRunningActivityPushToken()

        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            NSLog("[TogglePause] ERROR: UserDefaults nil")
            return .result()
        }

        guard widgetSnapshotRuntime?.identity.currentIdentity() != nil else {
            NSLog("[TogglePause] ERROR: no signed-in identity; ignoring unauthenticated toggle")
            return .result()
        }

        let dbType = activity == .tummyTime ? "tummy_time" : activity.rawValue
        let widgetType = activity.rawValue

        let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
        let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
        let babyId = userDefaults.string(forKey: "selectedBabyId")
        let userId = userDefaults.string(forKey: "userId")

        NSLog("[TogglePause] supabaseUrl=\(supabaseUrl != nil) anonKey=\(anonKey != nil) babyId=\(babyId != nil) userId=\(userId != nil)")

        var widgetData = loadWidgetData()
        if widgetData?.getActiveTimer(for: activity) == nil {
            widgetData = await refreshWidgetSnapshot(reloadTimelines: false)
        }
        guard let widgetData,
              let timer = widgetData.getActiveTimer(for: activity) else {
            NSLog("[TogglePause] ERROR: no timer found for type \(widgetType)")
            WidgetCenter.shared.reloadAllTimelines()
            return .result()
        }

        let currentlyPaused = timer.isPaused ?? false
        let timerContext = timer.context
        let now = Date()
        let isoNow = ISO8601DateFormatter().string(from: now)
        let liveActivityPushToken = userDefaults.string(forKey: "liveActivityPushToken")

        let widgetBabyId = widgetData.babyId
        NSLog("[TogglePause] currentlyPaused=\(currentlyPaused) context=\(timerContext ?? "nil") laPushToken=\(liveActivityPushToken != nil) widgetBabyId=\(widgetBabyId)")

        let effectiveBabyId = babyId ?? widgetBabyId
        let effectiveUserId = userId ?? ""

        if currentlyPaused {
            var pausedAtStr: String?
            if let pendingString = userDefaults.string(forKey: "pendingWidgetPauseToggle"),
               let pendingData = pendingString.data(using: .utf8),
               let pending = try? JSONSerialization.jsonObject(with: pendingData) as? [String: Any],
               pending["activityType"] as? String == dbType,
               pending["action"] as? String == "pause" {
                pausedAtStr = pending["pausedAt"] as? String
            }
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

            let accumulatedSeconds = timer.accumulatedSeconds ?? 0
            let effectiveStartISO = timer.startTime

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

            if let supabaseUrl {
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
                await callTogglePauseEdgeFunction(supabaseUrl: supabaseUrl, anonKey: anonKey ?? "", body: edgeBody)
                NSLog("[TogglePause] edge function returned")
            } else {
                NSLog("[TogglePause] SKIPPED edge function: missing Supabase URL")
            }
        } else {
            let startTimeStr = timer.startTime
            var accumulatedSeconds = 0
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

            if let supabaseUrl {
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
                await callTogglePauseEdgeFunction(supabaseUrl: supabaseUrl, anonKey: anonKey ?? "", body: edgeBody)
                NSLog("[TogglePause] edge function returned")
            } else {
                NSLog("[TogglePause] SKIPPED edge function: missing Supabase URL")
            }
        }

        userDefaults.synchronize()
        _ = await refreshWidgetSnapshot()
        NSLog("[TogglePause] done, reconciled complete snapshot")
        return .result()
    }

    private func callTogglePauseEdgeFunction(supabaseUrl: String?, anonKey: String, body: [String: Any]) async {
        guard let runtime = widgetSnapshotRuntime,
              let supabaseUrl,
              let url = URL(string: "\(supabaseUrl)/functions/v1/toggle-timer-pause") else { return }
        let bodyData = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (status, data) = try await runtime.transport.send { token in
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue(anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.timeoutInterval = 10
                request.httpBody = bodyData
                return request
            }
            NSLog("[TogglePause] edge response: status=\(status) body=\(String(data: data, encoding: .utf8)?.prefix(200) ?? "")")
        } catch {
            NSLog("[TogglePause] edge transport error: \(error)")
        }
    }
}

// MARK: - Configuration Intents

struct SelectActivityIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Activity"
    static var description = IntentDescription("Choose which activity to display")

    @Parameter(title: "Activity", default: .feeding)
    var activity: ActivityType
}

struct SelectFourActivitiesIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Activities"
    static var description = IntentDescription("Choose four activities to display")

    @Parameter(title: "First Activity", default: .feeding)
    var activity1: ActivityType

    @Parameter(title: "Second Activity", default: .sleep)
    var activity2: ActivityType

    @Parameter(title: "Third Activity", default: .diaper)
    var activity3: ActivityType

    @Parameter(title: "Fourth Activity", default: .tummyTime)
    var activity4: ActivityType
}

struct SelectTwoActivitiesIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Activities"
    static var description = IntentDescription("Choose two activities to display")

    @Parameter(title: "First Activity", default: .feeding)
    var activity1: ActivityType

    @Parameter(title: "Second Activity", default: .sleep)
    var activity2: ActivityType
}

// MARK: - Timeline Entry

struct BabyWidgetEntry: TimelineEntry {
    let date: Date
    let widgetData: WidgetDataModel?
    let selectedActivity: ActivityType
    let selectedActivities: [ActivityType]
    let isUserAuthenticated: Bool
}

// MARK: - Shared Data Loading

enum WidgetSnapshotTransportError: Error {
    case missingCredentials
    case invalidURL
    case unauthorized
    case unsuccessfulResponse
}

final class AppGroupWidgetSnapshotStore: WidgetSnapshotStoring, @unchecked Sendable {
    private let userDefaults: UserDefaults

    init(userDefaults: UserDefaults) {
        self.userDefaults = userDefaults
    }

    func readSnapshot(for babyId: String) -> Data? {
        if let value = userDefaults.string(forKey: "widgetSnapshot.\(babyId)"),
           let bytes = value.data(using: .utf8) {
            return bytes
        }
        return nil
    }

    func readLegacySnapshot() -> Data? {
        userDefaults.string(forKey: "widgetData")?.data(using: .utf8)
    }

    func isCacheOrphaned() -> Bool {
        userDefaults.bool(forKey: "widgetDataOrphaned")
    }

    func writeSnapshot(_ bytes: Data, for babyId: String) throws {
        guard let value = String(data: bytes, encoding: .utf8) else {
            throw WidgetSnapshotError.semanticFailure
        }
        userDefaults.set(value, forKey: "widgetSnapshot.\(babyId)")
        userDefaults.set(value, forKey: "widgetData")
        let idsKey = "widgetSnapshotBabyIds"
        let existingIds = userDefaults.string(forKey: idsKey)
            .flatMap { $0.data(using: .utf8) }
            .flatMap { try? JSONDecoder().decode([String].self, from: $0) }
            ?? []
        let ids = Array(Set(existingIds + [babyId])).sorted()
        if let encodedIds = try? JSONEncoder().encode(ids),
           let value = String(data: encodedIds, encoding: .utf8) {
            userDefaults.set(value, forKey: idsKey)
        }
    }
}

/// Read-only accessor for the legacy App Group `supabaseAccessToken` bearer
/// token. Used only as a backwards-compatibility fallback (post-app-update,
/// pre-first-app-launch window) by the widget transport; the app purges the
/// token on its first launch after upgrade (TR-5). `UserDefaults` is not
/// declared `Sendable` by the SDK but Apple documents it as thread-safe, hence
/// the unchecked conformance for capture inside the transport's `@Sendable`
/// legacy-token provider closure.
struct AppGroupLegacyAccessTokenReader: @unchecked Sendable {
    private let userDefaults: UserDefaults
    private let key: String

    init(userDefaults: UserDefaults, key: String = "supabaseAccessToken") {
        self.userDefaults = userDefaults
        self.key = key
    }

    func current() -> String? {
        userDefaults.string(forKey: key)
    }
}

final class AppGroupWidgetSnapshotIdentityReader: WidgetSnapshotIdentityReading, @unchecked Sendable {
    private let userDefaults: UserDefaults
    private let vault: SharedSessionVaulting

    init(userDefaults: UserDefaults, vault: SharedSessionVaulting) {
        self.userDefaults = userDefaults
        self.vault = vault
    }

    func currentIdentity() -> WidgetSnapshotIdentity? {
        guard let accountId = userDefaults.string(forKey: "userId"),
              let babyId = userDefaults.string(forKey: "selectedBabyId") else {
            return nil
        }
        let timezone = userDefaults.string(forKey: "widgetTimezone")
            ?? TimeZone.current.identifier

        if let envelope = try? vault.read() {
            return WidgetSnapshotIdentity(
                accountId: accountId,
                babyId: babyId,
                generation: envelope.lineage,
                timezone: timezone
            )
        }
        // Best-effort backwards-compatibility fallback (TR-4). Before the app
        // writes the shared Keychain capsule, the widget reads the legacy App
        // Group `supabaseAccessToken` bearer read-only. It works only for the
        // token's remaining lifetime; one updated-app launch is required to
        // migrate the renewable session. The app then purges this legacy token
        // (TR-5), and the non-nil capsule permanently owns this path.
        if let legacyAccessToken = userDefaults.string(forKey: "supabaseAccessToken") {
            return WidgetSnapshotIdentity(
                accountId: accountId,
                babyId: babyId,
                generation: SupabaseSessionLineage.extract(fromAccessToken: legacyAccessToken) ?? "",
                timezone: timezone
            )
        }
        return nil
    }
}

final class SupabaseWidgetSnapshotFetcher: WidgetSnapshotFetching, @unchecked Sendable {
    private let transport: WidgetSupabaseTransport
    private let userDefaults: UserDefaults

    init(transport: WidgetSupabaseTransport, userDefaults: UserDefaults) {
        self.transport = transport
        self.userDefaults = userDefaults
    }

    func fetchSnapshot(for identity: WidgetSnapshotIdentity) async throws -> Data {
        guard let supabaseUrl = userDefaults.string(forKey: "supabaseUrl"),
              let anonKey = userDefaults.string(forKey: "supabaseAnonKey"),
              let url = URL(string: "\(supabaseUrl)/rest/v1/rpc/get_baby_activity_snapshot") else {
            throw WidgetSnapshotTransportError.invalidURL
        }

        let (status, bytes) = try await transport.send { accessToken in
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 10
            request.httpBody = try? JSONSerialization.data(withJSONObject: [
                "p_baby_id": identity.babyId,
                "p_timezone": identity.timezone
            ])
            return request
        }
        if status == 401 {
            throw WidgetSnapshotTransportError.unauthorized
        }
        guard (200..<300).contains(status) else {
            throw WidgetSnapshotTransportError.unsuccessfulResponse
        }
        return bytes
    }
}

private let widgetSnapshotRuntime: (
    store: AppGroupWidgetSnapshotStore,
    identity: AppGroupWidgetSnapshotIdentityReader,
    coordinator: WidgetSnapshotCoordinator,
    transport: WidgetSupabaseTransport
)? = {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else { return nil }
    let store = AppGroupWidgetSnapshotStore(userDefaults: userDefaults)
    let keychainStore = KeychainSharedSessionStore()
    let vault = SharedSessionVault(store: keychainStore)
    let identity = AppGroupWidgetSnapshotIdentityReader(userDefaults: userDefaults, vault: vault)
    let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
    let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
    let legacyTokenReader = AppGroupLegacyAccessTokenReader(userDefaults: userDefaults)
    let transport = WidgetSupabaseTransport(
        vault: vault,
        lock: PosixSharedSessionLock(),
        refreshClient: URLSessionSupabaseRefreshClient(),
        httpClient: URLSessionSupabaseHTTPClient(),
        config: SupabaseEndpointConfig(supabaseUrl: supabaseUrl ?? "", anonKey: anonKey ?? ""),
        logger: NSLogSessionLogger(),
        legacyAccessTokenProvider: { legacyTokenReader.current() }
    )
    let fetcher = SupabaseWidgetSnapshotFetcher(transport: transport, userDefaults: userDefaults)
    let coordinator = WidgetSnapshotCoordinator(
        store: store,
        identityReader: identity,
        fetcher: fetcher,
        pendingStopReader: AppGroupPendingStopReader(userDefaults: userDefaults),
        reload: { WidgetCenter.shared.reloadAllTimelines() }
    )
    return (store, identity, coordinator, transport)
}()

func refreshWidgetSnapshot(reloadTimelines: Bool = true) async -> WidgetDataModel? {
    guard let runtime = widgetSnapshotRuntime,
          let identity = runtime.identity.currentIdentity() else {
        return loadWidgetData()
    }
    return await runtime.coordinator.refresh(
        for: identity.babyId,
        reloadTimelines: reloadTimelines
    )
}

func loadWidgetData() -> WidgetDataModel? {
    guard let runtime = widgetSnapshotRuntime,
          let bytes = WidgetSnapshotSelector.snapshotBytes(
            identity: runtime.identity.currentIdentity(),
            store: runtime.store
          ),
          let decoded = try? WidgetSnapshotDecoder.decodeCache(bytes) else {
        return nil
    }
    guard runtime.identity.currentIdentity() == nil else { return decoded.data }
    // Credentials are absent. An accountless user's live cache must render its
    // running timer; a cache left behind by a departed signed-in session must
    // not. The orphan marker distinguishes these two nil-identity cases.
    return WidgetSnapshotSelector.credentiallessModel(
        decoded.data,
        cacheOrphaned: runtime.store.isCacheOrphaned()
    )
}

func isUserAuthenticated() -> Bool {
    return widgetSnapshotRuntime?.identity.currentIdentity() != nil
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
    let staleThresholdSeconds: TimeInterval = 60 * 60 // 1 hour
    return now.timeIntervalSince(updatedAt) > staleThresholdSeconds
}

func formatStalenessIndicator(data: WidgetDataModel?, now: Date = Date()) -> String? {
    guard let updatedAt = getUpdatedAtDate(data: data) else { return nil }
    let interval = now.timeIntervalSince(updatedAt)
    let staleThresholdSeconds: TimeInterval = 60 * 60 // 1 hour

    if interval <= staleThresholdSeconds {
        return nil // Data is fresh
    }

    let hours = Int(interval) / 3600
    if hours >= 24 {
        let days = hours / 24
        return String(format: L.syncedDaysAgo, days)
    } else {
        return String(format: L.syncedHoursAgo, hours)
    }
}

// MARK: - Sample Data for Widget Previews

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

// MARK: - Timeline Providers

struct SingleActivityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BabyWidgetEntry {
        BabyWidgetEntry(date: Date(), widgetData: createSampleWidgetData(), selectedActivity: .feeding, selectedActivities: [], isUserAuthenticated: true)
    }

    func snapshot(for configuration: SelectActivityIntent, in context: Context) async -> BabyWidgetEntry {
        let data = context.isPreview ? createSampleWidgetData() : loadWidgetData()
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: configuration.activity, selectedActivities: [], isUserAuthenticated: isUserAuthenticated())
    }

    func timeline(for configuration: SelectActivityIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        captureRunningActivityPushToken()
        let data = await refreshWidgetSnapshot(reloadTimelines: false)

        let authenticated = isUserAuthenticated()

        var entries: [BabyWidgetEntry] = []
        let now = Date()
        for minuteOffset in 0..<30 {
            let entryDate = now.addingTimeInterval(Double(minuteOffset) * 60)
            let entry = BabyWidgetEntry(date: entryDate, widgetData: data, selectedActivity: configuration.activity, selectedActivities: [], isUserAuthenticated: authenticated)
            entries.append(entry)
        }

        let nextUpdate = now.addingTimeInterval(30 * 60)
        return Timeline(entries: entries, policy: .after(nextUpdate))
    }
}

struct FourActivityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BabyWidgetEntry {
        BabyWidgetEntry(date: Date(), widgetData: createSampleWidgetData(), selectedActivity: .feeding, selectedActivities: [.feeding, .sleep, .diaper, .tummyTime], isUserAuthenticated: true)
    }

    func snapshot(for configuration: SelectFourActivitiesIntent, in context: Context) async -> BabyWidgetEntry {
        let data = context.isPreview ? createSampleWidgetData() : loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2, configuration.activity3, configuration.activity4]
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: .feeding, selectedActivities: activities, isUserAuthenticated: isUserAuthenticated())
    }

    func timeline(for configuration: SelectFourActivitiesIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        captureRunningActivityPushToken()
        let data = await refreshWidgetSnapshot(reloadTimelines: false)

        let activities = [configuration.activity1, configuration.activity2, configuration.activity3, configuration.activity4]
        let authenticated = isUserAuthenticated()

        var entries: [BabyWidgetEntry] = []
        let now = Date()
        for minuteOffset in 0..<30 {
            let entryDate = now.addingTimeInterval(Double(minuteOffset) * 60)
            let entry = BabyWidgetEntry(date: entryDate, widgetData: data, selectedActivity: .feeding, selectedActivities: activities, isUserAuthenticated: authenticated)
            entries.append(entry)
        }

        let nextUpdate = now.addingTimeInterval(30 * 60)
        return Timeline(entries: entries, policy: .after(nextUpdate))
    }
}

struct TwoActivityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BabyWidgetEntry {
        BabyWidgetEntry(date: Date(), widgetData: createSampleWidgetData(), selectedActivity: .feeding, selectedActivities: [.feeding, .sleep], isUserAuthenticated: true)
    }

    func snapshot(for configuration: SelectTwoActivitiesIntent, in context: Context) async -> BabyWidgetEntry {
        let data = context.isPreview ? createSampleWidgetData() : loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2]
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: .feeding, selectedActivities: activities, isUserAuthenticated: isUserAuthenticated())
    }

    func timeline(for configuration: SelectTwoActivitiesIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        captureRunningActivityPushToken()
        let data = await refreshWidgetSnapshot(reloadTimelines: false)

        let activities = [configuration.activity1, configuration.activity2]
        let authenticated = isUserAuthenticated()

        var entries: [BabyWidgetEntry] = []
        let now = Date()
        for minuteOffset in 0..<30 {
            let entryDate = now.addingTimeInterval(Double(minuteOffset) * 60)
            let entry = BabyWidgetEntry(date: entryDate, widgetData: data, selectedActivity: .feeding, selectedActivities: activities, isUserAuthenticated: authenticated)
            entries.append(entry)
        }

        let nextUpdate = now.addingTimeInterval(30 * 60)
        return Timeline(entries: entries, policy: .after(nextUpdate))
    }
}

// MARK: - Small Widget View
// Informational display: shows activity status and context

struct SmallWidgetView: View {
    let entry: BabyWidgetEntry

    var activity: ActivityType { entry.selectedActivity }

    var isActive: Bool {
        entry.widgetData?.hasActiveTimer(for: activity) ?? false
    }

    var isRemote: Bool {
        entry.widgetData?.isRemoteTimer(for: activity) ?? false
    }

    var controls: WidgetTimerControls {
        WidgetTimerControls(
            surface: .small,
            timer: entry.widgetData?.getActiveTimer(for: activity),
            isAuthenticated: entry.isUserAuthenticated
        )
    }

    var isStale: Bool {
        isDataStale(data: entry.widgetData, now: entry.date)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    if let babyName = entry.widgetData?.babyName {
                        Text(babyName)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                    if isStale, let stalenessText = formatStalenessIndicator(data: entry.widgetData, now: entry.date) {
                        Text(stalenessText)
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                    }
                }
                Spacer()
                Text(activity.emoji)
                    .font(.system(size: 20))
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            Spacer()

            VStack(spacing: 4) {
                if let data = entry.widgetData {
                    if isActive, let startDate = getActiveTimerStartDate(for: activity, data: data) {
                        let isPaused = isTimerPausedForActivity(activity, data: data)
                        if isRemote {
                            if let context = getTimerContext(for: activity, data: data) {
                                Text(context)
                                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                                    .foregroundStyle(.white.opacity(0.6))
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                            }

                            if isPaused {
                                HStack(spacing: 4) {
                                    Text("⏸")
                                        .font(.system(size: 14))
                                    Text(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))
                                        .font(.system(size: 22, weight: .light, design: .rounded))
                                        .monospacedDigit()
                                }
                                .foregroundStyle(.white.opacity(0.6))
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)
                            } else {
                                Text(startDate, style: .timer)
                                    .font(.system(size: 32, weight: .light, design: .rounded))
                                    .monospacedDigit()
                                    .foregroundStyle(.white.opacity(0.5))
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                            }
                        } else if isPaused {
                            HStack(spacing: 4) {
                                Text("⏸")
                                    .font(.system(size: 14))
                                Text(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))
                                    .font(.system(size: 22, weight: .light, design: .rounded))
                                    .monospacedDigit()
                            }
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .multilineTextAlignment(.center)

                            Text(L.paused)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.white.opacity(0.7))
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)
                        } else {
                            Text(startDate, style: .timer)
                                .font(.system(size: 32, weight: .light, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)
                                // Past ten hours h:mm:ss outgrows the 134pt content box.
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)

                            if let context = getTimerContext(for: activity, data: data) {
                                Text(formatTimerContext(context, for: activity))
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.8))
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                            } else {
                                Text(L.inProgress)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.8))
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                            }
                        }
                    } else {
                        Text(getSmallWidgetMainText(for: activity, data: data, now: entry.date))
                            .font(.system(
                                size: activity == .sleep ? 15 : 13,
                                weight: .semibold,
                                design: .rounded
                            ))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.8)
                            .lineLimit(1)

                        if activity != .sleep {
                            Text(getSmallWidgetSubtext(for: activity, data: data, now: entry.date))
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.white.opacity(0.8))
                                .multilineTextAlignment(.center)
                                .minimumScaleFactor(0.8)
                                .lineLimit(1)
                        }
                    }
                } else {
                    Text(activity.label)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                    Text(L.openAppToSync)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
            .padding(.horizontal, 12)

            Spacer()

            Spacer().frame(height: 8)

            if controls.canStop {
                HStack(spacing: 8) {
                    if controls.canPause {
                        Link(destination: isTimerPausedForActivity(activity, data: entry.widgetData)
                            ? activity.resumeTimerURL : activity.pauseTimerURL) {
                            let timerPaused = isTimerPausedForActivity(activity, data: entry.widgetData)
                            Image(systemName: timerPaused ? "play.fill" : "pause.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(timerPaused ? .white : activity.accentColor)
                                .frame(width: 36, height: 36)
                                .background(
                                    Circle()
                                        .fill(timerPaused ? activity.accentColor : .white)
                                )
                        }
                    }

                    Link(destination: routedStopURL(for: activity, data: entry.widgetData)) {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color(hex: "DC3545"))
                            .frame(width: 36, height: 36)
                            .background(
                                Circle()
                                    .fill(.white)
                            )
                    }
                }
            } else if activity == .sleep,
                      let data = entry.widgetData,
                      let prediction = getSmallWidgetSleepPrediction(data: data, now: entry.date) {
                Text(prediction.text)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(prediction.isOverdue ? Color(hex: "B4632F") : activity.accentColor)
                    .minimumScaleFactor(0.75)
                    .lineLimit(1)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(.white)
                    )
            } else if activity != .sleep, let data = entry.widgetData {
                if let lastTime = getLastActivityTime(for: activity, data: data) {
                    Text(formatTimeAgoLong(lastTime, now: entry.date))
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(activity.accentColor)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(.white)
                        )
                }
            }

            Spacer().frame(height: 14)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(isActive ? nil : activity.deepLinkURL)
        .containerBackground(activity.accentColor, for: .widget)
    }
}

// Maps a raw data token (side, sleep type, diaper type, feeding type, etc.)
// to its localized display string. Falls back to a capitalized version of
// the raw token for values that aren't part of the known vocabulary.
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

// Helper functions for small widget contextual text
func getSmallWidgetMainText(for activity: ActivityType, data: WidgetDataModel, now: Date) -> String {
    switch activity {
    case .feeding:
        // Show next breast side if breastfeeding
        if let lastType = data.activities.feeding.lastType,
           (lastType == "breast" || lastType == "nursing"),
           let lastSide = data.activities.feeding.lastSide {
            let nextSide = lastSide.lowercased() == "left" ? L.right : L.left
            return String(format: L.nextSideText, nextSide)
        } else if let lastType = data.activities.feeding.lastType {
            return lastType == "bottle" ? L.bottle : localizedToken(lastType)
        }
        return L.feeding

    case .sleep:
        if let awakeText = getAwakeTimeText(data: data, now: now) {
            return awakeText
        }
        let todayMins = data.activities.sleep.todayMinutes
        if todayMins > 0 {
            return String(format: L.durationToday, formatDuration(minutes: todayMins))
        }
        return L.sleep

    case .diaper:
        let counts = data.activities.diaper.todayCounts
        let total = counts.wet + counts.dirty + counts.mixed + counts.dry
        if total > 0 {
            return L.diapersTodayCount(total)
        }
        return L.diaper

    case .pumping:
        let volume = data.activities.pumping.todayVolumeMl
        if volume > 0 {
            return String(format: L.mlTodayCount, Int(volume))
        }
        return L.pumping

    case .tummyTime:
        let mins = data.activities.tummyTime.todayMinutes
        let goal = data.activities.tummyTime.goalMinutes
        if goal > 0 && mins > 0 {
            return String(format: L.minOfGoalMin, mins, goal)
        } else if mins > 0 {
            return String(format: L.minTodayCount, mins)
        }
        return L.tummyTime
    }
}

func getSmallWidgetSubtext(for activity: ActivityType, data: WidgetDataModel, now: Date) -> String {
    switch activity {
    case .feeding:
        let count = data.activities.feeding.todayCount
        return count > 0 ? L.feedsTodayCount(count) : L.noFeedsYet

    case .sleep:
        if let wakeWindowText = getWakeWindowCountdown(data: data, now: now) {
            return wakeWindowText
        }
        if let type = data.activities.sleep.sleepType {
            return type == "nap" ? L.lastNap : L.lastNight
        }
        return L.tapToLog

    case .diaper:
        let c = data.activities.diaper.todayCounts
        if c.wet + c.dirty + c.mixed > 0 {
            return "💧\(c.wet) 💩\(c.dirty)"
        }
        return L.tapToLog

    case .pumping:
        let sessions = data.activities.pumping.sessionCount
        return sessions > 0 ? L.sessionsCount(sessions) : L.tapToLog

    case .tummyTime:
        if let lastDuration = data.activities.tummyTime.lastDurationMinutes, lastDuration > 0 {
            return String(format: L.lastMinCount, lastDuration)
        }
        return L.tapToStart
    }
}

func formatTimerContext(_ context: String, for activity: ActivityType) -> String {
    switch activity {
    case .feeding:
        if context.lowercased() == "left" || context.lowercased() == "right" {
            return String(format: L.sideText, localizedToken(context))
        }
        return localizedToken(context)
    case .sleep:
        return context == "nap" ? L.napTime : L.nightSleep
    case .pumping:
        return localizedToken(context)
    default:
        return localizedToken(context)
    }
}

// Helper function kept for other widgets
func getLastActivityDetailText(for activity: ActivityType, data: WidgetDataModel) -> String {
    switch activity {
    case .feeding:
        if let lastType = data.activities.feeding.lastType {
            if lastType == "breast" || lastType == "nursing" {
                if let side = data.activities.feeding.lastSide {
                    return String(format: L.sideBreast, localizedToken(side))
                }
                return L.breastfeeding
            } else if lastType == "bottle" {
                return L.bottle
            } else if lastType == "solid" {
                return L.solidFood
            }
            return localizedToken(lastType)
        }
        return L.noFeedsYet
    case .sleep:
        if let type = data.activities.sleep.sleepType {
            return type == "nap" ? L.nap : L.nightSleep
        }
        return L.lastSleep
    case .diaper:
        if let type = data.activities.diaper.lastType {
            switch type {
            case "wet": return L.wetDiaper
            case "dirty": return L.dirtyDiaper
            case "mixed": return L.mixedDiaper
            case "dry": return L.dryDiaper
            default: return localizedToken(type)
            }
        }
        return L.lastDiaper
    case .pumping:
        let volume = data.activities.pumping.todayVolumeMl
        if volume > 0 {
            return String(format: L.mlTodayCount, Int(volume))
        }
        return L.lastPump
    case .tummyTime:
        let mins = data.activities.tummyTime.todayMinutes
        if mins > 0 {
            return String(format: L.minTodayCount, mins)
        }
        return L.lastTummyTime
    }
}

// MARK: - Medium Widget View (Huckleberry-style with colorful circles)

struct MediumWidgetView: View {
    let entry: BabyWidgetEntry
    @Environment(\.colorScheme) var colorScheme

    var activities: [ActivityType] {
        entry.selectedActivities.isEmpty ? [.sleep, .feeding, .diaper, .pumping] : entry.selectedActivities
    }

    var widgetBackground: Color {
        colorScheme == .dark ? Color(hex: WidgetColors.Background.dark) : Color(hex: WidgetColors.Background.light)
    }

    var isStale: Bool {
        isDataStale(data: entry.widgetData, now: entry.date)
    }

    var body: some View {
        VStack(spacing: 10) {
            // Top section: Baby name with stale indicator
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    if let babyName = entry.widgetData?.babyName {
                        Text(String(format: L.babyActivity, babyName))
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(.primary)
                    }
                    if isStale, let stalenessText = formatStalenessIndicator(data: entry.widgetData, now: entry.date) {
                        Text(stalenessText)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }

            Spacer()

            HStack(spacing: 16) {
                ForEach(activities.prefix(4), id: \.self) { activity in
                    let isRemoteLock = entry.widgetData?.isRemoteTimer(for: activity) ?? false
                    let controls = WidgetTimerControls(
                        surface: .medium,
                        timer: entry.widgetData?.getActiveTimer(for: activity),
                        isAuthenticated: entry.isUserAuthenticated
                    )
                    if controls.canStop {
                        Link(destination: routedStopURL(for: activity, data: entry.widgetData)) {
                            ColorfulCircleButton(
                                activity: activity,
                                data: entry.widgetData,
                                currentDate: entry.date,
                                isRemoteLock: isRemoteLock
                            )
                        }
                    } else {
                        Link(destination: activity.deepLinkURL) {
                            ColorfulCircleButton(activity: activity, data: entry.widgetData, currentDate: entry.date)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .containerBackground(widgetBackground, for: .widget)
    }
}

struct ColorfulCircleButton: View {
    let activity: ActivityType
    let data: WidgetDataModel?
    let currentDate: Date
    var isRemoteLock: Bool = false

    var isActive: Bool {
        data?.hasActiveTimer(for: activity) ?? false
    }

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(activity.accentColor)
                    .frame(width: 52, height: 52)
                    .shadow(color: activity.accentColor.opacity(0.3), radius: 4, x: 0, y: 2)

                if isActive {
                    Circle()
                        .strokeBorder(.white, lineWidth: 3)
                        .frame(width: 52, height: 52)
                }

                if isActive {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(.white)
                } else {
                    Text(activity.emoji)
                        .font(.system(size: 22))
                }
            }

            if isActive && isRemoteLock {
                if let context = getTimerContext(for: activity, data: data) {
                    Text(String(context.prefix(1)))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 16, height: 16)
                        .background(Circle().fill(activity.accentColor))
                } else {
                    Text("⏳")
                        .font(.system(size: 9))
                }
            } else if isActive, let startDate = getActiveTimerStartDate(for: activity, data: data) {
                if isTimerPausedForActivity(activity, data: data) {
                    Text("⏸\(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))")
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                } else {
                    Text(startDate, style: .timer)
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(.green)
                }
            } else if let lastTime = getLastActivityTime(for: activity, data: data) {
                Text(formatTimeAgoShort(lastTime, now: currentDate))
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.secondary)
            } else {
                Text("--")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

// MARK: - Large Widget View (Huckleberry-style)
// Vertical list with gradient bars and interactive + buttons

struct LargeWidgetView: View {
    let entry: BabyWidgetEntry
    @Environment(\.colorScheme) var colorScheme

    var activities: [ActivityType] {
        entry.selectedActivities.isEmpty ? [.sleep, .diaper, .feeding, .pumping] : entry.selectedActivities
    }

    var widgetBackground: Color {
        colorScheme == .dark ? Color(hex: WidgetColors.Background.dark) : Color(hex: WidgetColors.Background.light)
    }

    var isStale: Bool {
        isDataStale(data: entry.widgetData, now: entry.date)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header with stale indicator
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 1) {
                    if let babyName = entry.widgetData?.babyName {
                        Text(String(format: L.babyRecentActivity, babyName))
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundStyle(.primary)
                    } else {
                        Text(L.recentActivity)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundStyle(.primary)
                    }
                    if isStale, let stalenessText = formatStalenessIndicator(data: entry.widgetData, now: entry.date) {
                        Text(stalenessText)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)

            VStack(spacing: 8) {
                ForEach(activities.prefix(4), id: \.self) { activity in
                    ActivityRowView(
                        activity: activity,
                        data: entry.widgetData,
                        currentDate: entry.date,
                        isRemoteLock: entry.widgetData?.isRemoteTimer(for: activity) ?? false,
                        isUserAuthenticated: entry.isUserAuthenticated
                    )
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
        .containerBackground(widgetBackground, for: .widget)
    }
}

// MARK: - Activity Row (Huckleberry-style gradient bar)

struct ActivityRowView: View {
    let activity: ActivityType
    let data: WidgetDataModel?
    let currentDate: Date
    var isRemoteLock: Bool = false
    var isUserAuthenticated: Bool = true

    var isActive: Bool {
        data?.hasActiveTimer(for: activity) ?? false
    }

    var controls: WidgetTimerControls {
        WidgetTimerControls(
            surface: .large,
            timer: data?.getActiveTimer(for: activity),
            isAuthenticated: isUserAuthenticated
        )
    }

    @ViewBuilder
    var rowContent: some View {
        HStack(spacing: 10) {
            Text(activity.emoji)
                .font(.system(size: 22))
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 1) {
                if let data = data {
                    if isActive && isRemoteLock {
                        if let context = getTimerContext(for: activity, data: data) {
                            let sentence = activity.runningSentence(for: context)
                            Text(isTimerPausedForActivity(activity, data: data)
                                 ? String(format: L.timerRunningPausedSuffix, sentence)
                                 : sentence)
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                        } else {
                            Text(L.inUse)
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                        }
                        if let startDate = getActiveTimerStartDate(for: activity, data: data) {
                            if isTimerPausedForActivity(activity, data: data) {
                                Text("⏸ \(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))")
                                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundStyle(.white.opacity(0.7))
                            } else {
                                Text(startDate, style: .timer)
                                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                        }
                    } else if isActive, let startDate = getActiveTimerStartDate(for: activity, data: data) {
                        if isTimerPausedForActivity(activity, data: data) {
                            HStack(spacing: 4) {
                                Text("⏸ \(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))")
                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                    .monospacedDigit()
                                    .foregroundStyle(.white)
                            }
                            Text(L.paused)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.white.opacity(0.8))
                        } else {
                            HStack(spacing: 4) {
                                Text(startDate, style: .timer)
                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                    .monospacedDigit()
                                    .foregroundStyle(.white)
                                Circle()
                                    .fill(Color.white)
                                    .frame(width: 6, height: 6)
                            }
                            Text(L.inProgress)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.white.opacity(0.8))
                        }
                    } else if let lastTime = getLastActivityTime(for: activity, data: data) {
                        Text(formatTimeAgoLong(lastTime, now: currentDate))
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                        Text(getRowDetail(for: activity, data: data))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.8))
                            .lineLimit(1)
                    } else {
                        Text(L.noDataYet)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.8))
                        Text(L.tapToLog)
                            .font(.system(size: 11))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                } else {
                    Text("--")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.8))
                }
            }

            Spacer()

            if controls.canStop {
                HStack(spacing: 6) {
                    if controls.canPause {
                        Link(destination: isTimerPausedForActivity(activity, data: data)
                            ? activity.resumeTimerURL : activity.pauseTimerURL) {
                            let timerPaused = isTimerPausedForActivity(activity, data: data)
                            ZStack {
                                Circle()
                                    .fill(timerPaused ? activity.accentColor : Color(hex: WidgetColors.Button.light))
                                    .frame(width: 30, height: 30)
                                    .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
                                Image(systemName: timerPaused ? "play.fill" : "pause.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(timerPaused ? .white : activity.accentColor)
                            }
                        }
                    }

                    Link(destination: routedStopURL(for: activity, data: data)) {
                        ZStack {
                            Circle()
                                .fill(Color(hex: WidgetColors.Button.light))
                                .frame(width: 30, height: 30)
                                .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
                            Image(systemName: "stop.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Color.red)
                        }
                    }
                }
            } else {
                ZStack {
                    Circle()
                        .fill(Color(hex: WidgetColors.Button.light))
                        .frame(width: 34, height: 34)
                        .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 2)
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(activity.accentColor)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(activity.accentColor.opacity(isRemoteLock && isActive ? 0.8 : 1.0))
        )
    }

    var body: some View {
        if isRemoteLock && isActive {
            rowContent
        } else if isActive {
            rowContent
        } else {
            Link(destination: activity.deepLinkURL) {
                rowContent
            }
        }
    }

    func getRowDetail(for activity: ActivityType, data: WidgetDataModel) -> String {
        switch activity {
        case .feeding:
            if let lastType = data.activities.feeding.lastType {
                if lastType == "breast" || lastType == "nursing" {
                    if let side = data.activities.feeding.lastSide {
                        let nextSide = side.lowercased() == "left" ? L.right : L.left
                        return String(format: L.nextSideText, nextSide)
                    }
                    return L.breastfeeding
                } else if lastType == "bottle" {
                    return L.bottle
                } else if lastType == "solid" {
                    return L.solidFood
                }
            }
            return String(format: L.countToday, data.activities.feeding.todayCount)

        case .sleep:
            if let awakeText = getAwakeTimeText(data: data, now: currentDate) {
                return awakeText
            }
            let mins = data.activities.sleep.todayMinutes
            if mins > 0 {
                return String(format: L.durationToday, formatDuration(minutes: mins))
            }
            if let lastDuration = data.activities.sleep.lastDurationMinutes, lastDuration > 0 {
                return formatDuration(minutes: lastDuration)
            }
            return L.noSleepYet

        case .diaper:
            let c = data.activities.diaper.todayCounts
            return "\(c.wet + c.mixed)💧 \(c.dirty + c.mixed)💩"

        case .pumping:
            if data.activities.pumping.todayVolumeMl > 0 {
                return String(format: L.mlTodayCountCompact, Int(data.activities.pumping.todayVolumeMl))
            }
            return L.sessionsCount(data.activities.pumping.sessionCount)

        case .tummyTime:
            let mins = data.activities.tummyTime.todayMinutes
            let goal = data.activities.tummyTime.goalMinutes
            if goal > 0 {
                return String(format: L.minOfGoalCompact, mins, goal)
            }
            return String(format: L.minTodayCompact, mins)
        }
    }
}

func formatRelativeTime(_ date: Date, now: Date, long: Bool, includesAgo: Bool) -> String {
    let totalMinutes = max(0, Int(now.timeIntervalSince(date)) / 60)
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60
    let days = hours / 24
    let value: String

    if days >= 365 {
        let years = days / 365
        value = long ? L.yearsCount(years) : String(format: L.ageYearsShort, years)
    } else if days >= 60 {
        let months = min(11, days / 30)
        value = long ? L.monthsCount(months) : String(format: L.ageMonthsShort, months)
    } else if days >= 1 {
        value = long ? L.daysCount(days) : String(format: L.ageDaysShort, days)
    } else if hours > 0 {
        value = long ? String(format: L.durationHoursMinutesLong, hours, minutes) : String(format: L.durationHoursMinutesShort, hours, minutes)
    } else {
        value = long ? String(format: L.durationMinutesLong, totalMinutes) : String(format: L.durationMinutesShort, totalMinutes)
    }

    return includesAgo ? String(format: L.durationAgo, value) : value
}

func formatTimeAgoLong(_ date: Date, now: Date = Date()) -> String {
    formatRelativeTime(date, now: now, long: true, includesAgo: true)
}

func formatWidgetClockTime(
    _ date: Date,
    timeFormat: String?,
    timezone: String?
) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(
        identifier: timeFormat == "24h" ? "en_GB" : "en_US_POSIX"
    )
    formatter.timeZone = timezone.flatMap(TimeZone.init(identifier:)) ?? .current
    formatter.dateFormat = timeFormat == "24h" ? "H:mm" : "h:mm a"
    return formatter.string(from: date)
}

// SummaryCard removed - replaced by ActivityRowView for Huckleberry-style layout

func formatDuration(minutes: Int) -> String {
    let hours = minutes / 60
    let mins = minutes % 60
    if hours > 0 {
        return String(format: L.durationHoursMinutesShort, hours, mins)
    }
    return String(format: L.durationMinutesShort, mins)
}

func getWakeWindowCountdown(data: WidgetDataModel, now: Date) -> String? {
    let newbornNapOptIn = UserDefaults(suiteName: appGroupId)?.string(forKey: "widgetNewbornNapOptIn.\(data.babyId)") == "true"
    guard data.canPresentWakeWindow(newbornNapOptIn: newbornNapOptIn),
          data.canPresentSleepDerivedTiming(pendingSleepStopAt: pendingSleepStopAt(for: data.babyId)),
          let windowMinutes = data.activities.sleep.wakeWindowMinutes,
          let lastEndedStr = data.activities.sleep.lastSleepEndedAt,
          !data.activities.sleep.isActive else {
        return nil
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let lastEnded = formatter.date(from: lastEndedStr) else {
        let basicFormatter = ISO8601DateFormatter()
        guard let lastEndedBasic = basicFormatter.date(from: lastEndedStr) else { return nil }
        return computeWakeWindowText(lastEnded: lastEndedBasic, windowMinutes: windowMinutes, label: data.activities.sleep.wakeWindowSlotLabel, now: now)
    }
    return computeWakeWindowText(lastEnded: lastEnded, windowMinutes: windowMinutes, label: data.activities.sleep.wakeWindowSlotLabel, now: now)
}

struct WidgetSleepPredictionText {
    let text: String
    let isOverdue: Bool
}

func getSmallWidgetSleepPrediction(
    data: WidgetDataModel,
    now: Date
) -> WidgetSleepPredictionText? {
    guard !data.activities.sleep.isActive,
          data.canPresentSleepDerivedTiming(
              pendingSleepStopAt: pendingSleepStopAt(for: data.babyId)
          ),
          let prediction = data.sleepPrediction,
          let display = widgetSleepPredictionDisplay(
              prediction,
              now: now,
              lastSleepEndedAt: data.activities.sleep.lastSleepEndedAt
                  .flatMap(parseWidgetSnapshotTimestamp)
          ) else { return nil }

    switch display {
    case .nighttime:
        return WidgetSleepPredictionText(text: L.nighttime, isOverdue: false)
    case let .upcoming(predictedAt, isBedtime):
        return WidgetSleepPredictionText(
            text: predictionLabel(predictedAt, isBedtime: isBedtime, data: data),
            isOverdue: false
        )
    case let .overdue(predictedAt, isBedtime):
        // A late prediction keeps its clock time; only the tint marks it as past due.
        return WidgetSleepPredictionText(
            text: predictionLabel(predictedAt, isBedtime: isBedtime, data: data),
            isOverdue: true
        )
    }
}

private func predictionLabel(
    _ predictedAt: Date,
    isBedtime: Bool,
    data: WidgetDataModel
) -> String {
    let clockTime = formatWidgetClockTime(
        predictedAt,
        timeFormat: data.timeFormat,
        timezone: data.timezone
    )
    return String(format: isBedtime ? L.bedtimeAt : L.nextNapAt, clockTime)
}

func computeWakeWindowText(lastEnded: Date, windowMinutes: Int, label: String?, now: Date) -> String? {
    let awakeSeconds = now.timeIntervalSince(lastEnded)
    let windowSeconds = Double(windowMinutes) * 60.0
    let remainingSeconds = windowSeconds - awakeSeconds
    let remainingMinutes = Int(remainingSeconds / 60.0)

    let isBedtime = label == "bedtime"
    let prefix = isBedtime ? L.bedtime : L.nap

    if remainingMinutes <= 0 {
        return String(format: L.prefixTimeExclaim, prefix)
    } else if remainingMinutes >= 60 {
        let h = remainingMinutes / 60
        let m = remainingMinutes % 60
        return m > 0 ? String(format: L.prefixInHoursMinutes, prefix, h, m) : String(format: L.prefixInHours, prefix, h)
    } else {
        return String(format: L.prefixInMinutes, prefix, remainingMinutes)
    }
}

func getAwakeTimeText(data: WidgetDataModel, now: Date = Date()) -> String? {
    guard data.canPresentSleepDerivedTiming(pendingSleepStopAt: pendingSleepStopAt(for: data.babyId)),
          let lastEndedStr = data.activities.sleep.lastSleepEndedAt,
          !data.activities.sleep.isActive else {
        return nil
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    var lastEnded = formatter.date(from: lastEndedStr)
    if lastEnded == nil {
        let basicFormatter = ISO8601DateFormatter()
        lastEnded = basicFormatter.date(from: lastEndedStr)
    }
    guard let lastEnded else { return nil }

    let awakeSeconds = now.timeIntervalSince(lastEnded)
    let awakeMinutes = Int(awakeSeconds / 60)
    if awakeMinutes < 0 { return nil }

    let hours = awakeMinutes / 60
    let mins = awakeMinutes % 60
    if hours > 0 {
        return String(format: L.awakeHoursMinutes, hours, mins)
    }
    return String(format: L.awakeMinutesOnly, awakeMinutes)
}

func formatRelative(_ date: Date, now: Date = Date()) -> String {
    formatRelativeTime(date, now: now, long: false, includesAgo: true)
}

func formatTimeAgo(_ date: Date, now: Date = Date()) -> String {
    formatRelativeTime(date, now: now, long: false, includesAgo: true)
}

func formatTimeAgoShort(_ date: Date, now: Date = Date()) -> String {
    formatRelativeTime(date, now: now, long: false, includesAgo: false)
}

// MARK: - Lock Screen Widgets
// FIXED: Simpler implementation that works better on lock screen

struct LockScreenCircularView: View {
    let entry: BabyWidgetEntry

    var activity: ActivityType { entry.selectedActivity }

    var isRemote: Bool {
        entry.widgetData?.isRemoteTimer(for: activity) ?? false
    }

    var controls: WidgetTimerControls {
        WidgetTimerControls(
            surface: .lockScreenCircular,
            timer: entry.widgetData?.getActiveTimer(for: activity),
            isAuthenticated: entry.isUserAuthenticated
        )
    }

    var body: some View {
        ZStack {
            if let data = entry.widgetData,
               data.hasActiveTimer(for: activity) {
                if isRemote {
                    VStack(spacing: 2) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 9))
                        Image(systemName: "stop.fill")
                            .font(.system(size: 12, weight: .semibold))
                    }
                } else if let startDate = getActiveTimerStartDate(for: activity, data: data) {
                    if isTimerPausedForActivity(activity, data: data) {
                        VStack(spacing: 2) {
                            Text(activity.emoji)
                                .font(.system(size: 14))
                            Text("⏸\(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))")
                                .font(.system(size: 10, weight: .medium, design: .monospaced))
                                .monospacedDigit()
                                .minimumScaleFactor(0.6)
                        }
                    } else {
                        VStack(spacing: 2) {
                            Text(activity.emoji)
                                .font(.system(size: 14))
                            Text(startDate, style: .timer)
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .monospacedDigit()
                                .minimumScaleFactor(0.7)
                        }
                    }
                }
            } else if let lastTime = getLastActivityTime(for: activity, data: entry.widgetData) {
                VStack(spacing: 2) {
                    Text(activity.emoji)
                        .font(.system(size: 14))
                    Text(formatTimeAgoShort(lastTime, now: entry.date))
                        .font(.system(size: 10, weight: .medium))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
            } else {
                VStack(spacing: 2) {
                    Text(activity.emoji)
                        .font(.system(size: 16))
                    Text("--")
                        .font(.system(size: 12, weight: .medium))
                }
            }
        }
        .widgetURL(controls.stopsOnTap
            ? routedStopURL(for: activity, data: entry.widgetData)
            : activity.deepLinkURL)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct LockScreenRectangularView: View {
    let entry: BabyWidgetEntry

    var activities: [ActivityType] {
        entry.selectedActivities.isEmpty ? [.feeding, .sleep] : Array(entry.selectedActivities.prefix(2))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(activities, id: \.self) { activity in
                HStack(spacing: 6) {
                    Text(activity.emoji)
                        .font(.system(size: 12))

                    Text(activity.label)
                        .font(.system(size: 11, weight: .medium))

                    Spacer()

                    if let data = entry.widgetData,
                       data.hasActiveTimer(for: activity) {
                        let controls = WidgetTimerControls(
                            surface: .lockScreenRectangular,
                            timer: data.getActiveTimer(for: activity),
                            isAuthenticated: entry.isUserAuthenticated
                        )
                        Link(destination: controls.stopsOnTap
                            ? routedStopURL(for: activity, data: data)
                            : activity.deepLinkURL) {
                            HStack(spacing: 2) {
                                if data.isRemoteTimer(for: activity) {
                                    Image(systemName: "person.fill")
                                        .font(.system(size: 8))
                                    Text(L.inUse)
                                        .font(.system(size: 10, weight: .medium))
                                        .lineLimit(1)
                                } else if isTimerPausedForActivity(activity, data: data) {
                                    Text("⏸ \(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))")
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .monospacedDigit()
                                } else if let startDate = getActiveTimerStartDate(for: activity, data: data) {
                                    Text(startDate, style: .timer)
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .monospacedDigit()
                                    Image(systemName: "circle.fill")
                                        .font(.system(size: 4))
                                        .foregroundStyle(.green)
                                }
                                if controls.stopsOnTap {
                                    Image(systemName: "stop.fill")
                                        .font(.system(size: 9, weight: .bold))
                                }
                            }
                        }
                    } else if let lastTime = getLastActivityTime(for: activity, data: entry.widgetData) {
                        Text(formatTimeAgoShort(lastTime, now: entry.date))
                            .font(.system(size: 11))
                    } else {
                        Text("--")
                            .font(.system(size: 11))
                    }
                }
            }
        }
        .widgetURL(activities.first?.deepLinkURL ?? URL(string: "sofibaby://")!)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Widget Configurations

struct SmallBabyWidget: Widget {
    let kind: String = "SmallBabyWidget"

    var body: some WidgetConfiguration {
        let config = AppIntentConfiguration(
            kind: kind,
            intent: SelectActivityIntent.self,
            provider: SingleActivityProvider()
        ) { entry in
            SmallWidgetView(entry: entry)
        }
        .configurationDisplayName("Activity Status")
        .description("Track a single activity")
        .supportedFamilies([.systemSmall])

        if #available(iOS 26.0, *) {
            return config.pushHandler(SofiBabyWidgetPushHandler.self)
        } else {
            return config
        }
    }
}

struct MediumBabyWidget: Widget {
    let kind: String = "MediumBabyWidget"

    var body: some WidgetConfiguration {
        let config = AppIntentConfiguration(
            kind: kind,
            intent: SelectFourActivitiesIntent.self,
            provider: FourActivityProvider()
        ) { entry in
            MediumWidgetView(entry: entry)
        }
        .configurationDisplayName("Quick Log")
        .description("Quick access to activities")
        .supportedFamilies([.systemMedium])

        if #available(iOS 26.0, *) {
            return config.pushHandler(SofiBabyWidgetPushHandler.self)
        } else {
            return config
        }
    }
}

struct LargeBabyWidget: Widget {
    let kind: String = "LargeBabyWidget"

    var body: some WidgetConfiguration {
        let config = AppIntentConfiguration(
            kind: kind,
            intent: SelectFourActivitiesIntent.self,
            provider: FourActivityProvider()
        ) { entry in
            LargeWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Summary")
        .description("Overview of your baby's day")
        .supportedFamilies([.systemLarge])

        if #available(iOS 26.0, *) {
            return config.pushHandler(SofiBabyWidgetPushHandler.self)
        } else {
            return config
        }
    }
}

struct LockScreenCircularWidget: Widget {
    let kind: String = "LockScreenCircularWidget"

    var body: some WidgetConfiguration {
        let config = AppIntentConfiguration(
            kind: kind,
            intent: SelectActivityIntent.self,
            provider: SingleActivityProvider()
        ) { entry in
            LockScreenCircularView(entry: entry)
        }
        .configurationDisplayName("Activity Timer")
        .description("Time since last activity")
        .supportedFamilies([.accessoryCircular])

        if #available(iOS 26.0, *) {
            return config.pushHandler(SofiBabyWidgetPushHandler.self)
        } else {
            return config
        }
    }
}

struct LockScreenRectangularWidget: Widget {
    let kind: String = "LockScreenRectangularWidget"

    var body: some WidgetConfiguration {
        let config = AppIntentConfiguration(
            kind: kind,
            intent: SelectTwoActivitiesIntent.self,
            provider: TwoActivityProvider()
        ) { entry in
            LockScreenRectangularView(entry: entry)
        }
        .configurationDisplayName("Activity Summary")
        .description("Overview of two activities")
        .supportedFamilies([.accessoryRectangular])

        if #available(iOS 26.0, *) {
            return config.pushHandler(SofiBabyWidgetPushHandler.self)
        } else {
            return config
        }
    }
}

// MARK: - WidgetKit Push Handler (iOS 26+)

@available(iOS 26.0, *)
struct SofiBabyWidgetPushHandler: WidgetPushHandler {
    init() {}

    func pushTokenDidChange(_ pushInfo: WidgetPushInfo, widgets: [WidgetInfo]) {
        let tokenString = pushInfo.token.map { String(format: "%02x", $0) }.joined()
        if let userDefaults = UserDefaults(suiteName: appGroupId) {
            userDefaults.set(tokenString, forKey: "widgetPushToken")
        }
    }
}

// MARK: - Widget Bundle (includes Live Activity)

@main
struct SofiBabyWidgetBundle: WidgetBundle {
    var body: some Widget {
        SmallBabyWidget()
        MediumBabyWidget()
        LargeBabyWidget()
        LockScreenCircularWidget()
        LockScreenRectangularWidget()
        TimerLiveActivity()
    }
}
