package com.sofibaby.app.wear

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TodaySummaryProjectorTest {
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
}
