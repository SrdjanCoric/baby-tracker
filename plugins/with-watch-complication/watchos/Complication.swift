import SwiftUI
import WidgetKit

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

// MARK: - Entry Point

@main
struct SofiBabyComplicationBundle: WidgetBundle {
    var body: some Widget {
        AppLauncherComplication()
    }
}
