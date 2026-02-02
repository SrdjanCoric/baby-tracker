import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Activity Attributes

struct TimerActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsedSeconds: Int
        var context: String?
    }

    var activityType: String
    var babyName: String
    var startTime: Date
}

// MARK: - Activity Colors

extension Color {
    static func activityPrimaryColor(for type: String) -> Color {
        switch type {
        case "feeding": return Color("feedingPrimary")
        case "sleep": return Color("sleepPrimary")
        case "pumping": return Color("pumpingPrimary")
        case "tummyTime": return Color("tummyTimePrimary")
        default: return Color("feedingPrimary")
        }
    }

    static func activityBackgroundColor(for type: String) -> Color {
        switch type {
        case "feeding": return Color("feedingBackground")
        case "sleep": return Color("sleepBackground")
        case "pumping": return Color("pumpingBackground")
        case "tummyTime": return Color("tummyTimeBackground")
        default: return Color("feedingBackground")
        }
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
    case "feeding": return "Feeding"
    case "sleep": return "Sleeping"
    case "pumping": return "Pumping"
    case "tummyTime": return "Tummy Time"
    default: return "Activity"
    }
}

func contextLabel(for context: String?, activityType: String) -> String {
    guard let context = context else { return "" }

    switch activityType {
    case "feeding", "pumping":
        switch context {
        case "left": return "Left side"
        case "right": return "Right side"
        case "both": return "Both sides"
        default: return context
        }
    case "sleep":
        switch context {
        case "nap": return "Nap"
        case "night": return "Night sleep"
        default: return context
        }
    default:
        return context
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
                            if let contextLabel = context.state.context {
                                Text(contextLabel)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.startTime, style: .timer)
                        .font(.system(.title, design: .monospaced))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.activityPrimaryColor(for: context.attributes.activityType))
                        .monospacedDigit()
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(activityLabel(for: context.attributes.activityType))
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Link(destination: URL(string: "sofibaby://\(context.attributes.activityType)/stop")!) {
                            Text("Stop")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 6)
                                .background(Color.red)
                                .clipShape(Capsule())
                        }
                    }
                }
            } compactLeading: {
                // Compact leading (left of camera notch)
                HStack(spacing: 4) {
                    Text(activityEmoji(for: context.attributes.activityType))
                        .font(.caption)
                }
            } compactTrailing: {
                // Compact trailing (right of camera notch)
                Text(context.attributes.startTime, style: .timer)
                    .font(.system(.caption, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(Color.activityPrimaryColor(for: context.attributes.activityType))
            } minimal: {
                // Minimal view (when multiple activities are running)
                Text(activityEmoji(for: context.attributes.activityType))
                    .font(.caption2)
            }
        }
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

                if let contextText = context.state.context {
                    Text(contextLabel(for: contextText, activityType: context.attributes.activityType))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Timer
            VStack(alignment: .trailing, spacing: 4) {
                Text(context.attributes.startTime, style: .timer)
                    .font(.system(size: 36, weight: .light, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(Color.activityPrimaryColor(for: context.attributes.activityType))

                Text("Started \(context.attributes.startTime, style: .time)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding()
        .activityBackgroundTint(Color.activityBackgroundColor(for: context.attributes.activityType).opacity(0.3))
    }
}

// MARK: - Previews

#Preview("Lock Screen", as: .content, using: TimerActivityAttributes(
    activityType: "feeding",
    babyName: "Sofia",
    startTime: Date()
)) {
    TimerLiveActivity()
} contentStates: {
    TimerActivityAttributes.ContentState(elapsedSeconds: 0, context: "left")
}

#Preview("Dynamic Island Compact", as: .dynamicIsland(.compact), using: TimerActivityAttributes(
    activityType: "sleep",
    babyName: "Sofia",
    startTime: Date()
)) {
    TimerLiveActivity()
} contentStates: {
    TimerActivityAttributes.ContentState(elapsedSeconds: 300, context: "nap")
}

#Preview("Dynamic Island Expanded", as: .dynamicIsland(.expanded), using: TimerActivityAttributes(
    activityType: "pumping",
    babyName: "Sofia",
    startTime: Date()
)) {
    TimerLiveActivity()
} contentStates: {
    TimerActivityAttributes.ContentState(elapsedSeconds: 600, context: "both")
}
