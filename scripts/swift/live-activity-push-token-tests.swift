import Foundation

@main
struct LiveActivityPushTokenTests {
    static func main() throws {
        let suite = "live-activity-token-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = LiveActivityPushTokenStore(defaults: defaults)
        store.bind(activityId: "a", babyId: "baby", timerInstanceId: "run", userId: "owner")
        store.updateToken(activityId: "a", token: "old")
        store.updateToken(activityId: "a", token: "rotated")
        let restored = LiveActivityPushTokenStore(defaults: defaults)
        precondition(restored.records.first?.token == "rotated", "rotation must survive restart")
        precondition(restored.records.first?.timerInstanceId == "run")
        restored.markEnded(activityId: "a")
        restored.updateToken(activityId: "a", token: "late")
        precondition(restored.records.first?.ended == true, "late token cannot revive an ended activity")
        restored.bind(activityId: "a", babyId: "other", timerInstanceId: "other", userId: "other")
        precondition(restored.records.first?.timerInstanceId == "run", "activity identity is immutable")
        precondition(restored.records.first?.userId == "owner", "auth changes cannot reassign a token")
        restored.acknowledgeEnd(activityId: "a")
        precondition(LiveActivityPushTokenStore(defaults: defaults).records.isEmpty, "acknowledged cleanup persists")
        print("PASS: Live Activity token rotation, persistence, end races, and account isolation")
    }
}
