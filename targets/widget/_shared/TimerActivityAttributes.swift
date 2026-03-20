import Foundation
import ActivityKit

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
