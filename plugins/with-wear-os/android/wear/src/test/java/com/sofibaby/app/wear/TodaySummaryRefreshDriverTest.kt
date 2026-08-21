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

    private fun session() = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = 3,
        account = WearSessionEnvelope.Account("user-1", "Alex"),
        baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = 2_000_000_000,
    )

    private fun snapshot(): ActivitySnapshot {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()
        return ActivitySnapshotCodec.decode(fixture)
    }
}
