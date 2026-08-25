package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TodaySummaryCoordinatorTest {
    @Test
    fun loadsTheDirectoryThenRendersTheSelectedBabySnapshot() {
        lateinit var coordinator: TodaySummaryCoordinator
        val requested = mutableListOf<String>()
        coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(babies()) },
            snapshots = { session ->
                assertTrue(coordinator.state is TodaySummaryUiState.Loading)
                requested += session.baby.id
                SnapshotOutcome.Success(snapshot())
            },
        )

        val result = coordinator.refresh(session(), reloadBabies = true)

        assertEquals(TodayRefreshResult.Success, result)
        assertEquals(listOf("baby-1"), requested)
        val content = coordinator.state as TodaySummaryUiState.Content
        assertEquals("Sofi", content.selectedBaby.name)
        assertEquals(2, content.babies.size)
        assertEquals("baby-1", content.snapshot.babyId)
    }

    @Test
    fun networkFailureShowsErrorAndRetryCanRecover() {
        val outcomes = ArrayDeque<SnapshotOutcome>().apply {
            add(SnapshotOutcome.Offline)
            add(SnapshotOutcome.Success(snapshot()))
        }
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(babies()) },
            snapshots = { outcomes.removeFirst() },
        )

        assertEquals(TodayRefreshResult.Failed, coordinator.refresh(session(), reloadBabies = true))
        assertTrue(coordinator.state is TodaySummaryUiState.Error)

        assertEquals(TodayRefreshResult.Success, coordinator.retry(session()))
        assertTrue(coordinator.state is TodaySummaryUiState.Content)
    }

    @Test
    fun selectingAnotherBabyRefreshesThatBabyWithTheIdentityTimezone() {
        val requested = mutableListOf<WearSessionEnvelope.Baby>()
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(babies()) },
            snapshots = { active ->
                requested += active.baby
                SnapshotOutcome.Success(snapshot(active.baby.id, active.baby.name))
            },
        )
        coordinator.refresh(session(), reloadBabies = true)

        val result = coordinator.selectBaby(session(), "baby-2")

        assertEquals(TodayRefreshResult.Success, result)
        assertEquals(WearSessionEnvelope.Baby("baby-2", "Leo", "Europe/Belgrade"), requested.last())
        val content = coordinator.state as TodaySummaryUiState.Content
        assertEquals("baby-2", content.snapshot.babyId)
    }

    @Test
    fun restoresTheWatchSelectedBabyWhenItStillBelongsToTheHousehold() {
        val requested = mutableListOf<String>()
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(babies()) },
            snapshots = { active ->
                requested += active.baby.id
                SnapshotOutcome.Success(snapshot(active.baby.id, active.baby.name))
            },
            preferredBabyId = "baby-2",
        )

        coordinator.refresh(session(), reloadBabies = true)

        assertEquals(listOf("baby-2"), requested)
    }

    @Test
    fun aSnapshotWithoutVisibleFactsUsesTheEmptyState() {
        val empty = snapshot().copy(
            activities = snapshot().activities.copy(
                feeding = snapshot().activities.feeding.copy(lastTime = null, todayCount = 0),
                sleep = snapshot().activities.sleep.copy(lastTime = null, todayMinutes = 0, lastDurationMinutes = null),
                diaper = snapshot().activities.diaper.copy(
                    lastTime = null,
                    todayCounts = ActivitySnapshot.DiaperCounts(0, 0, 0, 0),
                ),
                pumping = snapshot().activities.pumping.copy(lastTime = null, todayVolumeMl = 0.0, sessionCount = 0),
                tummyTime = snapshot().activities.tummyTime.copy(lastTime = null, todayMinutes = 0, lastDurationMinutes = null),
            ),
            activeTimer = null,
            activeTimers = emptyList(),
        )
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(babies()) },
            snapshots = { SnapshotOutcome.Success(empty) },
        )

        coordinator.refresh(session(), reloadBabies = true)

        assertTrue(coordinator.state is TodaySummaryUiState.Empty)
    }

    @Test
    fun wakeRefreshKeepsRenderedSummaryVisibleWhileLoading() {
        lateinit var coordinator: TodaySummaryCoordinator
        var snapshotCalls = 0
        coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(babies()) },
            snapshots = {
                snapshotCalls += 1
                if (snapshotCalls > 1) assertTrue(coordinator.state is TodaySummaryUiState.Content)
                SnapshotOutcome.Success(snapshot())
            },
        )
        coordinator.refresh(session(), reloadBabies = true)

        coordinator.refresh(session(), reloadBabies = false)

        assertTrue(coordinator.state is TodaySummaryUiState.Content)
    }

    @Test
    fun refreshFailureRetainsOnlyTheMatchingBabySnapshot() {
        val outcomes = ArrayDeque<SnapshotOutcome>().apply {
            add(SnapshotOutcome.Success(snapshot()))
            add(SnapshotOutcome.Offline)
            add(SnapshotOutcome.Offline)
        }
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(babies()) },
            snapshots = { outcomes.removeFirst() },
        )
        coordinator.refresh(session(), reloadBabies = true)

        coordinator.refresh(session(), reloadBabies = false)

        assertEquals(
            TodaySummaryUiState.Stale(babies().first(), babies(), snapshot(), empty = false),
            coordinator.state,
        )

        coordinator.selectBaby(session(), "baby-2")

        assertEquals(TodaySummaryUiState.Error(babies()[1], babies()), coordinator.state)
    }

    @Test
    fun retryReloadsTheDirectoryAndFallsBackFromADeletedBaby() {
        var directoryCalls = 0
        val requested = mutableListOf<String>()
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = {
                directoryCalls += 1
                if (directoryCalls == 1) {
                    BabyDirectoryOutcome.Success(babies())
                } else {
                    BabyDirectoryOutcome.Success(listOf(babies().first()))
                }
            },
            snapshots = { active ->
                requested += active.baby.id
                if (requested.size == 1) {
                    SnapshotOutcome.Offline
                } else {
                    SnapshotOutcome.Success(snapshot(active.baby.id, active.baby.name))
                }
            },
            preferredBabyId = "baby-2",
        )

        assertEquals(TodayRefreshResult.Failed, coordinator.refresh(session(), reloadBabies = true))
        assertEquals(TodayRefreshResult.Success, coordinator.retry(session()))

        assertEquals(2, directoryCalls)
        assertEquals(listOf("baby-2", "baby-1"), requested)
        assertEquals("baby-1", (coordinator.state as TodaySummaryUiState.Content).selectedBaby.id)
    }

    private fun babies() = listOf(
        BabyIdentity("baby-1", "Sofi", "Europe/Belgrade"),
        BabyIdentity("baby-2", "Leo", "Europe/Belgrade"),
    )

    private fun session() = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = 3,
        account = WearSessionEnvelope.Account("user-1", "Alex"),
        baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = 2_000_000_000,
    )

    private fun snapshot(id: String = "baby-1", name: String = "Sofi"): ActivitySnapshot {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()
        return ActivitySnapshotCodec.decode(fixture).copy(babyId = id, babyName = name)
    }
}
