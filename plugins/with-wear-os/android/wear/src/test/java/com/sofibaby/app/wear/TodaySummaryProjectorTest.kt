package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
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
}
