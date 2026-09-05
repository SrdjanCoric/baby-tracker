import Foundation

// Accessed on the main actor by the ActivityKit bridge. Keep end tombstones until
// the app acknowledges server cleanup, including across process death.
final class LiveActivityPushTokenStore {
    struct Record: Codable {
        let activityId: String
        let babyId: String
        let timerInstanceId: String
        let userId: String
        var token: String?
        var ended: Bool = false
    }

    private let defaults: UserDefaults
    private let key = "liveActivityPushRecordsV1"
    private var byId: [String: Record]
    var records: [Record] { Array(byId.values) }

    init(defaults: UserDefaults) {
        self.defaults = defaults
        byId = defaults.data(forKey: key).flatMap {
            try? JSONDecoder().decode([String: Record].self, from: $0)
        } ?? [:]
    }

    func bind(activityId: String, babyId: String, timerInstanceId: String, userId: String) {
        guard byId[activityId] == nil else { return }
        byId[activityId] = Record(activityId: activityId, babyId: babyId,
                                  timerInstanceId: timerInstanceId, userId: userId)
        persist()
    }

    func updateToken(activityId: String, token: String) {
        guard var record = byId[activityId], !record.ended else { return }
        record.token = token
        byId[activityId] = record
        persist()
    }

    func markEnded(activityId: String) {
        guard var record = byId[activityId] else { return }
        record.ended = true
        byId[activityId] = record
        persist()
    }

    func acknowledgeEnd(activityId: String) {
        guard byId[activityId]?.ended == true else { return }
        byId.removeValue(forKey: activityId)
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(byId) { defaults.set(data, forKey: key) }
    }
}

// Foundation-only selection keeps duplicate handling testable without ActivityKit.
struct LiveActivityStartCandidate {
    let id: String
    let activityType: String
    let babyId: String?
    let timerInstanceId: String?
    let userId: String?
}

func selectLiveActivityStart(
    _ candidates: [LiveActivityStartCandidate], activityType: String, identity: [String: String]?
) -> (reuseId: String?, endIds: [String]) {
    let sameType = candidates.filter { $0.activityType == activityType }
    let reusable = sameType.first {
        identity == nil || ($0.babyId == identity?["babyId"] &&
            $0.timerInstanceId == identity?["timerInstanceId"] && $0.userId == identity?["userId"])
    }
    return (reusable?.id, sameType.filter { $0.id != reusable?.id }.map { $0.id })
}
