import SwiftUI
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
        var lastDurationMinutes: Int?
        var isActive: Bool
        var sleepType: String?
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
    var context: String?
}

// MARK: - Colors

extension Color {
    static let feedingGreen = Color(red: 0.549, green: 0.702, blue: 0.412)
    static let sleepLavender = Color(red: 0.620, green: 0.553, blue: 0.663)
    static let diaperCoral = Color(red: 0.878, green: 0.627, blue: 0.600)
    static let pumpingTeal = Color(red: 0.482, green: 0.639, blue: 0.659)
    static let tummyTan = Color(red: 0.831, green: 0.647, blue: 0.455)
}

// MARK: - Activity Type

enum ComplicationActivityType: String, CaseIterable {
    case feeding, sleep, diaper, pumping, tummyTime

    var emoji: String {
        switch self {
        case .feeding: return "🤱"
        case .sleep: return "😴"
        case .diaper: return "🚼"
        case .pumping: return "🫙"
        case .tummyTime: return "💪"
        }
    }

    var color: Color {
        switch self {
        case .feeding: return .feedingGreen
        case .sleep: return .sleepLavender
        case .diaper: return .diaperCoral
        case .pumping: return .pumpingTeal
        case .tummyTime: return .tummyTan
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

    var deepLinkURL: URL {
        URL(string: "sofibaby-watch://\(rawValue)")!
    }

    func lastTime(from data: WatchWidgetData) -> String? {
        switch self {
        case .feeding: return data.activities.feeding.lastTime
        case .sleep: return data.activities.sleep.lastTime
        case .diaper: return data.activities.diaper.lastTime
        case .pumping: return data.activities.pumping.lastTime
        case .tummyTime: return data.activities.tummyTime.lastTime
        }
    }

    func activeTimer(from data: WatchWidgetData) -> WatchActiveTimer? {
        let timers = data.activeTimers ?? (data.activeTimer.map { [$0] } ?? [])
        return timers.first { $0.type == rawValue }
    }
}

// MARK: - Utilities

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

    let interval = Date().timeIntervalSince(parsedDate)
    let hours = Int(interval) / 3600
    let minutes = (Int(interval) % 3600) / 60

    if hours > 0 {
        return "\(hours)h \(minutes)m"
    } else {
        return "\(minutes)m"
    }
}

func parseDate(_ dateString: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: dateString) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: dateString)
}

func loadWidgetData() -> WatchWidgetData? {
    let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app")
    if let dataString = userDefaults?.string(forKey: "watchData"),
       let data = dataString.data(using: .utf8),
       let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data) {
        return decoded
    }
    if let dataString = userDefaults?.string(forKey: "widgetData"),
       let data = dataString.data(using: .utf8),
       let decoded = try? JSONDecoder().decode(WatchWidgetData.self, from: data) {
        return decoded
    }
    return nil
}

// MARK: - Generic Activity Complication Entry & Provider

struct ActivityComplicationEntry: TimelineEntry {
    let date: Date
    let data: WatchWidgetData?
    let activityType: ComplicationActivityType
    var isPreview: Bool = false
}

struct ActivityComplicationProvider: TimelineProvider {
    let activityType: ComplicationActivityType

    func placeholder(in context: Context) -> ActivityComplicationEntry {
        ActivityComplicationEntry(date: Date(), data: nil, activityType: activityType, isPreview: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (ActivityComplicationEntry) -> Void) {
        completion(ActivityComplicationEntry(date: Date(), data: nil, activityType: activityType, isPreview: true))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ActivityComplicationEntry>) -> Void) {
        let entry = ActivityComplicationEntry(date: Date(), data: loadWidgetData(), activityType: activityType, isPreview: false)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

// MARK: - Activity Circular View

struct ActivityCircularView: View {
    let entry: ActivityComplicationEntry

    var previewValue: String {
        switch entry.activityType {
        case .feeding: return "12m"
        case .sleep: return "2h 5m"
        case .diaper: return "3"
        case .pumping: return "3h 1m"
        case .tummyTime: return "28m"
        }
    }

    var diaperWetCount: Int {
        guard let data = entry.data else { return 0 }
        return data.activities.diaper.todayCounts.wet
    }

    var body: some View {
        let activity = entry.activityType

        if entry.isPreview && activity == .diaper {
            ZStack {
                AccessoryWidgetBackground()
                HStack(spacing: 2) {
                    Text("💧")
                        .font(.system(size: 14))
                    Text("5")
                        .font(.system(size: 14, weight: .semibold))
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        } else if entry.isPreview {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text(activity.emoji)
                        .font(.system(size: 16))
                    Text(previewValue)
                        .font(.system(size: 11, weight: .semibold))
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        } else if activity == .diaper {
            ZStack {
                AccessoryWidgetBackground()
                HStack(spacing: 2) {
                    Text("💧")
                        .font(.system(size: 14))
                    Text("\(diaperWetCount)")
                        .font(.system(size: 14, weight: .semibold))
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .widgetURL(activity.deepLinkURL)
        } else if let data = entry.data, let timer = activity.activeTimer(from: data), let start = parseDate(timer.startTime) {
            Gauge(value: 0) {
                EmptyView()
            } currentValueLabel: {
                Text(start, style: .timer)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .minimumScaleFactor(0.6)
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(activity.color)
            .widgetURL(activity.deepLinkURL)
        } else {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text(activity.emoji)
                        .font(.system(size: 16))
                    Text(formatTimeSince(entry.data.flatMap { activity.lastTime(from: $0) }))
                        .font(.system(size: 11, weight: .semibold))
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .widgetURL(activity.deepLinkURL)
        }
    }
}

// MARK: - App Launcher Complication

struct AppLauncherEntry: TimelineEntry {
    let date: Date
}

struct AppLauncherProvider: TimelineProvider {
    func placeholder(in context: Context) -> AppLauncherEntry {
        AppLauncherEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (AppLauncherEntry) -> Void) {
        completion(AppLauncherEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AppLauncherEntry>) -> Void) {
        let entry = AppLauncherEntry(date: Date())
        completion(Timeline(entries: [entry], policy: .never))
    }
}

struct AppLauncherCircularView: View {
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Image("complication-icon")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .padding(4)
        }
        .widgetAccentable()
    }
}

struct AppLauncherComplication: Widget {
    let kind = "AppLauncherComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AppLauncherProvider()) { _ in
            AppLauncherCircularView()
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("SofiBaby")
        .description("Open SofiBaby watch app")
        .supportedFamilies([.accessoryCircular])
    }
}

// MARK: - Per-Activity Widgets

struct FeedingComplication: Widget {
    let kind = "FeedingComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ActivityComplicationProvider(activityType: .feeding)) { entry in
            ActivityCircularView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Feeding")
        .description("Time since last feeding")
        .supportedFamilies([.accessoryCircular])
    }
}

struct SleepComplication: Widget {
    let kind = "SleepComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ActivityComplicationProvider(activityType: .sleep)) { entry in
            ActivityCircularView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Sleep")
        .description("Time since last sleep")
        .supportedFamilies([.accessoryCircular])
    }
}

struct DiaperComplication: Widget {
    let kind = "DiaperComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ActivityComplicationProvider(activityType: .diaper)) { entry in
            ActivityCircularView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Diaper")
        .description("Time since last diaper change")
        .supportedFamilies([.accessoryCircular])
    }
}

struct PumpingComplication: Widget {
    let kind = "PumpingComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ActivityComplicationProvider(activityType: .pumping)) { entry in
            ActivityCircularView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Pumping")
        .description("Time since last pumping session")
        .supportedFamilies([.accessoryCircular])
    }
}

struct TummyTimeComplication: Widget {
    let kind = "TummyTimeComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ActivityComplicationProvider(activityType: .tummyTime)) { entry in
            ActivityCircularView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Tummy Time")
        .description("Time since last tummy time")
        .supportedFamilies([.accessoryCircular])
    }
}

// MARK: - Summary Complication (Rectangular)

struct SummaryEntry: TimelineEntry {
    let date: Date
    let data: WatchWidgetData?
}

struct SummaryProvider: TimelineProvider {
    func placeholder(in context: Context) -> SummaryEntry {
        SummaryEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SummaryEntry) -> Void) {
        completion(SummaryEntry(date: Date(), data: loadWidgetData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SummaryEntry>) -> Void) {
        let entry = SummaryEntry(date: Date(), data: loadWidgetData())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct SummaryRectangularView: View {
    let entry: SummaryEntry

    var body: some View {
        if let data = entry.data {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text("🤱")
                        .font(.system(size: 9))
                    Text("Feed")
                        .font(.system(size: 11, weight: .medium))
                    Spacer()
                    Text(formatTimeSince(data.activities.feeding.lastTime))
                        .font(.system(size: 10))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 4) {
                    Text("😴")
                        .font(.system(size: 9))
                    Text("Sleep")
                        .font(.system(size: 11, weight: .medium))
                    Spacer()
                    Text("\(data.activities.sleep.todayMinutes / 60)h \(data.activities.sleep.todayMinutes % 60)m")
                        .font(.system(size: 10))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 4) {
                    Text("🚼")
                        .font(.system(size: 9))
                    Text("Diaper")
                        .font(.system(size: 11, weight: .medium))
                    Spacer()
                    let total = data.activities.diaper.todayCounts.wet + data.activities.diaper.todayCounts.dirty + data.activities.diaper.todayCounts.mixed
                    Text("\(total) today")
                        .font(.system(size: 10))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text("🤱")
                        .font(.system(size: 10))
                    Text("SofiBaby")
                        .font(.system(size: 12, weight: .semibold))
                }
                Text("Open app to sync")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct SummaryComplication: Widget {
    let kind = "SummaryComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SummaryProvider()) { entry in
            SummaryRectangularView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Activity Summary")
        .description("Feeding, sleep, and diaper overview")
        .supportedFamilies([.accessoryRectangular])
    }
}

// MARK: - Entry Point

@main
struct SofiBabyComplicationBundle: WidgetBundle {
    var body: some Widget {
        FeedingComplication()
        SleepComplication()
        DiaperComplication()
        PumpingComplication()
        TummyTimeComplication()
        SummaryComplication()
    }
}
