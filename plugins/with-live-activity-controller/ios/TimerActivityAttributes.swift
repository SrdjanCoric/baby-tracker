import Foundation
import ActivityKit

// IMPORTANT: This struct is duplicated in targets/widget/LiveActivity.swift
// Both definitions MUST stay in sync. The widget extension is a separate compilation unit
// and cannot share code with the main app target.
struct TimerActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsedSeconds: Int
        var context: String?
    }

    var activityType: String
    var babyName: String
    var startTime: Date
}
