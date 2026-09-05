import Foundation
import ActivityKit
import React

@objc(LiveActivityController)
class LiveActivityController: RCTEventEmitter {
    @MainActor private var tokenStore = LiveActivityPushTokenStore(defaults: .standard)
    @MainActor private var tokenObservers: [String: Task<Void, Never>] = [:]
    @MainActor private var stateObservers: [String: Task<Void, Never>] = [:]
    @MainActor private var activityObserver: Task<Void, Never>?
    @MainActor private var hasTokenListeners = false

    override func supportedEvents() -> [String]! { ["LiveActivityPushRecordsChanged"] }

    override func startObserving() {
        Task { @MainActor in
            self.hasTokenListeners = true
            if #available(iOS 16.2, *) { self.observeActivities() }
        }
    }

    override func stopObserving() {
        Task { @MainActor in self.hasTokenListeners = false }
    }

    override func invalidate() {
        Task { @MainActor in
            self.activityObserver?.cancel()
            self.activityObserver = nil
            self.tokenObservers.values.forEach { $0.cancel() }
            self.stateObservers.values.forEach { $0.cancel() }
            self.tokenObservers.removeAll()
            self.stateObservers.removeAll()
        }
        super.invalidate()
    }

    @MainActor private func notifyTokenChange() {
        if hasTokenListeners { sendEvent(withName: "LiveActivityPushRecordsChanged", body: nil) }
    }

    @available(iOS 16.2, *)
    @MainActor private func observeActivities() {
        for activity in Activity<TimerActivityAttributes>.activities { observe(activity) }
        guard activityObserver == nil else { return }
        activityObserver = Task { @MainActor [weak self] in
            for await activity in Activity<TimerActivityAttributes>.activityUpdates {
                guard !Task.isCancelled else { return }
                self?.observe(activity)
            }
        }
    }

    @available(iOS 16.2, *)
    @MainActor private func observe(_ activity: Activity<TimerActivityAttributes>) {
        guard activity.activityState == .active || activity.activityState == .stale else { return }
        let attrs = activity.attributes
        if let babyId = attrs.babyId, let instance = attrs.timerInstanceId, let userId = attrs.userId {
            tokenStore.bind(activityId: activity.id, babyId: babyId, timerInstanceId: instance, userId: userId)
        }
        guard tokenObservers[activity.id] == nil else { return }
        if let token = activity.pushToken { receiveToken(token, activityId: activity.id) }
        tokenObservers[activity.id] = Task { @MainActor [weak self] in
            for await token in activity.pushTokenUpdates {
                guard !Task.isCancelled else { return }
                self?.receiveToken(token, activityId: activity.id)
            }
        }
        stateObservers[activity.id] = Task { @MainActor [weak self] in
            for await state in activity.activityStateUpdates {
                guard !Task.isCancelled else { return }
                if state == .ended || state == .dismissed {
                    self?.recordEnded(activity.id)
                    return
                }
            }
        }
    }

    @MainActor private func receiveToken(_ data: Data, activityId: String) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        // Retain the legacy widget/Watch action key during the additive rollout.
        UserDefaults(suiteName: "group.com.sofibaby.app")?.set(token, forKey: "liveActivityPushToken")
        tokenStore.updateToken(activityId: activityId, token: token)
        notifyTokenChange()
    }

    @MainActor private func recordEnded(_ activityId: String) {
        tokenStore.markEnded(activityId: activityId)
        tokenObservers.removeValue(forKey: activityId)?.cancel()
        stateObservers.removeValue(forKey: activityId)?.cancel()
        notifyTokenChange()
    }

    @objc func getLiveActivityPushRecords(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            if #available(iOS 16.2, *) {
                observeActivities()
                let runningIds = Set(Activity<TimerActivityAttributes>.activities.filter {
                    $0.activityState == .active || $0.activityState == .stale
                }.map { $0.id })
                for record in tokenStore.records where !runningIds.contains(record.activityId) {
                    tokenStore.markEnded(activityId: record.activityId)
                }
            }
            let data = try? JSONEncoder().encode(tokenStore.records)
            resolve(data.flatMap { try? JSONSerialization.jsonObject(with: $0) } ?? [])
        }
    }

    @objc func bindTimerActivity(
        _ activityId: String, identity: [String: String],
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            guard let babyId = identity["babyId"], let instance = identity["timerInstanceId"],
                  let userId = identity["userId"] else { resolve(nil); return }
            tokenStore.bind(activityId: activityId, babyId: babyId, timerInstanceId: instance, userId: userId)
            if #available(iOS 16.2, *), let activity = Activity<TimerActivityAttributes>.activities.first(where: { $0.id == activityId }) {
                observe(activity)
                if let token = activity.pushToken { receiveToken(token, activityId: activityId) }
            } else {
                recordEnded(activityId)
            }
            notifyTokenChange()
            resolve(nil)
        }
    }

    @objc func acknowledgeLiveActivityEnd(
        _ activityId: String, resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in tokenStore.acknowledgeEnd(activityId: activityId); resolve(nil) }
    }

    @objc override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc func startTimerActivity(
        _ activityType: String,
        babyName: String,
        context: String?,
        startTimeISO: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        startTimerActivityWithIdentity(activityType, babyName: babyName, context: context,
            startTimeISO: startTimeISO, identity: nil, resolver: resolve, rejecter: reject)
    }

    @objc func startTimerActivityWithIdentity(
        _ activityType: String, babyName: String, context: String?, startTimeISO: String?,
        identity: [String: String]?, resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            guard #available(iOS 16.2, *) else {
                resolve(nil)
                return
            }

            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                print("[LiveActivityController] Activities not enabled")
                resolve(nil)
                return
            }

            let activities = Activity<TimerActivityAttributes>.activities.filter {
                $0.activityState == .active || $0.activityState == .stale
            }
            let selection = selectLiveActivityStart(activities.map {
                LiveActivityStartCandidate(id: $0.id, activityType: $0.attributes.activityType,
                    babyId: $0.attributes.babyId, timerInstanceId: $0.attributes.timerInstanceId,
                    userId: $0.attributes.userId)
            }, activityType: activityType, identity: identity)
            for activity in activities where selection.endIds.contains(activity.id) {
                await activity.end(activity.content, dismissalPolicy: .immediate)
                recordEnded(activity.id)
            }
            if let existing = activities.first(where: { $0.id == selection.reuseId }) {
                print("[LiveActivityController] Reusing existing activity (push-to-start): \(existing.id) type=\(activityType)")
                observe(existing)
                resolve(existing.id)
                return
            }

            var activityStartTime = Date()
            if let iso = startTimeISO {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let parsed = formatter.date(from: iso) {
                    activityStartTime = parsed
                }
            }

            let attributes = TimerActivityAttributes(
                activityType: activityType,
                babyName: babyName,
                startTime: activityStartTime,
                babyId: identity?["babyId"],
                timerInstanceId: identity?["timerInstanceId"],
                userId: identity?["userId"]
            )

            let initialState = TimerActivityAttributes.ContentState(
                elapsedSeconds: 0,
                context: context
            )

            do {
                let activity = try Activity<TimerActivityAttributes>.request(
                    attributes: attributes,
                    content: .init(state: initialState, staleDate: nil),
                    pushType: .token
                )

                print("[LiveActivityController] Started activity: \(activity.id)")

                observe(activity)

                resolve(activity.id)
            } catch {
                print("[LiveActivityController] Failed to start: \(error.localizedDescription)")
                reject("START_FAILED", error.localizedDescription, error)
            }
        }
    }

    @objc func updateTimerActivity(
        _ activityId: String,
        context: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        Task {
            let activities = Activity<TimerActivityAttributes>.activities
            guard let activity = activities.first(where: { $0.id == activityId }) else {
                print("[LiveActivityController] Activity not found: \(activityId)")
                resolve(false)
                return
            }

            let currentState = activity.content.state
            let updatedState = TimerActivityAttributes.ContentState(
                elapsedSeconds: currentState.elapsedSeconds,
                context: context,
                isPaused: currentState.isPaused,
                effectiveStartTimeISO: currentState.effectiveStartTimeISO
            )

            await activity.update(
                ActivityContent(state: updatedState, staleDate: nil)
            )

            print("[LiveActivityController] Updated activity: \(activityId)")
            resolve(true)
        }
    }

    @objc func endTimerActivity(
        _ activityId: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        Task {
            let activities = Activity<TimerActivityAttributes>.activities
            guard let activity = activities.first(where: { $0.id == activityId }) else {
                print("[LiveActivityController] Activity not found: \(activityId)")
                resolve(false)
                return
            }

            let finalState = TimerActivityAttributes.ContentState(
                elapsedSeconds: Int(Date().timeIntervalSince(activity.attributes.startTime)),
                context: activity.content.state.context
            )

            await activity.end(
                ActivityContent(state: finalState, staleDate: nil),
                dismissalPolicy: .immediate
            )

            await MainActor.run { self.recordEnded(activityId) }
            print("[LiveActivityController] Ended activity: \(activityId)")
            resolve(true)
        }
    }

    @objc func endAllActivities(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 16.2, *) else {
            resolve(nil)
            return
        }

        Task {
            for activity in Activity<TimerActivityAttributes>.activities {
                let finalState = TimerActivityAttributes.ContentState(
                    elapsedSeconds: Int(Date().timeIntervalSince(activity.attributes.startTime)),
                    context: activity.content.state.context
                )

                await activity.end(
                    ActivityContent(state: finalState, staleDate: nil),
                    dismissalPolicy: .immediate
                )
                await MainActor.run { self.recordEnded(activity.id) }
            }

            print("[LiveActivityController] Ended all activities")
            resolve(nil)
        }
    }

    @objc func endActivityByType(
        _ activityType: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        Task {
            var endedAny = false
            for activity in Activity<TimerActivityAttributes>.activities {
                if activity.attributes.activityType == activityType {
                    let finalState = TimerActivityAttributes.ContentState(
                        elapsedSeconds: Int(Date().timeIntervalSince(activity.attributes.startTime)),
                        context: activity.content.state.context
                    )

                    await activity.end(
                        ActivityContent(state: finalState, staleDate: nil),
                        dismissalPolicy: .immediate
                    )

                    await MainActor.run { self.recordEnded(activity.id) }
                    endedAny = true
                    print("[LiveActivityController] Ended activity by type: \(activityType)")
                }
            }
            resolve(endedAny)
        }
    }

    @objc func pauseTimerActivity(
        _ activityId: String,
        activeElapsedSeconds: NSNumber,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        Task {
            let activities = Activity<TimerActivityAttributes>.activities
            guard let activity = activities.first(where: { $0.id == activityId }) else {
                print("[LiveActivityController] Activity not found: \(activityId)")
                resolve(false)
                return
            }

            let pausedState = TimerActivityAttributes.ContentState(
                elapsedSeconds: Int(activeElapsedSeconds.doubleValue),
                context: activity.content.state.context,
                isPaused: true
            )

            await activity.update(
                ActivityContent(state: pausedState, staleDate: nil)
            )

            print("[LiveActivityController] Paused activity: \(activityId)")
            resolve(true)
        }
    }

    @objc func resumeTimerActivity(
        _ activityId: String,
        activeElapsedSeconds: NSNumber,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        Task {
            let activities = Activity<TimerActivityAttributes>.activities
            guard let activity = activities.first(where: { $0.id == activityId }) else {
                print("[LiveActivityController] Activity not found: \(activityId)")
                resolve(false)
                return
            }

            let elapsed = activeElapsedSeconds.doubleValue
            let effectiveStart = Date().addingTimeInterval(-elapsed)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

            let resumedState = TimerActivityAttributes.ContentState(
                elapsedSeconds: Int(elapsed),
                context: activity.content.state.context,
                isPaused: false,
                effectiveStartTimeISO: formatter.string(from: effectiveStart)
            )

            await activity.update(
                ActivityContent(state: resumedState, staleDate: nil)
            )

            print("[LiveActivityController] Resumed activity: \(activityId)")
            resolve(true)
        }
    }

    @objc func isActivityRunning(
        _ activityId: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        Task {
            let activities = Activity<TimerActivityAttributes>.activities
            let isRunning = activities.contains { $0.id == activityId }
            print("[LiveActivityController] Activity \(activityId) running: \(isRunning)")
            resolve(isRunning)
        }
    }

    @objc func registerPushToStart(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 17.2, *) else {
            resolve(nil)
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            resolve(nil)
            return
        }

        Task {
            for await tokenData in Activity<TimerActivityAttributes>.pushToStartTokenUpdates {
                let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
                if let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app") {
                    userDefaults.set(tokenString, forKey: "pushToStartToken")
                }
                print("[LiveActivityController] Push-to-start token: \(tokenString.prefix(12))...")
            }
        }

        Task { @MainActor in observeActivities() }

        resolve(true)
    }
}
