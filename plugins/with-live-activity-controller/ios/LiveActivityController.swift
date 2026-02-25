import Foundation
import ActivityKit
import React

@objc(LiveActivityController)
class LiveActivityController: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool {
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
        guard #available(iOS 16.2, *) else {
            resolve(nil)
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            print("[LiveActivityController] Activities not enabled")
            resolve(nil)
            return
        }

        // Check for existing activity of the same type (may have been started via push-to-start)
        let existingActivity = Activity<TimerActivityAttributes>.activities.first {
            $0.attributes.activityType == activityType
        }
        if let existing = existingActivity {
            print("[LiveActivityController] Reusing existing activity (push-to-start): \(existing.id) type=\(activityType)")
            Task {
                for await tokenData in existing.pushTokenUpdates {
                    let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
                    if let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app") {
                        userDefaults.set(tokenString, forKey: "liveActivityPushToken")
                    }
                }
            }
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
            startTime: activityStartTime
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

            Task {
                for await tokenData in activity.pushTokenUpdates {
                    let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
                    if let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app") {
                        userDefaults.set(tokenString, forKey: "liveActivityPushToken")
                    }
                }
            }

            resolve(activity.id)
        } catch {
            print("[LiveActivityController] Failed to start: \(error.localizedDescription)")
            reject("START_FAILED", error.localizedDescription, error)
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

        Task {
            for activity in Activity<TimerActivityAttributes>.activities {
                print("[LiveActivityController] Monitoring existing activity: \(activity.id) type=\(activity.attributes.activityType)")
                Task {
                    for await tokenData in activity.pushTokenUpdates {
                        let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
                        print("[LiveActivityController] Push token for existing activity \(activity.id): \(tokenString.prefix(12))...")
                        if let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app") {
                            userDefaults.set(tokenString, forKey: "liveActivityPushToken")
                        }
                    }
                }
            }
        }

        Task {
            for await activity in Activity<TimerActivityAttributes>.activityUpdates {
                print("[LiveActivityController] New activity detected via activityUpdates: \(activity.id) type=\(activity.attributes.activityType)")
                Task {
                    for await tokenData in activity.pushTokenUpdates {
                        let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
                        print("[LiveActivityController] Push token for new activity \(activity.id): \(tokenString.prefix(12))...")
                        if let userDefaults = UserDefaults(suiteName: "group.com.sofibaby.app") {
                            userDefaults.set(tokenString, forKey: "liveActivityPushToken")
                        }
                    }
                }
            }
        }

        resolve(true)
    }
}
