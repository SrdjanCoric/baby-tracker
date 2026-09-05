import Foundation

@main
struct LiveActivityPushTokenTests {
    @MainActor static func main() async throws {
        var endings: LiveActivityDuplicateEndings? = LiveActivityDuplicateEndings()
        weak var weakEndings = endings
        var release: CheckedContinuation<Void, Never>?
        var completed = false
        let ending = endings!.start(id: "duplicate", operation: {
            await withCheckedContinuation { release = $0 }
        }, onEnded: { completed = true })
        while release == nil { await Task.yield() }
        endings!.cancelAll()
        endings = nil
        precondition(weakEndings == nil, "pending duplicate ending must not retain its owner")
        release!.resume()
        await ending.value
        precondition(!completed, "an invalidated duplicate ending must not mutate token state")

        let candidates = [
            LiveActivityStartCandidate(id: "legacy", activityType: "sleep", babyId: nil, timerInstanceId: nil, userId: nil),
            LiveActivityStartCandidate(id: "old", activityType: "sleep", babyId: "baby", timerInstanceId: "old", userId: "owner"),
            LiveActivityStartCandidate(id: "match", activityType: "sleep", babyId: "baby", timerInstanceId: "new", userId: "owner"),
            LiveActivityStartCandidate(id: "other", activityType: "feeding", babyId: nil, timerInstanceId: nil, userId: nil),
        ]
        let selection = selectLiveActivityStart(candidates, activityType: "sleep",
            identity: ["babyId": "baby", "timerInstanceId": "new", "userId": "owner"])
        precondition(selection.reuseId == "match")
        precondition(selection.endIds == ["legacy", "old"], "orphans must end even when a matching activity exists")
        let replacement = selectLiveActivityStart(Array(candidates.prefix(2)), activityType: "sleep",
            identity: ["babyId": "baby", "timerInstanceId": "new", "userId": "owner"])
        precondition(replacement.reuseId == nil && replacement.endIds == ["legacy", "old"])
        let suite = "live-activity-token-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = LiveActivityPushTokenStore(defaults: defaults)
        let device = store.deviceId
        store.updateStartToken("first")
        store.updateStartToken("rotated-start")
        let restarted = LiveActivityPushTokenStore(defaults: defaults)
        precondition(restarted.deviceId == device, "start token rotation must keep device identity")
        precondition(restarted.startToken == "rotated-start", "latest start token survives restart")
        let arrivals = [
            LiveActivityStartCandidate(id: "remote", activityType: "sleep", babyId: "baby", timerInstanceId: "run", userId: "member"),
            LiveActivityStartCandidate(id: "zz-local", activityType: "sleep", babyId: "baby", timerInstanceId: "run", userId: "member"),
            LiveActivityStartCandidate(id: "other-baby", activityType: "sleep", babyId: "other", timerInstanceId: "run", userId: "member"),
        ]
        precondition(duplicateLiveActivityIds(arrivals, preferredIds: ["zz-local"]) == ["remote"], "remote arrival must preserve the already tracked local activity")
        precondition(duplicateLiveActivityIds(arrivals, preferredIds: []) == ["zz-local"], "cold discovery must choose one deterministic survivor")
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
