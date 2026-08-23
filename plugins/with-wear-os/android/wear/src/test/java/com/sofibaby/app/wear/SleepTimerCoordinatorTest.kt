package com.sofibaby.app.wear

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Test

class SleepTimerCoordinatorTest {
    @Test
    fun resetDropsDispatchedOldSessionSleepWork() {
        val work = mutableListOf<() -> Unit>()
        var writes = 0
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ ->
                writes += 1
                SleepTimerWriteOutcome.Success("2026-08-22T10:15:30.123Z")
            },
            refreshSummary = {},
            dispatch = work::add,
        )
        coordinator.start(active())

        coordinator.reset()
        work.single().invoke()

        assertEquals(0, writes)
        assertEquals(SleepTimerUiState.Idle, coordinator.state)
    }

    @Test
    fun snapshotRefreshDoesNotReplaceSubmittingSleepWork() {
        val work = mutableListOf<() -> Unit>()
        var writes = 0
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ ->
                writes += 1
                SleepTimerWriteOutcome.Success("2026-08-22T10:15:30.123Z")
            },
            refreshSummary = {},
            dispatch = work::add,
        )
        val snapshotTimer = ActivitySnapshot.ActiveTimer(
            type = "sleep",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "stale-timer",
            context = "nap",
            isRemote = false,
            isPaused = false,
            accumulatedSeconds = null,
        )

        coordinator.start(active())
        coordinator.restoreSnapshot(snapshotTimer)
        coordinator.start(active())

        assertEquals(SleepTimerUiState.Submitting, coordinator.state)
        assertEquals(1, work.size)
        work.single().invoke()
        assertEquals(1, writes)
        assertEquals("timer-1", (coordinator.state as SleepTimerUiState.SnapshotActive).timer.timerInstanceId)
    }

    @Test
    fun sameAccountPhoneSnapshotHydratesTheCompletionIdentity() {
        val hydrated = timer().copy(type = SleepType.Night)
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ -> SleepTimerWriteOutcome.Failed },
            refreshSummary = {},
            timerReader = { SleepTimerReadOutcome.Success(hydrated) },
        )
        val snapshotTimer = ActivitySnapshot.ActiveTimer(
            type = "sleep",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "timer-1",
            context = "night",
            isRemote = false,
            isPaused = false,
            accumulatedSeconds = null,
        )

        coordinator.restoreSnapshot(active(), snapshotTimer, Instant.parse("2026-08-22T10:05:00.000Z"))

        val state = coordinator.state as SleepTimerUiState.SnapshotActive
        assertEquals("sleep-1", state.timer.activityId)
        assertEquals(SleepType.Night, state.timer.type)
        assertEquals(300L, state.timer.elapsedSeconds)
    }

    @Test
    fun pauseAndResumePublishThePersistedSleepTimerState() {
        val paused = timer().copy(
            isPaused = true,
            accumulatedSeconds = 120,
            pausedAt = Instant.parse("2026-08-22T10:02:00.000Z"),
        )
        val resumed = paused.copy(
            isPaused = false,
            totalPausedMs = 30_000,
            pausedAt = null,
        )
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ -> SleepTimerWriteOutcome.Failed },
            refreshSummary = {},
            pauser = { _, _ -> SleepTimerMutationOutcome.Success(paused) },
            resumer = { _, _ -> SleepTimerMutationOutcome.Success(resumed) },
        )
        coordinator.restoreHydrated(timer())

        coordinator.pause(active())
        assertEquals(paused, (coordinator.state as SleepTimerUiState.SnapshotActive).timer)

        coordinator.resume(active())
        assertEquals(resumed, (coordinator.state as SleepTimerUiState.SnapshotActive).timer)
    }

    @Test
    fun pausePreparationFailureIsVisibleAndDoesNotLeaveSubmitting() {
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ -> SleepTimerWriteOutcome.Failed },
            refreshSummary = {},
            pauser = { _, _ -> error("missing hydrated activity identity") },
        )
        coordinator.restoreHydrated(timer().copy(activityId = null))

        coordinator.pause(active())

        assertEquals(
            SleepTimerUiState.Error("Could not pause sleep", canRetry = false),
            coordinator.state,
        )
    }

    @Test
    fun failedStopIsVisibleAndRetryReusesTheCompletedSleepDraft() {
        val attempts = mutableListOf<CompletedSleepDraft>()
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("sleep-1"))
        }
        var draftCreations = 0
        var refreshes = 0
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ -> SleepTimerWriteOutcome.Failed },
            refreshSummary = { refreshes += 1 },
            completionDrafts = { _, _ ->
                draftCreations += 1
                CompletedSleepDraft("sleep-1", "merge")
            },
            completionWriter = { _, draft ->
                attempts += draft
                outcomes.removeFirst()
            },
        )
        coordinator.restoreHydrated(timer())

        coordinator.stop(active())

        assertEquals(SleepTimerUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())
        assertEquals(SleepTimerUiState.Idle, coordinator.state)
        assertEquals(1, draftCreations)
        assertEquals(2, attempts.size)
        assertSame(attempts[0], attempts[1])
        assertEquals(1, refreshes)
    }

    @Test
    fun failedSleepStopRetryRemainsBoundToTheOriginatingBaby() {
        val attemptedBabies = mutableListOf<String>()
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("sleep-1"))
        }
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ -> SleepTimerWriteOutcome.Failed },
            refreshSummary = {},
            completionDrafts = { _, _ -> CompletedSleepDraft("sleep-1", "merge") },
            completionWriter = { session, _ ->
                attemptedBabies += session.baby.id
                outcomes.removeFirst()
            },
        )
        coordinator.restoreHydrated(timer())

        coordinator.stop(active("baby-1"))
        coordinator.retry(active("baby-2"))

        assertEquals(listOf("baby-1", "baby-1"), attemptedBabies)
        assertEquals(SleepTimerUiState.Idle, coordinator.state)
    }

    @Test
    fun successfulAutomaticStartPublishesAControllableTimerAndRefreshes() {
        var refreshes = 0
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ -> SleepTimerWriteOutcome.Success("2026-08-22T10:15:30.123+02:00") },
            refreshSummary = { refreshes += 1 },
        )

        coordinator.start(active())

        val state = coordinator.state as SleepTimerUiState.SnapshotActive
        assertEquals("sleep-1", state.timer.activityId)
        assertEquals(Instant.parse("2026-08-22T08:15:30.123Z"), state.timer.startedAt)
        assertEquals(SleepType.Nap, state.timer.type)
        assertEquals(true, state.timer.canControl)
        assertEquals(1, refreshes)
    }

    @Test
    fun startingWhileSleepIsActiveSurfacesTheExistingTimerAndRefreshes() {
        var refreshes = 0
        val coordinator = SleepTimerCoordinator(
            drafts = { draft() },
            starter = { _, _ ->
                SleepTimerWriteOutcome.AlreadyActive(
                    lockHolderId = "caregiver-2",
                    lockHolderName = "Sam",
                    startedAt = "2026-08-22T10:00:00.000Z",
                )
            },
            refreshSummary = { refreshes += 1 },
        )

        coordinator.start(active())

        assertEquals(
            SleepTimerUiState.AlreadyActive("Sam", "2026-08-22T10:00:00.000Z"),
            coordinator.state,
        )
        assertEquals(1, refreshes)
    }

    @Test
    fun phoneStartedSleepTimerIsRestoredFromTheSnapshot() {
        val coordinator = SleepTimerCoordinator(
            drafts = { _ -> error("start is not used") },
            starter = { _, _ -> error("start is not used") },
            refreshSummary = {},
        )
        val snapshotTimer = ActivitySnapshot.ActiveTimer(
            type = "sleep",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "phone-sleep-timer",
            context = "night",
            isRemote = true,
            isPaused = true,
            accumulatedSeconds = 90,
        )

        coordinator.restoreSnapshot(snapshotTimer, Instant.parse("2026-08-22T10:10:00.000Z"))

        val state = coordinator.state as SleepTimerUiState.SnapshotActive
        assertEquals("phone-sleep-timer", state.timer.timerInstanceId)
        assertEquals(SleepType.Night, state.timer.type)
        assertEquals(90L, state.timer.elapsedSeconds)
        assertFalse(state.timer.canControl)
    }

    private fun draft() = SleepTimerDraft(
        timerInstanceId = "timer-1",
        activityId = "sleep-1",
        startedAt = "2026-08-22T10:15:30.123Z",
        type = SleepType.Nap,
        rpcBody = "payload",
    )

    private fun active(babyId: String = "baby-1") = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = 3,
        account = WearSessionEnvelope.Account("user-1", "Alex"),
        baby = WearSessionEnvelope.Baby(babyId, "Sofi", "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = 2_000_000_000,
    )

    private fun timer() = RestoredSleepTimer(
        timerInstanceId = "timer-1",
        activityId = "sleep-1",
        startedAt = Instant.parse("2026-08-22T10:00:00.000Z"),
        type = SleepType.Nap,
        isPaused = false,
        accumulatedSeconds = null,
        totalPausedMs = 0,
        pausedAt = null,
        canControl = true,
        elapsedSeconds = 300,
    )
}
