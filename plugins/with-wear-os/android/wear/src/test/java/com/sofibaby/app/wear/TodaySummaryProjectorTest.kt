package com.sofibaby.app.wear

import java.time.Instant
import androidx.lifecycle.Lifecycle
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TodaySummaryProjectorTest {
    @Test
    fun completedPumpingEntryIsReadableThroughTheSharedSnapshotAndSummaryProjector() {
        val root = JSONObject(requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText())
        root.getJSONObject("activities").put(
            "pumping",
            JSONObject()
                .put("lastTime", "2026-08-22T10:05:00.000Z")
                .put("todayVolumeMl", 85)
                .put("sessionCount", 1)
                .put("lastSide", "right"),
        )

        val decoded = ActivitySnapshotCodec.decode(root.toString())
        val pumping = TodaySummaryProjector.projectStatic(
            decoded,
            now = Instant.parse("2026-08-22T10:06:00.000Z"),
        ).rows.single { it.label == "Pumping" }

        assertEquals(85.0, decoded.activities.pumping.todayVolumeMl, 0.0)
        assertEquals("85 ml · 1 sessions", pumping.value)
        assertEquals("right · Last 1m", pumping.detail)
    }

    @Test
    fun sleepPresentationShowsTheWakeWindowWithoutAnAwakeAnchor() {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()
        val sleep = ActivitySnapshotCodec.decode(fixture).activities.sleep.copy(lastSleepEndedAt = null)

        val presentation = SleepSectionProjector.project(sleep)

        assertEquals("Wake window 1h 17m", presentation.wakeWindow)
        assertEquals(null, presentation.awake)
        assertEquals(null, presentation.nextNap)
    }

    @Test
    fun sleepPresentationShowsCompletedSleepAwakeWindowAndPhoneConfirmation() {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()
        val snapshot = ActivitySnapshotCodec.decode(fixture)

        val presentation = SleepSectionProjector.project(
            snapshot.activities.sleep,
            now = Instant.parse("2026-08-21T13:14:20.000Z"),
        )

        assertEquals("10 min last sleep", presentation.completedSleep)
        assertEquals("Awake 34 min", presentation.awake)
        assertEquals("Next nap in 43 min", presentation.nextNap)
        assertEquals(
            listOf("10 min last sleep", "Awake 34 min", "Next nap in 43 min"),
            presentation.idleReadouts,
        )
        assertEquals("Confirm in SofiBaby on your phone", presentation.confirmationNotice)
    }

    @Test
    fun timerTickerRunsOnlyWithActiveTimersWhileResumed() {
        assertFalse(TodaySummaryTicker.shouldRun(hasActiveTimers = false, Lifecycle.State.RESUMED))
        assertFalse(TodaySummaryTicker.shouldRun(hasActiveTimers = true, Lifecycle.State.STARTED))
        assertTrue(TodaySummaryTicker.shouldRun(hasActiveTimers = true, Lifecycle.State.RESUMED))
    }

    @Test
    fun projectsOnlyAppleWatchParityFactsTimersWakeStateAndGoals() {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()

        val presentation = TodaySummaryProjector.project(ActivitySnapshotCodec.decode(fixture))

        assertEquals(listOf("Feeding", "Sleep", "Diaper", "Pumping", "Tummy time"), presentation.rows.map { it.label })
        assertTrue(presentation.rows.first { it.label == "Sleep" }.detail.contains("123 min goal"))
        assertTrue(presentation.rows.first { it.label == "Sleep" }.detail.contains("Wake window 77 min"))
        assertTrue(presentation.rows.first { it.label == "Tummy time" }.detail.contains("7 min goal"))
        assertEquals("Feeding active", presentation.timers.first().title)
        assertTrue(presentation.timers.first().detail.contains("Snapshot Member"))
    }

    @Test
    fun rendersSnapshotInstantsAsElapsedTime() {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()

        val presentation = TodaySummaryProjector.project(
            ActivitySnapshotCodec.decode(fixture),
            now = Instant.parse("2026-08-21T14:45:00Z"),
        )

        assertTrue(presentation.rows.first { it.label == "Feeding" }.detail.contains("Last 2h 15m"))
        assertEquals("1h 30m", presentation.updatedAgo)
        assertFalse(presentation.rows.any { it.detail.contains("2026-08-21T") })
        assertFalse(presentation.timers.any { it.detail.contains("2026-08-21T") })
    }

    @Test
    fun rendersRunningAndPausedTimerDurations() {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()

        val presentation = TodaySummaryProjector.project(
            ActivitySnapshotCodec.decode(fixture),
            now = Instant.parse("2026-08-21T13:14:20.000Z"),
        )

        assertTrue(presentation.timers.first { it.title == "Feeding active" }.detail.contains("29:20"))
        assertTrue(presentation.timers.first { it.title == "Sleep active" }.detail.contains("7:14:20"))
        assertTrue(presentation.timers.first { it.title == "Pumping active" }.detail.contains("2:03"))
    }

    @Test
    fun projectsDynamicTimersSeparatelyFromStaticRows() {
        val fixture = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()
        val snapshot = ActivitySnapshotCodec.decode(fixture)
        val firstNow = Instant.parse("2026-08-21T13:14:20.000Z")

        val static = TodaySummaryProjector.projectStatic(snapshot, firstNow)
        val firstTimers = TodaySummaryProjector.projectTimers(snapshot.activeTimers, firstNow)
        val laterTimers = TodaySummaryProjector.projectTimers(
            snapshot.activeTimers,
            Instant.parse("2026-08-21T13:15:20.000Z"),
        )

        assertEquals("Feeding", static.rows.first().label)
        assertTrue(firstTimers.first { it.title == "Feeding active" }.detail.contains("29:20"))
        assertTrue(laterTimers.first { it.title == "Feeding active" }.detail.contains("30:20"))
    }
}
