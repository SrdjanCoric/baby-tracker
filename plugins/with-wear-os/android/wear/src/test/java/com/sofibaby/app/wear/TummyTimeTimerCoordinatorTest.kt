package com.sofibaby.app.wear

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class TummyTimeTimerCoordinatorTest {
    @Test
    fun successfulStartPublishesTheActiveTimerBeforeRefreshingTheSnapshot() {
        lateinit var coordinator: TummyTimeTimerCoordinator
        var stateDuringRefresh: TummyTimeTimerUiState? = null
        coordinator = TummyTimeTimerCoordinator(
            drafts = { _ -> draft() },
            starter = { _, _ -> TummyTimeTimerWriteOutcome.Success("2026-08-22T10:00:00.000Z") },
            refreshSummary = { stateDuringRefresh = coordinator.state },
        )

        coordinator.start(active())

        assertTrue(stateDuringRefresh is TummyTimeTimerUiState.SnapshotActive)
    }

    @Test
    fun failedStartIsVisibleAndRetryReusesTheSameTimerDraft() {
        val attempts = mutableListOf<TummyTimeTimerDraft>()
        val outcomes = ArrayDeque<TummyTimeTimerWriteOutcome>().apply {
            add(TummyTimeTimerWriteOutcome.Offline)
            add(TummyTimeTimerWriteOutcome.Success("2026-08-22T10:00:00.000Z"))
        }
        var draftCreations = 0
        val coordinator = TummyTimeTimerCoordinator(
            drafts = { _ ->
                draftCreations += 1
                draft()
            },
            starter = { _, timerDraft ->
                attempts += timerDraft
                outcomes.removeFirst()
            },
            refreshSummary = {},
        )

        coordinator.start(active())
        assertEquals(TummyTimeTimerUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())

        assertTrue(coordinator.state is TummyTimeTimerUiState.SnapshotActive)
        assertEquals(1, draftCreations)
        assertEquals(2, attempts.size)
        assertSame(attempts[0], attempts[1])
    }

    @Test
    fun phoneSnapshotHydratesAControllablePausedTimer() {
        val hydrated = timer().copy(
            isPaused = true,
            pausedAt = Instant.parse("2026-08-22T10:04:00.000Z"),
            elapsedSeconds = 240,
        )
        val coordinator = TummyTimeTimerCoordinator(
            drafts = { _ -> draft() },
            starter = { _, _ -> TummyTimeTimerWriteOutcome.Failed },
            refreshSummary = {},
            timerReader = { TummyTimeTimerReadOutcome.Success(hydrated) },
        )
        val snapshot = ActivitySnapshot.ActiveTimer(
            type = "tummyTime",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "timer-1",
            context = null,
            isRemote = false,
            isPaused = true,
            accumulatedSeconds = 240,
        )

        coordinator.restoreSnapshot(active(), snapshot, Instant.parse("2026-08-22T10:05:00.000Z"))

        assertEquals(
            hydrated.copy(elapsedSeconds = 240),
            (coordinator.state as TummyTimeTimerUiState.SnapshotActive).timer,
        )
    }

    @Test
    fun failedHydrationIsVisibleAndRetryRestoresTheOwnedTimer() {
        val outcomes = ArrayDeque<TummyTimeTimerReadOutcome>().apply {
            add(TummyTimeTimerReadOutcome.Offline)
            add(TummyTimeTimerReadOutcome.Success(timer()))
        }
        val coordinator = TummyTimeTimerCoordinator(
            drafts = { _ -> draft() },
            starter = { _, _ -> TummyTimeTimerWriteOutcome.Failed },
            refreshSummary = {},
            timerReader = { outcomes.removeFirst() },
        )
        val snapshot = ActivitySnapshot.ActiveTimer(
            type = "tummyTime",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "timer-1",
            context = null,
            isRemote = false,
            isPaused = false,
            accumulatedSeconds = null,
        )

        coordinator.restoreSnapshot(active(), snapshot, Instant.parse("2026-08-22T10:05:00.000Z"))
        assertEquals(TummyTimeTimerUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())

        assertTrue(coordinator.state is TummyTimeTimerUiState.SnapshotActive)
    }

    @Test
    fun failedStopIsVisibleAndRetryReusesTheSameCompletedDraft() {
        val attempts = mutableListOf<CompletedTummyTimeDraft>()
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("tummy-1"))
        }
        var draftCreations = 0
        var refreshes = 0
        val coordinator = TummyTimeTimerCoordinator(
            drafts = { _ -> draft() },
            starter = { _, _ -> TummyTimeTimerWriteOutcome.Failed },
            refreshSummary = { refreshes += 1 },
            completionDrafts = { _, _ ->
                draftCreations += 1
                CompletedTummyTimeDraft("tummy-1", "merge")
            },
            completionWriter = { _, completed ->
                attempts += completed
                outcomes.removeFirst()
            },
        )
        coordinator.restoreHydrated(timer())

        coordinator.stop(active())
        assertEquals(TummyTimeTimerUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())

        assertEquals(TummyTimeTimerUiState.Idle, coordinator.state)
        assertEquals(1, draftCreations)
        assertEquals(2, attempts.size)
        assertSame(attempts[0], attempts[1])
        assertEquals(1, refreshes)
    }

    @Test
    fun pauseAndResumePublishThePersistedTummyTimeTimerState() {
        var refreshes = 0
        val coordinator = TummyTimeTimerCoordinator(
            drafts = { _ -> draft() },
            starter = { _, _ -> TummyTimeTimerWriteOutcome.Failed },
            refreshSummary = { refreshes += 1 },
            pauser = { _, timer ->
                TummyTimeTimerMutationOutcome.Success(
                    timer.copy(
                        isPaused = true,
                        pausedAt = Instant.parse("2026-08-22T10:05:00.000Z"),
                    ),
                )
            },
            resumer = { _, timer ->
                TummyTimeTimerMutationOutcome.Success(timer.copy(isPaused = false, pausedAt = null))
            },
        )
        coordinator.restoreHydrated(timer())

        coordinator.pause(active())
        assertTrue((coordinator.state as TummyTimeTimerUiState.SnapshotActive).timer.isPaused)
        coordinator.resume(active())

        assertTrue(!(coordinator.state as TummyTimeTimerUiState.SnapshotActive).timer.isPaused)
        assertEquals(2, refreshes)
    }

    private fun draft() = TummyTimeTimerDraft(
        timerInstanceId = "timer-1",
        activityId = "tummy-1",
        startedAt = "2026-08-22T10:00:00.000Z",
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

    private fun timer() = RestoredTummyTimeTimer(
        timerInstanceId = "timer-1",
        activityId = "tummy-1",
        startedAt = Instant.parse("2026-08-22T10:00:00.000Z"),
        isPaused = false,
        totalPausedMs = 0,
        pausedAt = null,
        canControl = true,
        elapsedSeconds = 300,
    )
}
