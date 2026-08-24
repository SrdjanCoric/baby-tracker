package com.sofibaby.app.wear

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class PumpingTimerCoordinatorTest {
    @Test
    fun startsEachSupportedSideAndRefreshesTheSharedSnapshot() {
        val started = mutableListOf<BreastSide>()
        var refreshes = 0
        val coordinator = PumpingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, draft ->
                started += draft.side
                PumpingTimerWriteOutcome.Success("2026-08-22T10:00:00.000Z")
            },
            refreshSummary = { refreshes += 1 },
        )

        BreastSide.entries.forEach { side ->
            coordinator.reset()
            coordinator.start(active(), side)
        }

        assertEquals(listOf(BreastSide.Left, BreastSide.Right, BreastSide.Both), started)
        assertEquals(3, refreshes)
    }

    @Test
    fun successfulStartPublishesTheActiveTimerBeforeRefreshingTheSnapshot() {
        lateinit var coordinator: PumpingTimerCoordinator
        var stateDuringRefresh: PumpingTimerUiState? = null
        coordinator = PumpingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, _ -> PumpingTimerWriteOutcome.Success("2026-08-22T10:00:00.000Z") },
            refreshSummary = { stateDuringRefresh = coordinator.state },
        )

        coordinator.start(active(), BreastSide.Left)

        assertTrue(stateDuringRefresh is PumpingTimerUiState.SnapshotActive)
    }

    @Test
    fun phoneSnapshotHydratesAControllablePausedTimer() {
        val hydrated = timer().copy(isPaused = true, accumulatedSeconds = 240)
        val coordinator = PumpingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, _ -> PumpingTimerWriteOutcome.Failed },
            refreshSummary = {},
            timerReader = { PumpingTimerReadOutcome.Success(hydrated) },
        )
        val snapshot = ActivitySnapshot.ActiveTimer(
            type = "pumping",
            startTime = "2026-08-22T10:00:00.000Z",
            timerInstanceId = "timer-1",
            context = "right",
            isRemote = false,
            isPaused = true,
            accumulatedSeconds = 240,
        )

        coordinator.restoreSnapshot(active(), snapshot, Instant.parse("2026-08-22T10:05:00.000Z"))

        assertEquals(
            hydrated.copy(elapsedSeconds = 240),
            (coordinator.state as PumpingTimerUiState.SnapshotActive).timer,
        )
    }

    @Test
    fun failedStopIsVisibleAndRetryReusesTheSameVolumeBoundDraft() {
        val attempts = mutableListOf<CompletedPumpingDraft>()
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("pumping-1"))
        }
        var draftCreations = 0
        var refreshes = 0
        val coordinator = PumpingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, _ -> PumpingTimerWriteOutcome.Failed },
            refreshSummary = { refreshes += 1 },
            completionDrafts = { _, _, selection ->
                draftCreations += 1
                assertEquals(85, selection.volumeMl)
                CompletedPumpingDraft("pumping-1", "merge")
            },
            completionWriter = { _, draft ->
                attempts += draft
                outcomes.removeFirst()
            },
        )
        coordinator.restoreHydrated(timer())

        coordinator.stop(active(), PumpingVolumeSelection(85))
        assertEquals(PumpingTimerUiState.Error("No network connection"), coordinator.state)
        coordinator.retry(active())

        assertEquals(PumpingTimerUiState.Idle, coordinator.state)
        assertEquals(1, draftCreations)
        assertEquals(2, attempts.size)
        assertSame(attempts[0], attempts[1])
        assertEquals(1, refreshes)
    }

    @Test
    fun remotePumpingSnapshotCannotBeControlled() {
        val coordinator = PumpingTimerCoordinator(
            drafts = { _, side -> draft(side) },
            starter = { _, _ -> PumpingTimerWriteOutcome.Failed },
            refreshSummary = {},
        )
        coordinator.restoreSnapshot(
            ActivitySnapshot.ActiveTimer(
                type = "pumping",
                startTime = "2026-08-22T10:00:00.000Z",
                timerInstanceId = "remote",
                context = "both",
                isRemote = true,
                isPaused = false,
                accumulatedSeconds = null,
            ),
            Instant.parse("2026-08-22T10:05:00.000Z"),
        )

        val restored = (coordinator.state as PumpingTimerUiState.SnapshotActive).timer
        assertEquals(BreastSide.Both, restored.side)
        assertFalse(restored.canControl)
    }

    private fun draft(side: BreastSide) = PumpingTimerDraft(
        timerInstanceId = "timer-1",
        activityId = "pumping-1",
        startedAt = "2026-08-22T10:00:00.000Z",
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

    private fun timer() = RestoredPumpingTimer(
        timerInstanceId = "timer-1",
        activityId = "pumping-1",
        startedAt = Instant.parse("2026-08-22T10:00:00.000Z"),
        side = BreastSide.Right,
        isPaused = false,
        accumulatedSeconds = null,
        totalPausedMs = 0,
        pausedAt = null,
        canControl = true,
        elapsedSeconds = 300,
    )
}
