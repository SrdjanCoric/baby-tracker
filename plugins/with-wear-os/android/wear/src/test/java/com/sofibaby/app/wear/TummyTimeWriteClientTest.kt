package com.sofibaby.app.wear

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TummyTimeWriteClientTest {
    @Test
    fun tummyTimeStartMatchesThePhoneTimerRequest() {
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

        val draft = client.newTummyTimeTimerDraft(active())
        val result = client.startTummyTimeTimer(active(), draft)

        assertTrue(result is TummyTimeTimerWriteOutcome.Success)
        val request = requireNotNull(captured)
        assertEquals("https://project.supabase.co/rest/v1/rpc/acquire_timer_lock", request.url)
        val phoneFixture = JSONObject(
            requireNotNull(javaClass.getResource("/phone-tummy-time-timer-row.json")).readText(),
        )
        assertEquals(phoneFixture.toString(), JSONObject(request.body).toString())
    }

    @Test
    fun pauseResumeAndOwnerHydrationPreservePhoneTummyTimeTimerData() {
        val requests = mutableListOf<WearHttpRequest>()
        var now = Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli()
        val client = SupabaseWriteClient(
            transport = { request ->
                requests += request
                if (request.method == "GET") {
                    WearHttpResponse(
                        200,
                        """[{"started_at":"2026-08-22T10:00:00.000Z","timer_data":{"timerInstanceId":"timer-1","activityId":"tummy-1","isPaused":false,"totalPausedMs":15000}}]""",
                    )
                } else {
                    WearHttpResponse(204, "")
                }
            },
            wallClockMillis = { now },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val hydrated = (client.loadOwnedTummyTimeTimer(active()) as TummyTimeTimerReadOutcome.Success).timer
        val paused = client.pauseTummyTimeTimer(active(), hydrated) as TummyTimeTimerMutationOutcome.Success
        now = Instant.parse("2026-08-22T10:05:30.000Z").toEpochMilli()
        val resumed = client.resumeTummyTimeTimer(active(), paused.timer) as TummyTimeTimerMutationOutcome.Success

        assertEquals("tummy-1", hydrated.activityId)
        assertTrue(paused.timer.isPaused)
        assertEquals(Instant.parse("2026-08-22T10:05:00.000Z"), paused.timer.pausedAt)
        assertEquals(45_000L, resumed.timer.totalPausedMs)
        assertEquals("https://project.supabase.co/rest/v1/rpc/toggle_timer_pause", requests[1].url)
        val resumedData = JSONObject(requests[2].body).getJSONObject("p_timer_data")
        assertEquals(false, resumedData.getBoolean("isPaused"))
        assertEquals(45_000L, resumedData.getLong("totalPausedMs"))
    }

    @Test
    fun completedPausedTummyTimeMatchesThePhoneRowAndReleasesTheTimer() {
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
            pausedAt = Instant.parse("2026-08-22T10:05:00.000Z"),
        )

        val draft = client.newCompletedTummyTimeDraft(active(), paused)
        val result = client.completeTummyTimeTimer(active(), draft)

        assertTrue(result is WriteOutcome.Success)
        assertEquals(2, requests.size)
        val rpc = JSONObject(requests[0].body)
        val actualRow = rpc.getJSONObject("p_record").put("field_clocks", rpc.getJSONObject("p_field_clocks"))
        val phoneFixture = JSONObject(
            requireNotNull(javaClass.getResource("/phone-completed-tummy-time-row.json")).readText(),
        )
        assertEquals(phoneFixture.toString(), actualRow.toString())
        assertEquals("https://project.supabase.co/rest/v1/rpc/release_timer_lock", requests[1].url)
    }

    @Test
    fun zeroDurationTummyTimeStillProducesThePhoneMergeRowWithoutManualFields() {
        val client = SupabaseWriteClient(
            transport = { error("Completion draft construction does not perform HTTP requests") },
            wallClockMillis = { Instant.parse("2026-08-22T10:00:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newCompletedTummyTimeDraft(active(), timer())
        val record = JSONObject(draft.mergeBody).getJSONObject("p_record")

        assertEquals(0, record.getInt("duration_seconds"))
        assertEquals(
            setOf("id", "baby_id", "started_at", "ended_at", "duration_seconds", "logged_by", "created_at"),
            record.keys().asSequence().toSet(),
        )
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
