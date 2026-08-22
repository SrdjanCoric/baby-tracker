package com.sofibaby.app.wear

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class DiaperQuickLogCoordinatorTest {
    @Test
    fun offlineFailureIsVisibleAndRetryReusesTheExactDraft() {
        val attempts = mutableListOf<DiaperWriteDraft>()
        val outcomes = ArrayDeque<WriteOutcome>().apply {
            add(WriteOutcome.Offline)
            add(WriteOutcome.Success("diaper-1"))
        }
        var refreshes = 0
        val coordinator = coordinator(
            writer = { _, draft ->
                attempts += draft
                outcomes.removeFirst()
            },
            refresh = { refreshes += 1 },
        )

        coordinator.submit(active(), DiaperType.Mixed, StoolColor.Yellow)

        val error = coordinator.state as DiaperQuickLogState.Error
        assertEquals("No network connection", error.message)
        assertTrue(error.canRetry)
        coordinator.retry(active())

        assertEquals(2, attempts.size)
        assertSame(attempts[0], attempts[1])
        assertEquals("diaper-1", attempts[1].recordId)
        assertEquals(1, refreshes)
        assertEquals(DiaperQuickLogState.Success, coordinator.state)
    }

    @Test
    fun unauthorizedWriteRequestsFreshSessionAndCannotRetry() {
        val unauthorizedRevisions = mutableListOf<Long>()
        val coordinator = coordinator(
            writer = { _, _ -> WriteOutcome.Unauthorized },
            refresh = {},
            onUnauthorized = unauthorizedRevisions::add,
        )

        coordinator.submit(active(), DiaperType.Wet, null)

        assertEquals(listOf(3L), unauthorizedRevisions)
        assertEquals(DiaperQuickLogState.Error("Session expired", canRetry = false), coordinator.state)
    }

    @Test
    fun rapidDoubleSubmitDispatchesOneWriteAndSuccessReloadsSummaryOnce() {
        val queued = mutableListOf<() -> Unit>()
        var writes = 0
        var refreshes = 0
        val coordinator = coordinator(
            writer = { _, draft ->
                writes += 1
                WriteOutcome.Success(draft.recordId)
            },
            refresh = { refreshes += 1 },
            dispatch = queued::add,
        )

        coordinator.submit(active(), DiaperType.Wet, null)
        coordinator.submit(active(), DiaperType.Wet, null)

        assertEquals(1, queued.size)
        assertEquals(DiaperQuickLogState.Submitting, coordinator.state)
        queued.single().invoke()
        assertEquals(1, writes)
        assertEquals(1, refreshes)
        assertEquals(DiaperQuickLogState.Success, coordinator.state)
    }

    @Test
    fun resetIsNotBlockedByPostSuccessSummaryRefresh() {
        val queued = mutableListOf<() -> Unit>()
        val refreshStarted = CountDownLatch(1)
        val releaseRefresh = CountDownLatch(1)
        val coordinator = coordinator(
            writer = { _, draft -> WriteOutcome.Success(draft.recordId) },
            refresh = {
                refreshStarted.countDown()
                releaseRefresh.await(2, TimeUnit.SECONDS)
            },
            dispatch = queued::add,
        )
        coordinator.submit(active(), DiaperType.Wet, null)
        val completion = thread { queued.single().invoke() }

        assertTrue(refreshStarted.await(1, TimeUnit.SECONDS))
        val resetFinished = CountDownLatch(1)
        val reset = thread {
            coordinator.reset()
            resetFinished.countDown()
        }

        try {
            assertTrue("reset waited for summary network work", resetFinished.await(250, TimeUnit.MILLISECONDS))
        } finally {
            releaseRefresh.countDown()
            reset.join(1_000)
            completion.join(1_000)
        }
    }

    @Test
    fun draftCreationRunsOnDispatchAndFailureIsVisible() {
        val queued = mutableListOf<() -> Unit>()
        var draftAttempts = 0
        var writes = 0
        val coordinator = coordinator(
            drafts = { _, _, _ ->
                draftAttempts += 1
                error("clock persistence failed")
            },
            writer = { _, _ ->
                writes += 1
                WriteOutcome.Failed
            },
            refresh = {},
            dispatch = queued::add,
        )

        coordinator.submit(active(), DiaperType.Wet, null)

        assertEquals(DiaperQuickLogState.Submitting, coordinator.state)
        assertEquals(0, draftAttempts)
        queued.single().invoke()
        assertEquals(DiaperQuickLogState.Error("Could not log diaper"), coordinator.state)
        assertEquals(1, draftAttempts)
        assertEquals(0, writes)
    }

    @Test
    fun onlyAppleWatchParityOptionsAreExposed() {
        assertEquals(listOf("wet", "dirty", "mixed", "dry"), DiaperType.entries.map { it.wireValue })
        assertEquals(
            listOf("yellow", "brown", "green", "orange", "black", "white", "red"),
            StoolColor.entries.map { it.wireValue },
        )
    }

    private fun coordinator(
        drafts: DiaperDraftFactory = DiaperDraftFactory { _, type, color ->
            DiaperWriteDraft("diaper-1", "operation-1", type, color, "payload")
        },
        writer: DiaperDraftWriter,
        refresh: () -> Unit,
        dispatch: ((() -> Unit) -> Unit) = { it() },
        onUnauthorized: (Long) -> Unit = {},
    ) = DiaperQuickLogCoordinator(
        drafts = drafts,
        writer = writer,
        refreshSummary = refresh,
        dispatch = dispatch,
        onUnauthorized = onUnauthorized,
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
}
