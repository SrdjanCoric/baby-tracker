import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Activity Attributes

// IMPORTANT: This struct is duplicated in plugins/with-live-activity-controller/ios/TimerActivityAttributes.swift
// Both definitions MUST stay in sync. The widget extension is a separate compilation unit
// and cannot share code with the main app target.
struct TimerActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsedSeconds: Int
        var context: String?
        var isPaused: Bool = false
        var effectiveStartTimeISO: String? = nil
    }

    var activityType: String
    var babyName: String
    var startTime: Date
}

// MARK: - Activity Colors

private let feedingColor = Color(red: 140/255, green: 179/255, blue: 105/255)  // #8CB369
private let sleepColor = Color(red: 158/255, green: 141/255, blue: 169/255)    // #9E8DA9
private let pumpingColor = Color(red: 123/255, green: 163/255, blue: 168/255)  // #7BA3A8
private let tummyTimeColor = Color(red: 212/255, green: 165/255, blue: 116/255) // #D4A574
private let pausedAmberColor = Color(red: 212/255, green: 160/255, blue: 23/255) // #D4A017

func formatElapsedSeconds(_ seconds: Int) -> String {
    let h = seconds / 3600
    let m = (seconds % 3600) / 60
    let s = seconds % 60
    if h > 0 {
        return String(format: "%d:%02d:%02d", h, m, s)
    }
    return String(format: "%d:%02d", m, s)
}

func effectiveTimerStart(for state: TimerActivityAttributes.ContentState, fallback: Date) -> Date {
    if let iso = state.effectiveStartTimeISO {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) {
            return date
        }
    }
    return fallback
}

func activityAccentColor(for type: String) -> Color {
    switch type {
    case "feeding": return feedingColor
    case "sleep": return sleepColor
    case "pumping": return pumpingColor
    case "tummyTime": return tummyTimeColor
    default: return feedingColor
    }
}

func activityEmoji(for type: String) -> String {
    switch type {
    case "feeding": return "🤱"
    case "sleep": return "😴"
    case "pumping": return "🫙"
    case "tummyTime": return "💪"
    default: return "🤱"
    }
}

func activityLabel(for type: String) -> String {
    switch type {
    case "feeding": return L.feeding
    case "sleep": return L.sleeping
    case "pumping": return L.pumping
    case "tummyTime": return L.tummyTime
    default: return L.activityGeneric
    }
}

func contextLabel(for context: String?, activityType: String) -> String {
    guard let context = context else { return "" }

    switch activityType {
    case "feeding", "pumping":
        switch context {
        case "left": return L.leftSide
        case "right": return L.rightSide
        case "both": return L.bothSides
        default: return localizedToken(context)
        }
    case "sleep":
        switch context {
        case "nap": return L.nap
        case "night": return L.nightSleep
        default: return localizedToken(context)
        }
    default:
        return localizedToken(context)
    }
}

// MARK: - Live Activity Widget

struct TimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TimerActivityAttributes.self) { context in
            // Lock screen / banner view
            LockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded view
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 4) {
                        Text(activityEmoji(for: context.attributes.activityType))
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(context.attributes.babyName)
                                .font(.caption)
                                .fontWeight(.semibold)
                            if context.state.isPaused {
                                Text(L.paused)
                                    .font(.caption2)
                                    .fontWeight(.medium)
                                    .foregroundStyle(pausedAmberColor)
                            } else if let ctx = context.state.context {
                                Text(contextLabel(for: ctx, activityType: context.attributes.activityType))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isPaused {
                        HStack(spacing: 4) {
                            Text("⏸")
                                .font(.caption)
                            Text(formatElapsedSeconds(context.state.elapsedSeconds))
                                .font(.system(.title, design: .monospaced))
                                .fontWeight(.medium)
                                .monospacedDigit()
                        }
                        .foregroundStyle(pausedAmberColor)
                    } else {
                        Text(effectiveTimerStart(for: context.state, fallback: context.attributes.startTime), style: .timer)
                            .font(.system(.title, design: .monospaced))
                            .fontWeight(.medium)
                            .foregroundStyle(activityAccentColor(for: context.attributes.activityType))
                            .monospacedDigit()
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(activityLabel(for: context.attributes.activityType))
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Link(destination: URL(string: "sofibaby://\(context.attributes.activityType)")!) {
                            Text(L.openLabel)
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 6)
                                .background(activityAccentColor(for: context.attributes.activityType))
                                .clipShape(Capsule())
                        }
                    }
                }
            } compactLeading: {
                // Compact leading (left of camera notch)
                Text(activityEmoji(for: context.attributes.activityType))
                    .font(.caption)
            } compactTrailing: {
                if context.state.isPaused {
                    Text("⏸ \(formatElapsedSeconds(context.state.elapsedSeconds))")
                        .font(.system(.caption, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(pausedAmberColor)
                } else {
                    Text(effectiveTimerStart(for: context.state, fallback: context.attributes.startTime), style: .timer)
                        .font(.system(.caption, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(activityAccentColor(for: context.attributes.activityType))
                }
            } minimal: {
                // Minimal view (when multiple activities are running)
                Text(activityEmoji(for: context.attributes.activityType))
                    .font(.caption2)
            }
        }
        .supplementalActivityFamilies([])
    }
}

// MARK: - Lock Screen View

struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<TimerActivityAttributes>

    var body: some View {
        HStack(spacing: 12) {
            // Icon and info
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(activityEmoji(for: context.attributes.activityType))
                        .font(.title2)
                    Text(activityLabel(for: context.attributes.activityType))
                        .font(.headline)
                        .fontWeight(.semibold)
                }

                Text(context.attributes.babyName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if context.state.isPaused {
                    Text(L.paused)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(pausedAmberColor)
                } else if let contextText = context.state.context {
                    Text(contextLabel(for: contextText, activityType: context.attributes.activityType))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if context.state.isPaused {
                    HStack(spacing: 6) {
                        Text("⏸")
                            .font(.caption)
                        Text(formatElapsedSeconds(context.state.elapsedSeconds))
                            .font(.system(size: 36, weight: .light, design: .monospaced))
                            .monospacedDigit()
                    }
                    .foregroundStyle(pausedAmberColor)
                } else {
                    Text(effectiveTimerStart(for: context.state, fallback: context.attributes.startTime), style: .timer)
                        .font(.system(size: 36, weight: .light, design: .monospaced))
                        .monospacedDigit()
                        .foregroundStyle(activityAccentColor(for: context.attributes.activityType))
                }

                (Text(L.started) + Text(verbatim: " ") + Text(context.attributes.startTime, style: .time))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding()
        .activityBackgroundTint(activityAccentColor(for: context.attributes.activityType).opacity(0.2))
    }
}
