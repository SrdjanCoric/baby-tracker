import WidgetKit
import SwiftUI
import AppIntents

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
        // Use query param so Expo Router handles it correctly
        URL(string: "sofibaby://\(self.rawValue)?action=start")!
    }
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
}

struct WidgetDataModel: Codable {
    var babyId: String
    var babyName: String
    var activities: WidgetActivityData
    var activeTimer: ActiveTimerData?
    var activeTimers: [ActiveTimerData]?
    var updatedAt: String

    func getActiveTimer(for type: ActivityType) -> ActiveTimerData? {
        // Try array first, fall back to singular activeTimer
        if let timers = activeTimers, !timers.isEmpty {
            return timers.first { $0.type == type.rawValue }
        }
        // Fallback to singular activeTimer for backward compatibility
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
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            return .result()
        }

        let dbType = activity == .tummyTime ? "tummy_time" : activity.rawValue

        let supabaseUrl = userDefaults.string(forKey: "supabaseUrl")
        let anonKey = userDefaults.string(forKey: "supabaseAnonKey")
        let accessToken = userDefaults.string(forKey: "supabaseAccessToken")
        let babyId = userDefaults.string(forKey: "selectedBabyId")
        let userId = userDefaults.string(forKey: "userId")

        if let supabaseUrl, let anonKey, let accessToken, let babyId, let userId {
            let urlString = "\(supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&activity_type=eq.\(dbType)&started_by=eq.\(userId)"
            if let url = URL(string: urlString) {
                var request = URLRequest(url: url)
                request.httpMethod = "DELETE"
                request.setValue(anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
                request.timeoutInterval = 10
                _ = try? await URLSession.shared.data(for: request)
            }
        }

        let stop: [String: String] = [
            "activityType": dbType,
            "stoppedAt": ISO8601DateFormatter().string(from: Date())
        ]
        if let json = try? JSONSerialization.data(withJSONObject: stop),
           let jsonString = String(data: json, encoding: .utf8) {
            userDefaults.set(jsonString, forKey: "pendingWidgetStop")
        }

        if let pushToken = userDefaults.string(forKey: "liveActivityPushToken"),
           !pushToken.isEmpty,
           let supabaseUrl = supabaseUrl {
            let edgeUrl = "\(supabaseUrl)/functions/v1/end-live-activity"
            if let url = URL(string: edgeUrl) {
                var laRequest = URLRequest(url: url)
                laRequest.httpMethod = "POST"
                laRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                laRequest.setValue(anonKey ?? "", forHTTPHeaderField: "apikey")
                laRequest.setValue("Bearer \(anonKey ?? "")", forHTTPHeaderField: "Authorization")
                laRequest.timeoutInterval = 10
                laRequest.httpBody = try? JSONSerialization.data(withJSONObject: ["pushToken": pushToken])
                _ = try? await URLSession.shared.data(for: laRequest)
            }
            userDefaults.removeObject(forKey: "liveActivityPushToken")
        }

        if let dataString = userDefaults.string(forKey: "widgetData"),
           let data = dataString.data(using: .utf8),
           var widgetData = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            widgetData["activeTimer"] = nil
            if var timers = widgetData["activeTimers"] as? [[String: Any]] {
                let widgetType = activity.rawValue
                timers.removeAll { ($0["type"] as? String) == widgetType }
                widgetData["activeTimers"] = timers
            }
            if let updatedData = try? JSONSerialization.data(withJSONObject: widgetData),
               let updatedString = String(data: updatedData, encoding: .utf8) {
                userDefaults.set(updatedString, forKey: "widgetData")
            }
        }

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
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
}

// MARK: - Shared Data Loading

func loadWidgetData() -> WidgetDataModel? {
    guard let userDefaults = UserDefaults(suiteName: appGroupId),
          let dataString = userDefaults.string(forKey: "widgetData"),
          let data = dataString.data(using: .utf8) else {
        return nil
    }
    return try? JSONDecoder().decode(WidgetDataModel.self, from: data)
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
        return "Synced \(days)d ago"
    } else {
        return "Synced \(hours)h ago"
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
        BabyWidgetEntry(date: Date(), widgetData: createSampleWidgetData(), selectedActivity: .feeding, selectedActivities: [])
    }

    func snapshot(for configuration: SelectActivityIntent, in context: Context) async -> BabyWidgetEntry {
        let data = context.isPreview ? createSampleWidgetData() : loadWidgetData()
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: configuration.activity, selectedActivities: [])
    }

    func timeline(for configuration: SelectActivityIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        let cached = loadWidgetData()
        let networkTimers = await fetchActiveTimersFromNetwork()
        let data = mergeNetworkTimers(cached: cached, networkTimers: networkTimers) ?? cached

        var entries: [BabyWidgetEntry] = []
        let now = Date()
        for minuteOffset in 0..<30 {
            let entryDate = now.addingTimeInterval(Double(minuteOffset) * 60)
            let entry = BabyWidgetEntry(date: entryDate, widgetData: data, selectedActivity: configuration.activity, selectedActivities: [])
            entries.append(entry)
        }

        let nextUpdate = now.addingTimeInterval(30 * 60)
        return Timeline(entries: entries, policy: .after(nextUpdate))
    }
}

struct FourActivityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BabyWidgetEntry {
        BabyWidgetEntry(date: Date(), widgetData: createSampleWidgetData(), selectedActivity: .feeding, selectedActivities: [.feeding, .sleep, .diaper, .tummyTime])
    }

    func snapshot(for configuration: SelectFourActivitiesIntent, in context: Context) async -> BabyWidgetEntry {
        let data = context.isPreview ? createSampleWidgetData() : loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2, configuration.activity3, configuration.activity4]
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: .feeding, selectedActivities: activities)
    }

    func timeline(for configuration: SelectFourActivitiesIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        let cached = loadWidgetData()
        let networkTimers = await fetchActiveTimersFromNetwork()
        let data = mergeNetworkTimers(cached: cached, networkTimers: networkTimers) ?? cached
        let activities = [configuration.activity1, configuration.activity2, configuration.activity3, configuration.activity4]

        var entries: [BabyWidgetEntry] = []
        let now = Date()
        for minuteOffset in 0..<30 {
            let entryDate = now.addingTimeInterval(Double(minuteOffset) * 60)
            let entry = BabyWidgetEntry(date: entryDate, widgetData: data, selectedActivity: .feeding, selectedActivities: activities)
            entries.append(entry)
        }

        let nextUpdate = now.addingTimeInterval(30 * 60)
        return Timeline(entries: entries, policy: .after(nextUpdate))
    }
}

struct TwoActivityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BabyWidgetEntry {
        BabyWidgetEntry(date: Date(), widgetData: createSampleWidgetData(), selectedActivity: .feeding, selectedActivities: [.feeding, .sleep])
    }

    func snapshot(for configuration: SelectTwoActivitiesIntent, in context: Context) async -> BabyWidgetEntry {
        let data = context.isPreview ? createSampleWidgetData() : loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2]
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: .feeding, selectedActivities: activities)
    }

    func timeline(for configuration: SelectTwoActivitiesIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        let cached = loadWidgetData()
        let networkTimers = await fetchActiveTimersFromNetwork()
        let data = mergeNetworkTimers(cached: cached, networkTimers: networkTimers) ?? cached
        let activities = [configuration.activity1, configuration.activity2]

        var entries: [BabyWidgetEntry] = []
        let now = Date()
        for minuteOffset in 0..<30 {
            let entryDate = now.addingTimeInterval(Double(minuteOffset) * 60)
            let entry = BabyWidgetEntry(date: entryDate, widgetData: data, selectedActivity: .feeding, selectedActivities: activities)
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
                        if isRemote {
                            if let context = getTimerContext(for: activity, data: data) {
                                Text(context)
                                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                                    .foregroundStyle(.white.opacity(0.6))
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                            }

                            Text(startDate, style: .timer)
                                .font(.system(size: 32, weight: .light, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(.white.opacity(0.5))
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)
                        } else {
                            Text(startDate, style: .timer)
                                .font(.system(size: 32, weight: .light, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .multilineTextAlignment(.center)

                            if let context = getTimerContext(for: activity, data: data) {
                                Text(formatTimerContext(context, for: activity))
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.8))
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                            } else {
                                Text("In progress")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.8))
                                    .frame(maxWidth: .infinity)
                                    .multilineTextAlignment(.center)
                            }
                        }
                    } else {
                        Text(getSmallWidgetMainText(for: activity, data: data))
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.8)
                            .lineLimit(1)

                        Text(getSmallWidgetSubtext(for: activity, data: data))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.8))
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.8)
                            .lineLimit(1)
                    }
                } else {
                    Text(activity.label)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("Open app to sync")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
            .padding(.horizontal, 12)

            Spacer()

            Spacer().frame(height: 8)

            if isActive && isRemote {
                HStack(spacing: 6) {
                    Text("⏳")
                        .font(.system(size: 14))
                    Text("In use")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                }
                .foregroundStyle(.white.opacity(0.9))
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(.white.opacity(0.25))
                )
            } else if isActive {
                Button(intent: StopActivityIntent(activity: activity)) {
                    HStack(spacing: 8) {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Stop")
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                    }
                    .foregroundStyle(Color(hex: "DC3545"))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    .background(
                        Capsule()
                            .fill(.white)
                    )
                }
                .buttonStyle(.plain)
            } else if let data = entry.widgetData {
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

// Helper functions for small widget contextual text
func getSmallWidgetMainText(for activity: ActivityType, data: WidgetDataModel) -> String {
    switch activity {
    case .feeding:
        // Show next breast side if breastfeeding
        if let lastType = data.activities.feeding.lastType,
           (lastType == "breast" || lastType == "nursing"),
           let lastSide = data.activities.feeding.lastSide {
            let nextSide = lastSide.lowercased() == "left" ? "Right" : "Left"
            return "Next: \(nextSide) side"
        } else if let lastType = data.activities.feeding.lastType {
            return lastType == "bottle" ? "Bottle" : lastType.capitalized
        }
        return "Feeding"

    case .sleep:
        let todayMins = data.activities.sleep.todayMinutes
        let goal = data.activities.sleep.goalMinutes
        if goal > 0 && todayMins > 0 {
            return "\(formatDuration(minutes: todayMins)) of \(formatDuration(minutes: goal))"
        } else if todayMins > 0 {
            return "\(formatDuration(minutes: todayMins)) today"
        }
        return "Sleep"

    case .diaper:
        let counts = data.activities.diaper.todayCounts
        let total = counts.wet + counts.dirty + counts.mixed + counts.dry
        if total > 0 {
            return "\(total) diapers today"
        }
        return "Diaper"

    case .pumping:
        let volume = data.activities.pumping.todayVolumeMl
        if volume > 0 {
            return "\(Int(volume)) ml today"
        }
        return "Pumping"

    case .tummyTime:
        let mins = data.activities.tummyTime.todayMinutes
        let goal = data.activities.tummyTime.goalMinutes
        if goal > 0 && mins > 0 {
            return "\(mins) of \(goal) min"
        } else if mins > 0 {
            return "\(mins) min today"
        }
        return "Tummy Time"
    }
}

func getSmallWidgetSubtext(for activity: ActivityType, data: WidgetDataModel) -> String {
    switch activity {
    case .feeding:
        let count = data.activities.feeding.todayCount
        return count > 0 ? "\(count) feeds today" : "No feeds yet"

    case .sleep:
        if let type = data.activities.sleep.sleepType {
            return type == "nap" ? "Last: Nap" : "Last: Night"
        }
        return "Tap to log"

    case .diaper:
        let c = data.activities.diaper.todayCounts
        if c.wet + c.dirty + c.mixed > 0 {
            return "💧\(c.wet) 💩\(c.dirty)"
        }
        return "Tap to log"

    case .pumping:
        let sessions = data.activities.pumping.sessionCount
        return sessions > 0 ? "\(sessions) sessions" : "Tap to log"

    case .tummyTime:
        if let lastDuration = data.activities.tummyTime.lastDurationMinutes, lastDuration > 0 {
            return "Last: \(lastDuration) min"
        }
        return "Tap to start"
    }
}

func formatTimerContext(_ context: String, for activity: ActivityType) -> String {
    switch activity {
    case .feeding:
        if context.lowercased() == "left" || context.lowercased() == "right" {
            return "\(context.capitalized) side"
        }
        return context.capitalized
    case .sleep:
        return context == "nap" ? "Nap time" : "Night sleep"
    case .pumping:
        return context.capitalized
    default:
        return context.capitalized
    }
}

// Helper function kept for other widgets
func getLastActivityDetailText(for activity: ActivityType, data: WidgetDataModel) -> String {
    switch activity {
    case .feeding:
        if let lastType = data.activities.feeding.lastType {
            if lastType == "breast" || lastType == "nursing" {
                if let side = data.activities.feeding.lastSide {
                    return "\(side.capitalized) breast"
                }
                return "Breastfeeding"
            } else if lastType == "bottle" {
                return "Bottle"
            } else if lastType == "solid" {
                return "Solid food"
            }
            return lastType.capitalized
        }
        return "No feeds yet"
    case .sleep:
        if let type = data.activities.sleep.sleepType {
            return type == "nap" ? "Nap" : "Night sleep"
        }
        return "Last sleep"
    case .diaper:
        if let type = data.activities.diaper.lastType {
            switch type {
            case "wet": return "Wet diaper"
            case "dirty": return "Dirty diaper"
            case "mixed": return "Mixed diaper"
            case "dry": return "Dry diaper"
            default: return type.capitalized
            }
        }
        return "Last diaper"
    case .pumping:
        let volume = data.activities.pumping.todayVolumeMl
        if volume > 0 {
            return "\(Int(volume)) ml today"
        }
        return "Last pump"
    case .tummyTime:
        let mins = data.activities.tummyTime.todayMinutes
        if mins > 0 {
            return "\(mins) min today"
        }
        return "Last tummy time"
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
                        Text("\(babyName)'s activity")
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
                    let isActiveOwn = (entry.widgetData?.hasActiveTimer(for: activity) ?? false) && !isRemoteLock
                    if isRemoteLock {
                        ColorfulCircleButton(activity: activity, data: entry.widgetData, currentDate: entry.date, isRemoteLock: true)
                    } else if isActiveOwn {
                        Button(intent: StopActivityIntent(activity: activity)) {
                            ColorfulCircleButton(activity: activity, data: entry.widgetData, currentDate: entry.date)
                        }
                        .buttonStyle(.plain)
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
                    .opacity(isActive && isRemoteLock ? 0.6 : 1.0)
                    .shadow(color: activity.accentColor.opacity(0.3), radius: 4, x: 0, y: 2)

                if isActive {
                    Circle()
                        .strokeBorder(.white, lineWidth: 3)
                        .frame(width: 52, height: 52)
                }

                if isActive && isRemoteLock {
                    Text(activity.emoji)
                        .font(.system(size: 22))
                } else if isActive {
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
                Text(startDate, style: .timer)
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.green)
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
                        Text("\(babyName)'s recent activity")
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundStyle(.primary)
                    } else {
                        Text("Recent activity")
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
                        isRemoteLock: entry.widgetData?.isRemoteTimer(for: activity) ?? false
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

    var isActive: Bool {
        data?.hasActiveTimer(for: activity) ?? false
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
                            Text("\(context) is \(activity.label.lowercased())ing")
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                        } else {
                            Text("In use")
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                        }
                        if let startDate = getActiveTimerStartDate(for: activity, data: data) {
                            Text(startDate, style: .timer)
                                .font(.system(size: 11, weight: .medium, design: .monospaced))
                                .monospacedDigit()
                                .foregroundStyle(.white.opacity(0.7))
                        }
                    } else if isActive, let startDate = getActiveTimerStartDate(for: activity, data: data) {
                        HStack(spacing: 4) {
                            Text(startDate, style: .timer)
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                            Circle()
                                .fill(Color.white)
                                .frame(width: 6, height: 6)
                        }
                        Text("In progress")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.8))
                    } else if let lastTime = getLastActivityTime(for: activity, data: data) {
                        Text(formatTimeAgoLong(lastTime, now: currentDate))
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                        Text(getRowDetail(for: activity, data: data))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.8))
                            .lineLimit(1)
                    } else {
                        Text("No data yet")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.8))
                        Text("Tap to log")
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

            ZStack {
                Circle()
                    .fill(Color(hex: WidgetColors.Button.light))
                    .frame(width: 34, height: 34)
                    .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 2)

                if isActive && isRemoteLock {
                    Text("⏳")
                        .font(.system(size: 16))
                } else {
                    Image(systemName: isActive ? "stop.fill" : "plus")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(isActive ? Color.red : activity.accentColor)
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
            Button(intent: StopActivityIntent(activity: activity)) {
                rowContent
            }
            .buttonStyle(.plain)
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
                        return "\(side.capitalized) side"
                    }
                    return "Breastfeeding"
                } else if lastType == "bottle" {
                    return "Bottle"
                } else if lastType == "solid" {
                    return "Solid food"
                }
            }
            return "\(data.activities.feeding.todayCount) today"

        case .sleep:
            let mins = data.activities.sleep.todayMinutes
            let goal = data.activities.sleep.goalMinutes
            if goal > 0 {
                return "\(mins)m of \(goal)m"
            }
            if let lastDuration = data.activities.sleep.lastDurationMinutes, lastDuration > 0 {
                return formatDuration(minutes: lastDuration)
            }
            return "\(formatDuration(minutes: mins)) today"

        case .diaper:
            let c = data.activities.diaper.todayCounts
            return "\(c.wet)💧 \(c.dirty)💩"

        case .pumping:
            if data.activities.pumping.todayVolumeMl > 0 {
                return "\(Int(data.activities.pumping.todayVolumeMl))ml today"
            }
            return "\(data.activities.pumping.sessionCount) sessions"

        case .tummyTime:
            let mins = data.activities.tummyTime.todayMinutes
            let goal = data.activities.tummyTime.goalMinutes
            if goal > 0 {
                return "\(mins)m of \(goal)m"
            }
            return "\(mins)m today"
        }
    }
}

func formatTimeAgoLong(_ date: Date, now: Date = Date()) -> String {
    let interval = now.timeIntervalSince(date)
    let totalMinutes = Int(interval) / 60
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60

    if hours >= 24 {
        let days = hours / 24
        return "\(days) day\(days == 1 ? "" : "s") ago"
    } else if hours > 0 {
        return "\(hours) hr, \(minutes) min ago"
    } else {
        return "\(totalMinutes) min ago"
    }
}

// SummaryCard removed - replaced by ActivityRowView for Huckleberry-style layout

func formatDuration(minutes: Int) -> String {
    let hours = minutes / 60
    let mins = minutes % 60
    if hours > 0 {
        return "\(hours)h \(mins)m"
    }
    return "\(mins)m"
}

func formatRelative(_ date: Date, now: Date = Date()) -> String {
    let interval = now.timeIntervalSince(date)
    let totalMinutes = Int(interval) / 60
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60

    if hours > 0 {
        return "\(hours)h \(minutes)m ago"
    } else {
        return "\(totalMinutes)m ago"
    }
}

func formatTimeAgo(_ date: Date, now: Date = Date()) -> String {
    let interval = now.timeIntervalSince(date)
    let totalMinutes = Int(interval) / 60
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60

    if hours >= 24 {
        let days = hours / 24
        return "\(days)d ago"
    } else if hours > 0 {
        return "\(hours)h \(minutes)m ago"
    } else {
        return "\(totalMinutes) min ago"
    }
}

func formatTimeAgoShort(_ date: Date, now: Date = Date()) -> String {
    let interval = now.timeIntervalSince(date)
    let totalMinutes = Int(interval) / 60
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60

    if hours >= 24 {
        let days = hours / 24
        return "\(days)d"
    } else if hours > 0 {
        return "\(hours)h \(minutes)m"
    } else {
        return "\(totalMinutes)m"
    }
}

// MARK: - Lock Screen Widgets
// FIXED: Simpler implementation that works better on lock screen

struct LockScreenCircularView: View {
    let entry: BabyWidgetEntry

    var activity: ActivityType { entry.selectedActivity }

    var isRemote: Bool {
        entry.widgetData?.isRemoteTimer(for: activity) ?? false
    }

    var body: some View {
        ZStack {
            if let data = entry.widgetData,
               data.hasActiveTimer(for: activity) {
                if isRemote {
                    VStack(spacing: 2) {
                        Text(activity.emoji)
                            .font(.system(size: 14))
                        Text("⏳")
                            .font(.system(size: 12))
                    }
                } else if let startDate = getActiveTimerStartDate(for: activity, data: data) {
                    VStack(spacing: 2) {
                        Text(activity.emoji)
                            .font(.system(size: 14))
                        Text(startDate, style: .timer)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .monospacedDigit()
                            .minimumScaleFactor(0.7)
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
        .widgetURL(activity.deepLinkURL)
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
                        if data.isRemoteTimer(for: activity) {
                            HStack(spacing: 2) {
                                Text("⏳")
                                    .font(.system(size: 10))
                                Text("In use")
                                    .font(.system(size: 11, weight: .medium))
                            }
                        } else if let startDate = getActiveTimerStartDate(for: activity, data: data) {
                            HStack(spacing: 2) {
                                Text(startDate, style: .timer)
                                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                    .monospacedDigit()
                                Image(systemName: "circle.fill")
                                    .font(.system(size: 4))
                                    .foregroundStyle(.green)
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

// MARK: - Network Fetch for Active Timers

struct RemoteActiveTimer: Decodable {
    let id: String
    let activity_type: String
    let started_by: String
    let started_at: String
}

func fetchActiveTimersFromNetwork() async -> [ActiveTimerData]? {
    guard let userDefaults = UserDefaults(suiteName: appGroupId),
          let supabaseUrl = userDefaults.string(forKey: "supabaseUrl"),
          let anonKey = userDefaults.string(forKey: "supabaseAnonKey"),
          let accessToken = userDefaults.string(forKey: "supabaseAccessToken"),
          let babyId = userDefaults.string(forKey: "selectedBabyId"),
          let userId = userDefaults.string(forKey: "userId") else {
        return nil
    }

    let urlString = "\(supabaseUrl)/rest/v1/active_timers?baby_id=eq.\(babyId)&select=id,activity_type,started_by,started_at"
    guard let url = URL(string: urlString) else { return nil }

    var request = URLRequest(url: url)
    request.setValue(anonKey, forHTTPHeaderField: "apikey")
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.timeoutInterval = 10

    guard let (data, response) = try? await URLSession.shared.data(for: request),
          let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        return nil
    }

    guard let remoteTimers = try? JSONDecoder().decode([RemoteActiveTimer].self, from: data) else {
        return nil
    }

    let activityTypeMap: [String: String] = [
        "feeding": "feeding",
        "sleep": "sleep",
        "pumping": "pumping",
        "tummy_time": "tummyTime"
    ]

    return remoteTimers.compactMap { timer in
        guard let widgetType = activityTypeMap[timer.activity_type] else { return nil }
        return ActiveTimerData(
            type: widgetType,
            startTime: timer.started_at,
            context: nil,
            isRemote: timer.started_by != userId
        )
    }
}

func mergeNetworkTimers(cached: WidgetDataModel?, networkTimers: [ActiveTimerData]?) -> WidgetDataModel? {
    guard var model = cached else { return nil }
    guard let networkTimers = networkTimers else { return model }

    var mergedTimers: [ActiveTimerData] = []

    for timer in networkTimers {
        if timer.isRemote == true {
            mergedTimers.append(timer)
        } else {
            if let cachedTimer = model.activeTimers?.first(where: { $0.type == timer.type }) {
                mergedTimers.append(cachedTimer)
            } else {
                mergedTimers.append(timer)
            }
        }
    }

    model.activeTimers = mergedTimers
    model.activeTimer = mergedTimers.first

    return model
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
