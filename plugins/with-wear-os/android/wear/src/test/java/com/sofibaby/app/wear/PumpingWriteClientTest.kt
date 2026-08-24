package com.sofibaby.app.wear

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PumpingWriteClientTest {
    @Test
    fun pumpingVolumeInputUsesFiveMillilitreCrownStepsAndTenMillilitreButtonsWithinPhoneBounds() {
        assertEquals(5, PumpingVolumeRotary.adjust(PumpingVolumeSelection(), 1f).volumeMl)
        assertEquals(0, PumpingVolumeRotary.adjust(PumpingVolumeSelection(), -1f).volumeMl)
        assertEquals(500, PumpingVolumeRotary.adjust(PumpingVolumeSelection(500), 1f).volumeMl)
        assertEquals(10, PumpingVolumeSelection().plusTen().volumeMl)
        assertEquals(490, PumpingVolumeSelection(500).minusTen().volumeMl)

        val inactive = PumpingVolumeRotary.handle(
            PumpingVolumeSelection(),
            verticalScrollPixels = 1f,
            adjustmentModeActive = false,
            enabled = true,
        )
        assertFalse(inactive.consumed)
        assertEquals(0, inactive.selection.volumeMl)
    }

    @Test
    fun pumpingStartForBothMatchesThePhoneTimerRequest() {
        var captured: WearHttpRequest? = null
        val ids = ArrayDeque(
            listOf(
                "11111111-1111-4111-8111-111111111111",
                "44444444-4444-4444-8444-444444444444",
            ),
        )
        val client = SupabaseWriteClient(
            transport = {
                captured = it
                WearHttpResponse(200, """[{"success":true,"started_at":"2026-08-22T10:15:30.123Z"}]""")
            },
            ids = { ids.removeFirst() },
            wallClockMillis = { 1_787_393_730_123L },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newPumpingTimerDraft(active(), BreastSide.Both)
        val result = client.startPumpingTimer(active(), draft)

        assertTrue(result is PumpingTimerWriteOutcome.Success)
        val request = requireNotNull(captured)
        assertEquals("https://project.supabase.co/rest/v1/rpc/acquire_timer_lock", request.url)
        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-pumping-timer-row.json")).readText())
        assertEquals(phoneFixture.toString(), JSONObject(request.body).toString())
    }

    @Test
    fun pauseResumeAndOwnerHydrationPreserveDurablePumpingCompletionFields() {
        val requests = mutableListOf<WearHttpRequest>()
        var now = Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli()
        val client = SupabaseWriteClient(
            transport = { request ->
                requests += request
                if (request.method == "GET") {
                    WearHttpResponse(
                        200,
                        """[{"started_at":"2026-08-22T10:00:00.000Z","timer_data":{"timerInstanceId":"timer-1","activityId":"pumping-1","side":"right","isPaused":false,"totalPausedMs":15000}}]""",
                    )
                } else {
                    WearHttpResponse(204, "")
                }
            },
            wallClockMillis = { now },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val hydrated = (client.loadOwnedPumpingTimer(active()) as PumpingTimerReadOutcome.Success).timer
        val paused = client.pausePumpingTimer(active(), hydrated) as PumpingTimerMutationOutcome.Success
        now = Instant.parse("2026-08-22T10:05:30.000Z").toEpochMilli()
        val resumed = client.resumePumpingTimer(active(), paused.timer) as PumpingTimerMutationOutcome.Success

        assertEquals("pumping-1", hydrated.activityId)
        assertEquals(BreastSide.Right, hydrated.side)
        assertTrue(paused.timer.isPaused)
        assertEquals(300, paused.timer.accumulatedSeconds)
        assertEquals(45_000L, resumed.timer.totalPausedMs)
        assertEquals("https://project.supabase.co/rest/v1/rpc/toggle_timer_pause", requests[1].url)
        assertEquals(false, JSONObject(requests[2].body).getJSONObject("p_timer_data").getBoolean("isPaused"))
    }

    @Test
    fun completedPausedPumpingMatchesThePhoneRowAndReleasesTheTimer() {
        val requests = mutableListOf<WearHttpRequest>()
        val client = SupabaseWriteClient(
            transport = {
                requests += it
                WearHttpResponse(200, "{}")
            },
            wallClockMillis = { Instant.parse("2026-08-22T10:06:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )
        val paused = timer().copy(
            isPaused = true,
            accumulatedSeconds = 300,
            pausedAt = Instant.parse("2026-08-22T10:05:00.000Z"),
        )

        val draft = client.newCompletedPumpingDraft(active(), paused, PumpingVolumeSelection(85))
        val result = client.completePumpingTimer(active(), draft)

        assertTrue(result is WriteOutcome.Success)
        assertEquals(2, requests.size)
        val rpc = JSONObject(requests[0].body)
        val actualRow = rpc.getJSONObject("p_record").put("field_clocks", rpc.getJSONObject("p_field_clocks"))
        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-completed-pumping-row.json")).readText())
        assertEquals(phoneFixture.toString(), actualRow.toString())
        assertEquals("https://project.supabase.co/rest/v1/rpc/release_timer_lock", requests[1].url)
    }

    @Test
    fun subMinutePumpingWithVolumeMatchesThePhoneVolumeOnlyRowShape() {
        val client = SupabaseWriteClient(
            transport = { WearHttpResponse(200, "{}") },
            wallClockMillis = { Instant.parse("2026-08-22T10:00:30.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newCompletedPumpingDraft(active(), timer(), PumpingVolumeSelection(60))

        val rpc = JSONObject(requireNotNull(draft.mergeBody))
        val record = rpc.getJSONObject("p_record")
        val fieldClocks = rpc.getJSONObject("p_field_clocks")
        assertEquals(60, record.getInt("amount_ml"))
        assertFalse(record.has("ended_at"))
        assertFalse(record.has("duration_seconds"))
        assertFalse(fieldClocks.has("ended_at"))
        assertFalse(fieldClocks.has("duration_seconds"))
    }

    private fun active() = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = 3,
        account = WearSessionEnvelope.Account("33333333-3333-4333-8333-333333333333", "Alex"),
        baby = WearSessionEnvelope.Baby("22222222-2222-4222-8222-222222222222", "Sofi", "Europe/Belgrade"),
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
