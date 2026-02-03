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
    case feeding, sleep, diaper, pumping, growth, tummyTime

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Activity Type"
    static var caseDisplayRepresentations: [ActivityType: DisplayRepresentation] = [
        .feeding: DisplayRepresentation(title: "Feeding", image: .init(systemName: "drop.fill")),
        .sleep: DisplayRepresentation(title: "Sleep", image: .init(systemName: "moon.fill")),
        .diaper: DisplayRepresentation(title: "Diaper", image: .init(systemName: "leaf.fill")),
        .pumping: DisplayRepresentation(title: "Pumping", image: .init(systemName: "flask.fill")),
        .growth: DisplayRepresentation(title: "Growth", image: .init(systemName: "ruler.fill")),
        .tummyTime: DisplayRepresentation(title: "Tummy Time", image: .init(systemName: "figure.play"))
    ]

    var icon: String {
        switch self {
        case .feeding: return "drop.fill"
        case .sleep: return "moon.fill"
        case .diaper: return "leaf.fill"
        case .pumping: return "flask.fill"
        case .growth: return "ruler.fill"
        case .tummyTime: return "figure.play"
        }
    }

    var emoji: String {
        switch self {
        case .feeding: return "🤱"
        case .sleep: return "😴"
        case .diaper: return "🚼"
        case .pumping: return "🫙"
        case .growth: return "📏"
        case .tummyTime: return "💪"
        }
    }

    var label: String {
        switch self {
        case .feeding: return "Feeding"
        case .sleep: return "Sleep"
        case .diaper: return "Diaper"
        case .pumping: return "Pumping"
        case .growth: return "Growth"
        case .tummyTime: return "Tummy Time"
        }
    }

    var primaryColor: Color {
        switch self {
        case .feeding: return Color("feedingPrimary")
        case .sleep: return Color("sleepPrimary")
        case .diaper: return Color("diaperPrimary")
        case .pumping: return Color("pumpingPrimary")
        case .growth: return Color("growthPrimary")
        case .tummyTime: return Color("tummyTimePrimary")
        }
    }

    var backgroundColor: Color {
        switch self {
        case .feeding: return Color("feedingBackground")
        case .sleep: return Color("sleepBackground")
        case .diaper: return Color("diaperBackground")
        case .pumping: return Color("pumpingBackground")
        case .growth: return Color("growthBackground")
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
        case .growth: return Color(hex: WidgetColors.Accent.growth)
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
        case .growth: return Color(hex: WidgetColors.MutedLight.growth)
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
        case .growth: return Color(hex: WidgetColors.MutedDark.growth)
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
        var todayVolumeMl: Int
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
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Activity")
    var activity: ActivityType

    init() {
        self.activity = .feeding
    }

    init(activity: ActivityType) {
        self.activity = activity
    }

    var stopURL: URL {
        URL(string: "sofibaby://\(activity.rawValue)?action=stop")!
    }

    func perform() async throws -> some IntentResult {
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
    case .growth: isoString = data.activities.growth.lastMeasurement?.date
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

// MARK: - Timeline Providers

struct SingleActivityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BabyWidgetEntry {
        BabyWidgetEntry(date: Date(), widgetData: nil, selectedActivity: .feeding, selectedActivities: [])
    }

    func snapshot(for configuration: SelectActivityIntent, in context: Context) async -> BabyWidgetEntry {
        let data = loadWidgetData()
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: configuration.activity, selectedActivities: [])
    }

    func timeline(for configuration: SelectActivityIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        let data = loadWidgetData()

        // Create entries for the next 30 minutes, one per minute for accurate "X min ago" display
        var entries: [BabyWidgetEntry] = []
        let now = Date()
        for minuteOffset in 0..<30 {
            let entryDate = now.addingTimeInterval(Double(minuteOffset) * 60)
            let entry = BabyWidgetEntry(date: entryDate, widgetData: data, selectedActivity: configuration.activity, selectedActivities: [])
            entries.append(entry)
        }

        // Refresh after 30 minutes
        let nextUpdate = now.addingTimeInterval(30 * 60)
        return Timeline(entries: entries, policy: .after(nextUpdate))
    }
}

struct FourActivityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BabyWidgetEntry {
        BabyWidgetEntry(date: Date(), widgetData: nil, selectedActivity: .feeding, selectedActivities: [.feeding, .sleep, .diaper, .tummyTime])
    }

    func snapshot(for configuration: SelectFourActivitiesIntent, in context: Context) async -> BabyWidgetEntry {
        let data = loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2, configuration.activity3, configuration.activity4]
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: .feeding, selectedActivities: activities)
    }

    func timeline(for configuration: SelectFourActivitiesIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        let data = loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2, configuration.activity3, configuration.activity4]

        // Create entries for the next 30 minutes, one per minute
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
        BabyWidgetEntry(date: Date(), widgetData: nil, selectedActivity: .feeding, selectedActivities: [.feeding, .sleep])
    }

    func snapshot(for configuration: SelectTwoActivitiesIntent, in context: Context) async -> BabyWidgetEntry {
        let data = loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2]
        return BabyWidgetEntry(date: Date(), widgetData: data, selectedActivity: .feeding, selectedActivities: activities)
    }

    func timeline(for configuration: SelectTwoActivitiesIntent, in context: Context) async -> Timeline<BabyWidgetEntry> {
        let data = loadWidgetData()
        let activities = [configuration.activity1, configuration.activity2]

        // Create entries for the next 30 minutes, one per minute
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

// MARK: - Widget Stop Button

struct WidgetStopButton: View {
    let activity: ActivityType

    var body: some View {
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

    var body: some View {
        VStack(spacing: 0) {
            // Top: Baby name + activity emoji
            HStack {
                if let babyName = entry.widgetData?.babyName {
                    Text(babyName)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.9))
                }
                Spacer()
                Text(activity.emoji)
                    .font(.system(size: 20))
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)

            Spacer()

            // Center: Contextual info
            VStack(spacing: 4) {
                if let data = entry.widgetData {
                    if isActive, let startDate = getActiveTimerStartDate(for: activity, data: data) {
                        // Active timer display
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
                    } else {
                        // Show contextual info based on activity type
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

            // Bottom: Stop pill when active, time ago when inactive
            // Both are non-interactive; tapping anywhere goes through widgetURL
            if isActive {
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
        .widgetURL(activity.deepLinkURL)
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
        if let lastDuration = data.activities.sleep.lastDurationMinutes, lastDuration > 0 {
            return "Slept \(formatDuration(minutes: lastDuration))"
        }
        let todayMins = data.activities.sleep.todayMinutes
        if todayMins > 0 {
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
            return "\(volume) ml today"
        }
        return "Pumping"

    case .growth:
        if let weight = data.activities.growth.lastMeasurement?.weightKg {
            return String(format: "%.1f kg", weight)
        }
        return "Growth"

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

    case .growth:
        if let height = data.activities.growth.lastMeasurement?.heightCm {
            return String(format: "%.1f cm", height)
        }
        return "Tap to measure"

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
            return "\(volume) ml today"
        }
        return "Last pump"
    case .growth:
        if let weight = data.activities.growth.lastMeasurement?.weightKg {
            return String(format: "%.1f kg", weight)
        }
        return "Last measurement"
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

    var body: some View {
        VStack(spacing: 10) {
            // Top section: Baby name
            HStack {
                if let babyName = entry.widgetData?.babyName {
                    Text("\(babyName)'s activity")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(.primary)
                }
                Spacer()
            }

            Spacer()

            // Bottom: Colorful circular activity buttons
            HStack(spacing: 16) {
                ForEach(activities.prefix(4), id: \.self) { activity in
                    Link(destination: activity.deepLinkURL) {
                        ColorfulCircleButton(activity: activity, data: entry.widgetData, currentDate: entry.date)
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

    var isActive: Bool {
        data?.hasActiveTimer(for: activity) ?? false
    }

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                // Colorful circle background
                Circle()
                    .fill(activity.accentColor)
                    .frame(width: 52, height: 52)
                    .shadow(color: activity.accentColor.opacity(0.3), radius: 4, x: 0, y: 2)

                // Active timer ring
                if isActive {
                    Circle()
                        .strokeBorder(.white, lineWidth: 3)
                        .frame(width: 52, height: 52)
                }

                // Emoji
                Text(activity.emoji)
                    .font(.system(size: 22))
            }

            // Time label below
            if isActive, let startDate = getActiveTimerStartDate(for: activity, data: data) {
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

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(alignment: .center) {
                if let babyName = entry.widgetData?.babyName {
                    Text("\(babyName)'s recent activity")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(.primary)
                } else {
                    Text("Recent activity")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(.primary)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)

            // Activity rows - Huckleberry style
            VStack(spacing: 8) {
                ForEach(activities.prefix(4), id: \.self) { activity in
                    ActivityRowView(activity: activity, data: entry.widgetData, currentDate: entry.date)
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

    var isActive: Bool {
        data?.hasActiveTimer(for: activity) ?? false
    }

    var body: some View {
        Link(destination: activity.deepLinkURL) {
            HStack(spacing: 10) {
                // Left: Emoji icon
                Text(activity.emoji)
                    .font(.system(size: 22))
                    .frame(width: 32)

                // Middle: Time info
                VStack(alignment: .leading, spacing: 1) {
                    if let data = data {
                        if isActive, let startDate = getActiveTimerStartDate(for: activity, data: data) {
                            // Active timer
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
                            // Time since
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

                // Right: + button indicator
                ZStack {
                    Circle()
                        .fill(Color(hex: WidgetColors.Button.light))
                        .frame(width: 34, height: 34)
                        .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 2)

                    Image(systemName: isActive ? "stop.fill" : "plus")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(isActive ? Color.red : activity.accentColor)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(activity.accentColor)
            )
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
            if let lastDuration = data.activities.sleep.lastDurationMinutes, lastDuration > 0 {
                return formatDuration(minutes: lastDuration)
            }
            return "\(formatDuration(minutes: data.activities.sleep.todayMinutes)) today"

        case .diaper:
            let c = data.activities.diaper.todayCounts
            return "\(c.wet)💧 \(c.dirty)💩"

        case .pumping:
            if data.activities.pumping.todayVolumeMl > 0 {
                return "\(data.activities.pumping.todayVolumeMl)ml today"
            }
            return "\(data.activities.pumping.sessionCount) sessions"

        case .growth:
            if let weight = data.activities.growth.lastMeasurement?.weightKg {
                return String(format: "%.1f kg", weight)
            }
            return "No measurement"

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

    var body: some View {
        ZStack {
            if let data = entry.widgetData,
               data.hasActiveTimer(for: activity),
               let startDate = getActiveTimerStartDate(for: activity, data: data) {
                // Active timer
                VStack(spacing: 2) {
                    Text(activity.emoji)
                        .font(.system(size: 14))
                    Text(startDate, style: .timer)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .monospacedDigit()
                        .minimumScaleFactor(0.7)
                }
            } else if let lastTime = getLastActivityTime(for: activity, data: entry.widgetData) {
                // Time since last
                VStack(spacing: 2) {
                    Text(activity.emoji)
                        .font(.system(size: 14))
                    Text(formatTimeAgoShort(lastTime, now: entry.date))
                        .font(.system(size: 10, weight: .medium))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
            } else {
                // No data
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
                       data.hasActiveTimer(for: activity),
                       let startDate = getActiveTimerStartDate(for: activity, data: data) {
                        // Active timer
                        HStack(spacing: 2) {
                            Text(startDate, style: .timer)
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .monospacedDigit()
                            Image(systemName: "circle.fill")
                                .font(.system(size: 4))
                                .foregroundStyle(.green)
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
        AppIntentConfiguration(
            kind: kind,
            intent: SelectActivityIntent.self,
            provider: SingleActivityProvider()
        ) { entry in
            SmallWidgetView(entry: entry)
        }
        .configurationDisplayName("Activity Status")
        .description("Track a single activity")
        .supportedFamilies([.systemSmall])
    }
}

struct MediumBabyWidget: Widget {
    let kind: String = "MediumBabyWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectFourActivitiesIntent.self,
            provider: FourActivityProvider()
        ) { entry in
            MediumWidgetView(entry: entry)
        }
        .configurationDisplayName("Quick Log")
        .description("Quick access to activities")
        .supportedFamilies([.systemMedium])
    }
}

struct LargeBabyWidget: Widget {
    let kind: String = "LargeBabyWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectFourActivitiesIntent.self,
            provider: FourActivityProvider()
        ) { entry in
            LargeWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Summary")
        .description("Overview of your baby's day")
        .supportedFamilies([.systemLarge])
    }
}

struct LockScreenCircularWidget: Widget {
    let kind: String = "LockScreenCircularWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectActivityIntent.self,
            provider: SingleActivityProvider()
        ) { entry in
            LockScreenCircularView(entry: entry)
        }
        .configurationDisplayName("Activity Timer")
        .description("Time since last activity")
        .supportedFamilies([.accessoryCircular])
    }
}

struct LockScreenRectangularWidget: Widget {
    let kind: String = "LockScreenRectangularWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectTwoActivitiesIntent.self,
            provider: TwoActivityProvider()
        ) { entry in
            LockScreenRectangularView(entry: entry)
        }
        .configurationDisplayName("Activity Summary")
        .description("Overview of two activities")
        .supportedFamilies([.accessoryRectangular])
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
