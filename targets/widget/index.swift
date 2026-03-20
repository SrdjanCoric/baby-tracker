import WidgetKit
import SwiftUI
import AppIntents

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
        let cached = loadWidgetData()
        let hasActiveTimers = (cached?.activeTimers?.isEmpty == false) || (cached?.activeTimer != nil)
        let data: WidgetDataModel?
        if isCachedDataFresh(data: cached) && !hasActiveTimers {
            data = cached
        } else {
            let networkTimers = filterStoppedTimers(await fetchActiveTimersFromNetwork())
            data = mergeNetworkTimers(cached: cached, networkTimers: networkTimers) ?? cached
        }

        if let data {
            saveWidgetDataToAppGroup(data)
        }

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
        let cached = loadWidgetData()
        let hasActiveTimers = (cached?.activeTimers?.isEmpty == false) || (cached?.activeTimer != nil)
        let data: WidgetDataModel?
        if isCachedDataFresh(data: cached) && !hasActiveTimers {
            data = cached
        } else {
            let networkTimers = filterStoppedTimers(await fetchActiveTimersFromNetwork())
            data = mergeNetworkTimers(cached: cached, networkTimers: networkTimers) ?? cached
        }

        if let data {
            saveWidgetDataToAppGroup(data)
        }

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
        let cached = loadWidgetData()
        let hasActiveTimers = (cached?.activeTimers?.isEmpty == false) || (cached?.activeTimer != nil)
        let data: WidgetDataModel?
        if isCachedDataFresh(data: cached) && !hasActiveTimers {
            data = cached
        } else {
            let networkTimers = filterStoppedTimers(await fetchActiveTimersFromNetwork())
            data = mergeNetworkTimers(cached: cached, networkTimers: networkTimers) ?? cached
        }

        if let data {
            saveWidgetDataToAppGroup(data)
        }

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

                            Text("Paused")
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
                HStack(spacing: 8) {
                    if entry.isUserAuthenticated {
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

                    Link(destination: activity.stopTimerURL) {
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

// MARK: - Small Widget Helper Functions

func getSmallWidgetMainText(for activity: ActivityType, data: WidgetDataModel) -> String {
    switch activity {
    case .feeding:
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
        if let awakeText = getAwakeTimeText(data: data) {
            return awakeText
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
        if let wakeWindowText = getWakeWindowCountdown(data: data) {
            return wakeWindowText
        }
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

// MARK: - Medium Widget View

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
                        Link(destination: activity.stopTimerURL) {
                            ColorfulCircleButton(activity: activity, data: entry.widgetData, currentDate: entry.date)
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

// MARK: - Large Widget View

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

// MARK: - Activity Row

struct ActivityRowView: View {
    let activity: ActivityType
    let data: WidgetDataModel?
    let currentDate: Date
    var isRemoteLock: Bool = false
    var isUserAuthenticated: Bool = true

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
                            let pausedSuffix = isTimerPausedForActivity(activity, data: data) ? " (paused)" : ""
                            Text("\(context) is \(activity.label.lowercased())ing\(pausedSuffix)")
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                        } else {
                            Text("In use")
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
                            Text("Paused")
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
                            Text("In progress")
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

            if isActive && isRemoteLock {
                ZStack {
                    Circle()
                        .fill(Color(hex: WidgetColors.Button.light))
                        .frame(width: 34, height: 34)
                        .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 2)
                    Text("⏳")
                        .font(.system(size: 16))
                }
            } else if isActive {
                HStack(spacing: 6) {
                    if isUserAuthenticated {
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

                    Link(destination: activity.stopTimerURL) {
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
                        let nextSide = side.lowercased() == "left" ? "Right" : "Left"
                        return "Next: \(nextSide) side"
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
            if let awakeText = getAwakeTimeText(data: data, now: currentDate) {
                return awakeText
            }
            let mins = data.activities.sleep.todayMinutes
            if mins > 0 {
                return "\(formatDuration(minutes: mins)) today"
            }
            if let lastDuration = data.activities.sleep.lastDurationMinutes, lastDuration > 0 {
                return formatDuration(minutes: lastDuration)
            }
            return "No sleep yet"

        case .diaper:
            let c = data.activities.diaper.todayCounts
            return "\(c.wet + c.mixed)💧 \(c.dirty + c.mixed)💩"

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

// MARK: - Time Formatting Helpers

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

func formatDuration(minutes: Int) -> String {
    let hours = minutes / 60
    let mins = minutes % 60
    if hours > 0 {
        return "\(hours)h \(mins)m"
    }
    return "\(mins)m"
}

func getWakeWindowCountdown(data: WidgetDataModel) -> String? {
    guard let windowMinutes = data.activities.sleep.wakeWindowMinutes,
          let lastEndedStr = data.activities.sleep.lastSleepEndedAt,
          !data.activities.sleep.isActive else {
        return nil
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let lastEnded = formatter.date(from: lastEndedStr) else {
        let basicFormatter = ISO8601DateFormatter()
        guard let lastEndedBasic = basicFormatter.date(from: lastEndedStr) else { return nil }
        return computeWakeWindowText(lastEnded: lastEndedBasic, windowMinutes: windowMinutes, label: data.activities.sleep.wakeWindowSlotLabel)
    }
    return computeWakeWindowText(lastEnded: lastEnded, windowMinutes: windowMinutes, label: data.activities.sleep.wakeWindowSlotLabel)
}

func computeWakeWindowText(lastEnded: Date, windowMinutes: Int, label: String?) -> String? {
    let now = Date()
    let awakeSeconds = now.timeIntervalSince(lastEnded)
    let windowSeconds = Double(windowMinutes) * 60.0
    let remainingSeconds = windowSeconds - awakeSeconds
    let remainingMinutes = Int(remainingSeconds / 60.0)

    let isBedtime = label == "bedtime"
    let prefix = isBedtime ? "Bedtime" : "Nap"

    if remainingMinutes <= 0 {
        return "\(prefix) time!"
    } else if remainingMinutes >= 60 {
        let h = remainingMinutes / 60
        let m = remainingMinutes % 60
        return m > 0 ? "\(prefix) in \(h)h \(m)m" : "\(prefix) in \(h)h"
    } else {
        return "\(prefix) in \(remainingMinutes)m"
    }
}

func getAwakeTimeText(data: WidgetDataModel, now: Date = Date()) -> String? {
    guard let lastEndedStr = data.activities.sleep.lastSleepEndedAt,
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
        return "Awake \(hours)h \(mins)m"
    }
    return "Awake \(awakeMinutes)m"
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
                            if isTimerPausedForActivity(activity, data: data) {
                                HStack(spacing: 2) {
                                    Text("⏸ \(formatWidgetElapsed(getPausedElapsedSeconds(activity, data: data)))")
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .monospacedDigit()
                                }
                            } else {
                                HStack(spacing: 2) {
                                    Text(startDate, style: .timer)
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .monospacedDigit()
                                    Image(systemName: "circle.fill")
                                        .font(.system(size: 4))
                                        .foregroundStyle(.green)
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
