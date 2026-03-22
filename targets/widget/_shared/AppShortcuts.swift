import AppIntents

@available(iOS 16.0, *)
struct SofiBabyShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartActivityIntent(),
            phrases: [
                "Start \(\.$activity) in \(.applicationName)",
                "Track \(\.$activity) in \(.applicationName)",
                "Begin \(\.$activity) in \(.applicationName)",
                "Log \(\.$activity) in \(.applicationName)",
                "Record \(\.$activity) in \(.applicationName)",
                "Baby fell asleep in \(.applicationName)",
                "Baby is sleeping in \(.applicationName)"
            ],
            shortTitle: "Start Activity",
            systemImageName: "play.fill"
        )
        AppShortcut(
            intent: StopActivityIntent(),
            phrases: [
                "Stop \(\.$activity) in \(.applicationName)",
                "End \(\.$activity) in \(.applicationName)",
                "Finish \(\.$activity) in \(.applicationName)",
                "Done with \(\.$activity) in \(.applicationName)",
                "Baby finished \(\.$activity) in \(.applicationName)",
                "Baby woke up in \(.applicationName)",
                "Baby is awake in \(.applicationName)"
            ],
            shortTitle: "Stop Activity",
            systemImageName: "stop.fill"
        )
        AppShortcut(
            intent: TogglePauseActivityIntent(),
            phrases: [
                "Pause \(\.$activity) in \(.applicationName)",
                "Resume \(\.$activity) in \(.applicationName)"
            ],
            shortTitle: "Pause/Resume",
            systemImageName: "pause.fill"
        )
        AppShortcut(
            intent: LogDiaperIntent(),
            phrases: [
                "Log \(\.$diaperType) diaper in \(.applicationName)",
                "Record \(\.$diaperType) diaper in \(.applicationName)",
                "Log diaper in \(.applicationName)"
            ],
            shortTitle: "Log Diaper",
            systemImageName: "leaf.fill"
        )
        AppShortcut(
            intent: QueryLastActivityIntent(),
            phrases: [
                "When was the last \(\.$activity) in \(.applicationName)",
                "Check \(\.$activity) in \(.applicationName)",
                "Last \(\.$activity) in \(.applicationName)",
                "How long since last \(\.$activity) in \(.applicationName)",
                "Time since \(\.$activity) in \(.applicationName)"
            ],
            shortTitle: "Check Activity",
            systemImageName: "clock.fill"
        )
        AppShortcut(
            intent: QueryActiveTimerIntent(),
            phrases: [
                "How long has \(\.$activity) been going in \(.applicationName)",
                "Check \(\.$activity) timer in \(.applicationName)"
            ],
            shortTitle: "Check Timer",
            systemImageName: "timer"
        )
        AppShortcut(
            intent: LogBottleFeedingIntent(),
            phrases: [
                "Log \(\.$feedingType) bottle in \(.applicationName)",
                "Record \(\.$feedingType) bottle in \(.applicationName)",
                "Log bottle feeding in \(.applicationName)",
                "Record bottle feeding in \(.applicationName)"
            ],
            shortTitle: "Log Bottle",
            systemImageName: "drop.fill"
        )
        AppShortcut(
            intent: QueryDailySummaryIntent(),
            phrases: [
                "How is the baby doing in \(.applicationName)",
                "Daily summary in \(.applicationName)",
                "Today's summary in \(.applicationName)"
            ],
            shortTitle: "Daily Summary",
            systemImageName: "chart.bar.fill"
        )
    }
}
