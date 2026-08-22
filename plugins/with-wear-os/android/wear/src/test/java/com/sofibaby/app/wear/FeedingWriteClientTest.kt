package com.sofibaby.app.wear

import java.time.Instant
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedingWriteClientTest {
    @Test
    fun bottleRotaryInputAdjustsByFiveMillilitresAndClamps() {
        assertEquals(125, BottleVolumeRotary.adjust(BottleLogSelection(), 1f).volumeMl)
        assertEquals(115, BottleVolumeRotary.adjust(BottleLogSelection(), -1f).volumeMl)
        assertEquals(120, BottleVolumeRotary.adjust(BottleLogSelection(), 0f).volumeMl)
        assertEquals(500, BottleVolumeRotary.adjust(BottleLogSelection(500), 1f).volumeMl)
        assertEquals(0, BottleVolumeRotary.adjust(BottleLogSelection(0), -1f).volumeMl)
    }

    @Test
    fun sharedTimerTransportRoutesSleepWithoutFeedingConstants() {
        val requests = mutableListOf<WearHttpRequest>()
        val client = SupabaseWriteClient(
            transport = { request ->
                requests += request
                when {
                    request.url.endsWith("/rpc/acquire_timer_lock") -> WearHttpResponse(
                        200,
                        """[{"success":true,"started_at":"2026-08-22T10:15:30.123Z"}]""",
                    )
                    request.method == "GET" -> WearHttpResponse(
                        200,
                        """[{"started_at":"2026-08-22T10:15:30.123Z","timer_data":{"mode":"automatic"}}]""",
                    )
                    else -> WearHttpResponse(200, "{}")
                }
            },
            ids = { "11111111-1111-4111-8111-111111111111" },
            wallClockMillis = { 1_787_393_730_123L },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )
        val codec = TimerDataCodec<ProbeTimer>(
            encode = { JSONObject().put("mode", it.mode) },
            decode = { _, data -> ProbeTimer(data.getString("mode")) },
        )
        val draft = client.newTimerDraft(active(), TimerActivityType.Sleep, codec) { _, _ ->
            ProbeTimer("automatic")
        }

        val acquired = client.acquireTimer(active(), draft)
        val restored = client.loadOwnedTimer(active(), TimerActivityType.Sleep, codec)
        val toggled = client.mutateTimerData(
            active(),
            TimerActivityType.Sleep,
            ProbeTimer("paused"),
            codec,
            TimerMutationRoute.TogglePause,
        )
        val patched = client.mutateTimerData(
            active(),
            TimerActivityType.Sleep,
            ProbeTimer("automatic"),
            codec,
            TimerMutationRoute.OwnerPatch,
        )
        val completed = client.completeTimer(
            active(),
            SharedTimerCompletionDraft(
                recordId = "sleep-1",
                activityType = TimerActivityType.Sleep,
                mergeBody = JSONObject().put("p_table", "sleep_sessions").toString(),
            ),
        )

        assertTrue(acquired is SharedTimerAcquireOutcome.Success<*>)
        assertEquals(ProbeTimer("automatic"), (restored as SharedTimerReadOutcome.Success).timerData)
        assertEquals(ProbeTimer("paused"), (toggled as SharedTimerMutationOutcome.Success).timerData)
        assertEquals(ProbeTimer("automatic"), (patched as SharedTimerMutationOutcome.Success).timerData)
        assertTrue(completed is WriteOutcome.Success)
        assertEquals(6, requests.size)
        assertEquals(2, requests.count { it.url.contains("toggle_timer_pause") || it.method == "PATCH" })
        val routedWire = requests.joinToString("\n") { "${it.url}\n${it.body}" }
        assertTrue(routedWire.contains("sleep"))
        assertTrue(!routedWire.contains("feeding"))
    }

    @Test
    fun breastfeedingStartMatchesPhoneTimerRowShape() {
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
                WearHttpResponse(
                    200,
                    """[{"success":true,"lock_holder_id":"33333333-3333-4333-8333-333333333333","lock_holder_name":"Alex","started_at":"2026-08-22T10:15:30.123Z"}]""",
                )
            },
            ids = { ids.removeFirst() },
            wallClockMillis = { 1_787_393_730_123L },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newFeedingTimerDraft(active(), BreastSide.Left)
        val result = client.startFeedingTimer(active(), draft)

        assertTrue(result is TimerWriteOutcome.Success)
        val request = requireNotNull(captured)
        assertEquals("https://project.supabase.co/rest/v1/rpc/acquire_timer_lock", request.url)
        assertEquals("POST", request.method)
        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-feeding-timer-row.json")).readText())
        assertEquals(phoneFixture.toString(), JSONObject(request.body).toString())
    }

    @Test
    fun ownerTimerHydrationRestoresCompletionFieldsAfterRestart() {
        var captured: WearHttpRequest? = null
        val client = SupabaseWriteClient(
            transport = {
                captured = it
                WearHttpResponse(
                    200,
                    """[{"started_at":"2026-08-22T10:00:00.000Z","timer_data":{"timerInstanceId":"timer-1","activityId":"feeding-1","side":"right","type":"breast","leftAccumulatedSeconds":120,"rightAccumulatedSeconds":30,"currentSideStartedAt":"2026-08-22T10:04:00.000Z","isPaused":true,"accumulatedSeconds":270,"totalPausedMs":15000,"pausedAt":"2026-08-22T10:04:30.000Z"}}]""",
                )
            },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val result = client.loadOwnedFeedingTimer(active())

        val timer = (result as TimerReadOutcome.Success).timer
        assertEquals("feeding-1", timer.activityId)
        assertEquals(BreastSide.Right, timer.side)
        assertEquals(120, timer.leftAccumulatedSeconds)
        assertEquals(30, timer.rightAccumulatedSeconds)
        assertEquals(15_000L, timer.totalPausedMs)
        assertTrue(timer.isPaused)
        val request = requireNotNull(captured)
        assertEquals("GET", request.method)
        assertTrue(request.url.contains("active_timers?select=started_at%2Ctimer_data"))
        assertTrue(request.url.contains("baby_id=eq.22222222-2222-4222-8222-222222222222"))
        assertTrue(request.url.contains("started_by=eq.33333333-3333-4333-8333-333333333333"))
    }

    @Test
    fun pauseResumeAndSideSwitchPersistPhoneParityTimerData() {
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
        val initial = timer()

        val paused = (client.pauseFeedingTimer(active(), initial) as TimerMutationOutcome.Success).timer
        now = Instant.parse("2026-08-22T10:02:30.000Z").toEpochMilli()
        val resumed = (client.resumeFeedingTimer(active(), paused) as TimerMutationOutcome.Success).timer
        now = Instant.parse("2026-08-22T10:04:00.000Z").toEpochMilli()
        val switched = (client.switchFeedingSide(active(), resumed) as TimerMutationOutcome.Success).timer

        assertEquals(210, switched.leftAccumulatedSeconds)
        assertEquals(BreastSide.Right, switched.side)
        assertEquals(30_000L, switched.totalPausedMs)
        assertEquals("https://project.supabase.co/rest/v1/rpc/toggle_timer_pause", requests[0].url)
        assertEquals(true, JSONObject(requests[0].body).getJSONObject("p_timer_data").getBoolean("isPaused"))
        assertEquals(false, JSONObject(requests[1].body).getJSONObject("p_timer_data").getBoolean("isPaused"))
        assertEquals("PATCH", requests[2].method)
        val switchedData = JSONObject(requests[2].body).getJSONObject("timer_data")
        assertEquals("right", switchedData.getString("side"))
        assertEquals(210, switchedData.getInt("leftAccumulatedSeconds"))
    }

    @Test
    fun completedBreastfeedingMatchesPhoneRowShapeAndReleasesTimer() {
        val requests = mutableListOf<WearHttpRequest>()
        val client = SupabaseWriteClient(
            transport = {
                requests += it
                WearHttpResponse(200, "{}")
            },
            wallClockMillis = { Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newCompletedFeedingDraft(active(), timer())
        val result = client.completeFeedingTimer(active(), draft)

        assertTrue(result is WriteOutcome.Success)
        assertEquals(2, requests.size)
        assertEquals("https://project.supabase.co/rest/v1/rpc/merge_record", requests[0].url)
        val rpc = JSONObject(requests[0].body)
        val actualRow = rpc.getJSONObject("p_record").put("field_clocks", rpc.getJSONObject("p_field_clocks"))
        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-completed-feeding-row.json")).readText())
        assertEquals(phoneFixture.toString(), actualRow.toString())
        assertEquals("https://project.supabase.co/rest/v1/rpc/release_timer_lock", requests[1].url)
    }

    @Test
    fun completedBreastfeedingCountsThePausedWallSpanLikePhone() {
        val client = SupabaseWriteClient(
            transport = { error("transport is not used while building a draft") },
            wallClockMillis = { Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )
        val resumed = timer().copy(
            leftAccumulatedSeconds = 180,
            currentSideStartedAt = Instant.parse("2026-08-22T10:04:00.000Z"),
            totalPausedMs = 60_000,
        )

        val draft = client.newCompletedFeedingDraft(active(), resumed)

        val record = JSONObject(requireNotNull(draft.mergeBody)).getJSONObject("p_record")
        assertEquals(300L, record.getLong("duration_seconds"))
        assertEquals(300, record.getInt("left_duration_seconds"))
    }

    @Test
    fun subMinuteBreastfeedingReleasesTimerWithoutCreatingAFeedingRow() {
        val requests = mutableListOf<WearHttpRequest>()
        val client = SupabaseWriteClient(
            transport = {
                requests += it
                WearHttpResponse(200, "{}")
            },
            wallClockMillis = { Instant.parse("2026-08-22T10:00:59.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newCompletedFeedingDraft(active(), timer())
        val result = client.completeFeedingTimer(active(), draft)

        assertTrue(result is WriteOutcome.Success)
        assertEquals(1, requests.size)
        assertEquals("https://project.supabase.co/rest/v1/rpc/release_timer_lock", requests.single().url)
    }

    @Test
    fun bottleControlsAndCompletedRowStayWithinAppleParity() {
        val selection = BottleLogSelection()
            .minusTen()
            .plusTen()
            .crownSteps(3)
            .copy(contentType = BottleContentType.BreastMilk)
        assertEquals(135, selection.volumeMl)
        assertEquals(listOf("formula", "breastMilk"), BottleContentType.entries.map { it.wireValue })

        var captured: WearHttpRequest? = null
        val client = SupabaseWriteClient(
            transport = {
                captured = it
                WearHttpResponse(200, "{}")
            },
            ids = { "55555555-5555-4555-8555-555555555555" },
            wallClockMillis = { Instant.parse("2026-08-22T10:05:00.000Z").toEpochMilli() },
            clockStore = InMemoryWearClockStore("wear-test-device"),
        )

        val draft = client.newBottleFeedingDraft(active(), BottleLogSelection())
        val result = client.writeBottleFeeding(active(), draft)

        assertTrue(result is WriteOutcome.Success)
        val rpc = JSONObject(requireNotNull(captured).body)
        val actualRow = rpc.getJSONObject("p_record").put("field_clocks", rpc.getJSONObject("p_field_clocks"))
        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-bottle-feeding-row.json")).readText())
        assertEquals(phoneFixture.toString(), actualRow.toString())
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

    private data class ProbeTimer(val mode: String)

    private fun timer() = RestoredFeedingTimer(
        timerInstanceId = "timer-1",
        activityId = "feeding-1",
        startedAt = Instant.parse("2026-08-22T10:00:00.000Z"),
        side = BreastSide.Left,
        leftAccumulatedSeconds = 0,
        rightAccumulatedSeconds = 0,
        currentSideStartedAt = Instant.parse("2026-08-22T10:00:00.000Z"),
        isPaused = false,
        accumulatedSeconds = null,
        totalPausedMs = 0,
        pausedAt = null,
        canControl = true,
        elapsedSeconds = 0,
    )
}
