package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TodaySummaryRefreshDriverTest {
    @Test
    fun appOpenAndWakeEachRefreshTheCurrentBaby() {
        var snapshotCalls = 0
        var directoryCalls = 0
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = {
                directoryCalls += 1
                BabyDirectoryOutcome.Success(listOf(BabyIdentity("baby-1", "Sofi", "Europe/Belgrade")))
            },
            snapshots = {
                snapshotCalls += 1
                SnapshotOutcome.Success(snapshot())
            },
        )
        val states = mutableListOf<TodaySummaryUiState>()
        val driver = TodaySummaryRefreshDriver(
            session = { session() },
            coordinator = coordinator,
            onState = states::add,
            onUnauthorized = { error("unexpected unauthorized") },
        )

        driver.onOpen()
        driver.onWake()

        assertEquals(2, snapshotCalls)
        assertEquals(1, directoryCalls)
        assertTrue(states.last() is TodaySummaryUiState.Content)
    }

    @Test
    fun unauthorizedRefreshRejectsTheSessionRevision() {
        var rejectedRevision: Long? = null
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(emptyList()) },
            snapshots = { SnapshotOutcome.Unauthorized },
        )
        val driver = TodaySummaryRefreshDriver(
            session = { session() },
            coordinator = coordinator,
            onState = {},
            onUnauthorized = { rejectedRevision = it },
        )

        driver.onOpen()

        assertEquals(3L, rejectedRevision)
    }

    @Test
    fun successfulRefreshReportsTheSessionRevision() {
        var successfulRevision: Long? = null
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryOutcome.Success(emptyList()) },
            snapshots = { SnapshotOutcome.Success(snapshot()) },
        )
        val driver = TodaySummaryRefreshDriver(
            session = { session() },
            coordinator = coordinator,
            onState = {},
            onUnauthorized = { error("unexpected unauthorized") },
            onSuccess = { successfulRevision = it },
        )

        driver.onOpen()

        assertEquals(3L, successfulRevision)
    }

    @Test
    fun accountChangePurgesThePreviousSummaryBeforeLoadingTheNewAccount() {
        var active = session()
        val directoryOutcomes = ArrayDeque<BabyDirectoryOutcome>().apply {
            add(BabyDirectoryOutcome.Success(listOf(BabyIdentity("baby-1", "Sofi", "Europe/Belgrade"))))
            add(BabyDirectoryOutcome.Offline)
        }
        val snapshotOutcomes = ArrayDeque<SnapshotOutcome>().apply {
            add(SnapshotOutcome.Success(snapshot()))
            add(SnapshotOutcome.Offline)
        }
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { directoryOutcomes.removeFirst() },
            snapshots = { snapshotOutcomes.removeFirst() },
        )
        val states = mutableListOf<TodaySummaryUiState>()
        val driver = TodaySummaryRefreshDriver(
            session = { active },
            coordinator = coordinator,
            onState = states::add,
            onUnauthorized = { error("unexpected unauthorized") },
        )
        driver.onOpen()

        val previous = active
        active = session(
            phoneEpoch = "phone-install-2",
            accountId = "user-2",
            babyId = "baby-9",
            babyName = "Mila",
        )
        driver.prepareForSessionChange(previous, active)

        assertEquals(TodaySummaryUiState.Unavailable, states.last())
        assertEquals(TodayRefreshResult.Failed, driver.onOpen())
        val error = coordinator.state as TodaySummaryUiState.Error
        assertEquals("baby-9", error.selectedBaby.id)
        assertEquals(listOf("baby-9"), error.babies.map { it.id })
    }

    @Test
    fun sessionScopeChangeClearsThePersistedBabySelection() {
        var clears = 0
        val coordinator = TodaySummaryCoordinator(
            babyDirectory = { error("unexpected directory load") },
            snapshots = { error("unexpected snapshot load") },
        )
        val driver = TodaySummaryRefreshDriver(
            session = { session() },
            coordinator = coordinator,
            onState = {},
            onUnauthorized = { error("unexpected unauthorized") },
            onSessionScopeReset = { clears += 1 },
        )
        val secondAccount = session(phoneEpoch = "phone-install-2", accountId = "user-2")

        driver.prepareForSessionChange(session(), secondAccount)
        driver.prepareForSessionChange(secondAccount, secondAccount.copy(revision = 4))
        driver.prepareForSessionChange(secondAccount, WearSessionEnvelope.Invalidated("phone-install-2", 5, "signed_out"))

        assertEquals(2, clears)
    }

    private fun session(
        phoneEpoch: String = "phone-install-1",
        accountId: String = "user-1",
        babyId: String = "baby-1",
        babyName: String = "Sofi",
    ) = WearSessionEnvelope.Active(
        phoneEpoch = phoneEpoch,
        revision = 3,
        account = WearSessionEnvelope.Account(accountId, "Alex"),
        baby = WearSessionEnvelope.Baby(babyId, babyName, "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = 2_000_000_000,
    )

    private fun snapshot(): ActivitySnapshot {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()
        return ActivitySnapshotCodec.decode(fixture)
    }
}
