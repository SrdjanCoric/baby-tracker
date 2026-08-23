package com.sofibaby.app.wear

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class FeedingTimerCoordinatorTest {
    @Test
    fun malformedPersistedStartBecomesANonRetryableError() {
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft -> TimerWriteOutcome.Success(draft, "not-a-timestamp") },
            refreshSummary = {},
        )

        coordinator.start(active(), BreastSide.Left)

        assertEquals(
            FeedingTimerUiState.Error("Could not start feeding", canRetry = false),
            coordinator.state,
        )
    }

    @Test
    fun successfulStartAcceptsPostgrestOffsetTimestamp() {
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft ->
                TimerWriteOutcome.Success(draft, "2026-08-22T12:15:30.123+02:00")
            },
            refreshSummary = {},
        )

        coordinator.start(active(), BreastSide.Right)

        val state = coordinator.state as FeedingTimerUiState.SnapshotActive
        assertEquals(Instant.parse("2026-08-22T10:15:30.123Z"), state.timer.startedAt)
    }

    @Test
    fun startingWhileFeedingIsActiveSurfacesExistingTimerAndRefreshesSnapshot() {
        var refreshes = 0
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, _ ->
                TimerWriteOutcome.AlreadyActive(
                    lockHolderId = "caregiver-2",
                    lockHolderName = "Sam",
                    startedAt = "2026-08-22T10:00:00.000Z",
                )
            },
            refreshSummary = { refreshes += 1 },
        )

        coordinator.start(active(), BreastSide.Right)

        assertEquals(
            FeedingTimerUiState.AlreadyActive("Sam", "2026-08-22T10:00:00.000Z"),
            coordinator.state,
        )
        assertEquals(1, refreshes)
    }

    @Test
    fun restartRestoresWatchStartedTimerFromSnapshotWithCorrectElapsedTime() {
        val snapshotTimer = ActivitySnapshot.ActiveTimer(
            type = "feeding",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "timer-1",
            context = "right",
            isRemote = false,
            isPaused = false,
            accumulatedSeconds = null,
        )

        val restored = FeedingTimerRestorer.restore(
            snapshotTimer,
            now = Instant.parse("2026-08-22T10:05:05.000Z"),
        )

        val timer = requireNotNull(restored)
        assertEquals(BreastSide.Right, timer.side)
        assertEquals("timer-1", timer.timerInstanceId)
        assertEquals(305L, timer.elapsedSeconds)
        assertEquals(true, timer.canControl)
    }

    @Test
    fun phoneStartedSnapshotIsVisibleWithoutOfferingRemoteControls() {
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft -> TimerWriteOutcome.Success(draft, draft.startedAt) },
            refreshSummary = {},
        )
        val snapshotTimer = ActivitySnapshot.ActiveTimer(
            type = "feeding",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "phone-timer",
            context = "Sam",
            isRemote = true,
            isPaused = true,
            accumulatedSeconds = 90,
        )

        coordinator.restoreSnapshot(snapshotTimer, Instant.parse("2026-08-22T10:10:00.000Z"))

        val state = coordinator.state as FeedingTimerUiState.SnapshotActive
        assertEquals("phone-timer", state.timer.timerInstanceId)
        assertEquals(90L, state.timer.elapsedSeconds)
        assertEquals(false, state.timer.canControl)
    }

    @Test
    fun failedStopIsVisibleAndRetryReusesTheCompletedFeedingDraft() {
        val attempts = mutableListOf<CompletedFeedingDraft>()
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("feeding-1"))
        }
        var draftCreations = 0
        var refreshes = 0
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft -> TimerWriteOutcome.Success(draft, draft.startedAt) },
            refreshSummary = { refreshes += 1 },
            completionDrafts = { _, _ ->
                draftCreations += 1
                CompletedFeedingDraft("feeding-1", "merge", "release")
            },
            completionWriter = { _, draft ->
                attempts += draft
                outcomes.removeFirst()
            },
        )
        coordinator.restoreHydrated(hydratedTimer())

        coordinator.stop(active())

        assertEquals(FeedingTimerUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())
        assertEquals(FeedingTimerUiState.Idle, coordinator.state)
        assertEquals(1, draftCreations)
        assertEquals(2, attempts.size)
        assertSame(attempts[0], attempts[1])
        assertEquals(1, refreshes)
    }

    @Test
    fun completionDraftFailureIsNonRetryableAndFreshSnapshotRecovers() {
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft -> TimerWriteOutcome.Success(draft, draft.startedAt) },
            refreshSummary = {},
            completionDrafts = { _, _ -> error("stale snapshot cannot be completed") },
        )
        coordinator.restoreHydrated(hydratedTimer())

        coordinator.stop(active())

        assertEquals(
            FeedingTimerUiState.Error("Could not stop feeding", canRetry = false),
            coordinator.state,
        )
        coordinator.restoreSnapshot(
            ActivitySnapshot.ActiveTimer(
                type = "feeding",
                startTime = "2026-08-22T10:00:00.000Z",
                timerInstanceId = "timer-2",
                context = "right",
                isRemote = true,
                isPaused = false,
                accumulatedSeconds = null,
            ),
        )
        val recovered = coordinator.state as FeedingTimerUiState.SnapshotActive
        assertEquals("timer-2", recovered.timer.timerInstanceId)
    }

    @Test
    fun snapshotRefreshDoesNotReplaceAFailedStopRetry() {
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("feeding-1"))
        }
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft -> TimerWriteOutcome.Success(draft, draft.startedAt) },
            refreshSummary = {},
            completionDrafts = { _, _ -> CompletedFeedingDraft("feeding-1", "merge", "release") },
            completionWriter = { _, _ -> outcomes.removeFirst() },
        )
        coordinator.restoreHydrated(hydratedTimer())
        coordinator.stop(active())
        val snapshotTimer = ActivitySnapshot.ActiveTimer(
            type = "feeding",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "timer-1",
            context = "left",
            isRemote = false,
            isPaused = false,
            accumulatedSeconds = null,
        )

        coordinator.restoreSnapshot(snapshotTimer)

        assertEquals(FeedingTimerUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())
        assertEquals(FeedingTimerUiState.Idle, coordinator.state)
    }

    @Test
    fun unauthorizedTimerControlExpiresSessionAndCannotRetry() {
        val unauthorized = mutableListOf<Long>()
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft -> TimerWriteOutcome.Success(draft, draft.startedAt) },
            refreshSummary = {},
            pauser = { _, _ -> TimerMutationOutcome.Unauthorized },
            onUnauthorized = unauthorized::add,
        )
        coordinator.restoreHydrated(hydratedTimer())

        coordinator.pause(active())

        assertEquals(listOf(3L), unauthorized)
        assertEquals(FeedingTimerUiState.Error("Session expired", canRetry = false), coordinator.state)
    }

    @Test
    fun failedBottleLogIsVisibleAndRetryReusesDraft() {
        val attempts = mutableListOf<BottleFeedingDraft>()
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("bottle-1"))
        }
        var creations = 0
        val coordinator = BottleLogCoordinator(
            drafts = { _, selection ->
                creations += 1
                BottleFeedingDraft("bottle-1", selection, "payload")
            },
            writer = { _, draft ->
                attempts += draft
                outcomes.removeFirst()
            },
            refreshSummary = {},
        )

        coordinator.submit(active(), BottleLogSelection())
        assertEquals(BottleLogUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())

        assertEquals(BottleLogUiState.Success, coordinator.state)
        assertEquals(1, creations)
        assertSame(attempts[0], attempts[1])
    }

    @Test
    fun resetDropsDispatchedOldSessionFeedingAndBottleWork() {
        val feedingWork = mutableListOf<() -> Unit>()
        var feedingWrites = 0
        val feeding = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft ->
                feedingWrites += 1
                TimerWriteOutcome.Success(draft, draft.startedAt)
            },
            refreshSummary = {},
            dispatch = feedingWork::add,
        )
        feeding.start(active(), BreastSide.Left)

        feeding.reset()
        feedingWork.single().invoke()

        assertEquals(0, feedingWrites)
        assertEquals(FeedingTimerUiState.Idle, feeding.state)

        val bottleWork = mutableListOf<() -> Unit>()
        var bottleWrites = 0
        val bottle = BottleLogCoordinator(
            drafts = { _, selection -> BottleFeedingDraft("bottle-1", selection, "payload") },
            writer = { _, _ ->
                bottleWrites += 1
                WriteOutcome.Success("bottle-1")
            },
            refreshSummary = {},
            dispatch = bottleWork::add,
        )
        bottle.submit(active(), BottleLogSelection())

        bottle.reset()
        bottleWork.single().invoke()

        assertEquals(0, bottleWrites)
        assertEquals(BottleLogUiState.Idle, bottle.state)
    }

    @Test
    fun ownerSnapshotRestoreHydratesCompletionState() {
        val coordinator = FeedingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft -> TimerWriteOutcome.Success(draft, draft.startedAt) },
            refreshSummary = {},
            timerReader = { TimerReadOutcome.Success(hydratedTimer()) },
        )
        val snapshotTimer = ActivitySnapshot.ActiveTimer(
            type = "feeding",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "timer-1",
            context = "left",
            isRemote = false,
            isPaused = false,
            accumulatedSeconds = null,
        )

        coordinator.restoreSnapshot(active(), snapshotTimer, Instant.parse("2026-08-22T10:05:00.000Z"))

        val state = coordinator.state as FeedingTimerUiState.SnapshotActive
        assertEquals("feeding-1", state.timer.activityId)
        assertEquals(300L, state.timer.elapsedSeconds)
    }

    private fun draft(side: BreastSide) = FeedingTimerDraft(
        timerInstanceId = "timer-1",
        activityId = "feeding-1",
        startedAt = "2026-08-22T10:15:30.123Z",
        side = side,
        rpcBody = "payload",
    )

    private fun active() = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = 3,
        account = WearSessionEnvelope.Account("user-1", "Alex"),
        baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = 2_000_000_000,
    )

    private fun hydratedTimer() = RestoredFeedingTimer(
        timerInstanceId = "timer-1",
        activityId = "feeding-1",
        startedAt = Instant.parse("2026-08-22T10:00:00.000Z"),
        side = BreastSide.Left,
        leftAccumulatedSeconds = 0,
        rightAccumulatedSeconds = 0,
        currentSideStartedAt = Instant.parse("2026-08-22T10:00:00.000Z"),
        isPaused = false,
        accumulatedSeconds = null,
        totalPausedMs = 0,
        pausedAt = null,
        canControl = true,
        elapsedSeconds = 300,
    )
}
