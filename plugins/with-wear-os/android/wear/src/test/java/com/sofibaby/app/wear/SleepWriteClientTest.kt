package com.sofibaby.app.wear

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SleepWriteClientTest {
    @Test
    fun automaticSleepTypeUsesThePhoneRangeRuleAcrossTheEveningBoundary() {
        val type = SleepTypeClassifier.classify(
            startedAt = Instant.parse("2026-08-22T16:45:00.000Z"),
            endedAt = Instant.parse("2026-08-22T18:00:00.000Z"),
            timezone = "Europe/Belgrade",
        )

        assertEquals(SleepType.Night, type)
    }

    @Test
    fun completedSleepUsesTheSelectedBabysCustomDayHours() {
        val requests = mutableListOf<WearHttpRequest>()
        val client = SupabaseWriteClient(
            transport = {
                requests += it
                WearHttpResponse(200, """[{"day_start_hour":7,"day_end_hour":19}]""")
            },
            wallClockMillis = { Instant.parse("2026-08-22T04:40:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )
        val earlyMorning = timer().copy(
            startedAt = Instant.parse("2026-08-22T04:30:00.000Z"),
            morningClassification = "automatic",
        )

        val draft = client.newCompletedSleepDraft(active(), earlyMorning)

        val record = JSONObject(requireNotNull(draft.mergeBody)).getJSONObject("p_record")
        assertEquals("night", record.getString("type"))
        assertEquals(1, requests.size)
        assertTrue(requests.single().url.contains("wake_window_preferences"))
    }

    @Test
    fun customDayHoursCanCrossMidnightLikeThePhoneClassifier() {
        val type = SleepTypeClassifier.at(
            instant = Instant.parse("2026-08-22T20:00:00.000Z"),
            timezone = "UTC",
            dayStartHour = 19,
            dayEndHour = 6,
        )

        assertEquals(SleepType.Nap, type)
    }

    @Test
    fun ownerSleepTimerHydrationRestoresCompletionAndPauseFields() {
        val client = SupabaseWriteClient(
            transport = {
                WearHttpResponse(
                    200,
                    """[{"started_at":"2026-08-22T10:00:00.000Z","timer_data":{"timerInstanceId":"timer-1","activityId":"sleep-1","type":"night","isPaused":true,"accumulatedSeconds":270,"totalPausedMs":15000,"pausedAt":"2026-08-22T10:04:30.000Z","morningClassification":"confirmed_night_continuation","morningClassificationVersion":2}}]""",
                )
            },
            wallClockMillis = { Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val result = client.loadOwnedSleepTimer(active()) as SleepTimerReadOutcome.Success

        assertEquals("sleep-1", result.timer.activityId)
        assertEquals(SleepType.Night, result.timer.type)
        assertTrue(result.timer.isPaused)
        assertEquals(270, result.timer.accumulatedSeconds)
        assertEquals(15_000L, result.timer.totalPausedMs)
        assertEquals(Instant.parse("2026-08-22T10:04:30.000Z"), result.timer.pausedAt)
        assertEquals("confirmed_night_continuation", result.timer.morningClassification)
        assertEquals(2, result.timer.morningClassificationVersion)
    }

    @Test
    fun pauseAndResumePersistPhoneParitySleepTimerData() {
        val requests = mutableListOf<WearHttpRequest>()
        var now = Instant.parse("2026-08-22T10:02:00.000Z").toEpochMilli()
        val client = SupabaseWriteClient(
            transport = {
                requests += it
                WearHttpResponse(204, "")
            },
            wallClockMillis = { now },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val original = timer().copy(
            morningClassification = "unresolved",
            morningClassificationVersion = 2,
        )
        val paused = client.pauseSleepTimer(active(), original) as SleepTimerMutationOutcome.Success
        now = Instant.parse("2026-08-22T10:02:30.000Z").toEpochMilli()
        val resumed = client.resumeSleepTimer(active(), paused.timer) as SleepTimerMutationOutcome.Success

        assertTrue(paused.timer.isPaused)
        assertEquals(120, paused.timer.accumulatedSeconds)
        assertEquals(30_000L, resumed.timer.totalPausedMs)
        assertEquals("https://project.supabase.co/rest/v1/rpc/toggle_timer_pause", requests[0].url)
        val pausedData = JSONObject(requests[0].body).getJSONObject("p_timer_data")
        assertTrue(pausedData.getBoolean("isPaused"))
        assertEquals("unresolved", pausedData.getString("morningClassification"))
        assertEquals(2, pausedData.getInt("morningClassificationVersion"))
        val resumedData = JSONObject(requests[1].body).getJSONObject("p_timer_data")
        assertEquals(false, resumedData.getBoolean("isPaused"))
        assertEquals(30_000L, resumedData.getLong("totalPausedMs"))
        assertEquals("unresolved", resumedData.getString("morningClassification"))
        assertEquals(2, resumedData.getInt("morningClassificationVersion"))
    }

    @Test
    fun completedSleepMatchesThePhoneRowShapeAndReleasesTheTimer() {
        val requests = mutableListOf<WearHttpRequest>()
        val client = SupabaseWriteClient(
            transport = {
                requests += it
                WearHttpResponse(200, if (it.method == "GET") "[]" else "{}")
            },
            wallClockMillis = { Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newCompletedSleepDraft(active(), timer())
        val result = client.completeSleepTimer(active(), draft)

        assertTrue(result is WriteOutcome.Success)
        assertEquals(3, requests.size)
        assertTrue(requests[0].url.contains("wake_window_preferences"))
        assertEquals("https://project.supabase.co/rest/v1/rpc/merge_record", requests[1].url)
        val rpc = JSONObject(requests[1].body)
        val actualRow = rpc.getJSONObject("p_record").put("field_clocks", rpc.getJSONObject("p_field_clocks"))
        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-completed-sleep-row.json")).readText())
        assertEquals(phoneFixture.toString(), actualRow.toString())
        assertEquals("https://project.supabase.co/rest/v1/rpc/release_timer_lock", requests[2].url)
    }

    @Test
    fun completedSleepPreservesConfirmedMorningClassificationAndType() {
        val client = SupabaseWriteClient(
            transport = { error("draft creation does not use the network") },
            wallClockMillis = { Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )
        val confirmedNight = timer().copy(
            morningClassification = "confirmed_night_continuation",
            morningClassificationVersion = 2,
        )

        val draft = client.newCompletedSleepDraft(active(), confirmedNight)

        val record = JSONObject(requireNotNull(draft.mergeBody)).getJSONObject("p_record")
        assertEquals("night", record.getString("type"))
        assertEquals("confirmed_night_continuation", record.getString("morning_classification"))
        assertEquals(2, record.getInt("morning_classification_version"))
    }

    @Test
    fun automaticSleepStartMatchesThePhoneTimerShape() {
        var captured: WearHttpRequest? = null
        val ids = ArrayDeque(
            listOf(
                "11111111-1111-4111-8111-111111111111",
                "44444444-4444-4444-8444-444444444444",
            ),
        )
        val client = SupabaseWriteClient(
            transport = {
                if (it.method == "GET") {
                    WearHttpResponse(200, "[]")
                } else {
                    captured = it
                    WearHttpResponse(
                        200,
                        """[{"success":true,"started_at":"2026-08-22T10:15:30.123Z"}]""",
                    )
                }
            },
            ids = { ids.removeFirst() },
            wallClockMillis = { 1_787_393_730_123L },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newSleepTimerDraft(active())
        val result = client.startSleepTimer(active(), draft)

        assertTrue(result is SleepTimerWriteOutcome.Success)
        assertEquals(SleepType.Nap, draft.type)
        val request = requireNotNull(captured)
        assertEquals("https://project.supabase.co/rest/v1/rpc/acquire_timer_lock", request.url)
        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-sleep-timer-row.json")).readText())
        assertEquals(phoneFixture.toString(), JSONObject(request.body).toString())
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
        elapsedSeconds = 0,
    )
}
