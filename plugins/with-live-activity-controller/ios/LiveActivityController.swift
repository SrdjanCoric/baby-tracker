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
                pushType: nil
            )

            print("[LiveActivityController] Started activity: \(activity.id)")
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

            let elapsedSeconds = Int(Date().timeIntervalSince(activity.attributes.startTime))
            let updatedState = TimerActivityAttributes.ContentState(
                elapsedSeconds: elapsedSeconds,
                context: context
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
}
