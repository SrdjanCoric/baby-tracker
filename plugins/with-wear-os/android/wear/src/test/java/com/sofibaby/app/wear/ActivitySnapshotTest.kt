package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test
import org.json.JSONObject

class ActivitySnapshotTest {
    @Test
    fun decodesEveryFieldFromTheRpcFixture() {
        val json = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()

        val snapshot = ActivitySnapshotCodec.decode(json)

        assertEquals(1, snapshot.schemaVersion)
        assertEquals("2026-08-21T13:14:20.061Z", snapshot.serverAsOf)
        assertEquals("America/Godthab", snapshot.timezone)
        assertEquals("2026-08-21T01:00:00.000Z", snapshot.localDay.startedAt)
        assertEquals("2026-08-22T01:00:00.000Z", snapshot.localDay.endsAt)
        assertEquals("8a000000-0000-0000-0000-000000000004", snapshot.babyId)
        assertEquals("Sibling Snapshot Baby", snapshot.babyName)
        assertEquals("2026-08-21T13:14:20.061Z", snapshot.updatedAt)

        with(snapshot.activities.feeding) {
            assertEquals("2026-08-21T12:30:00.000Z", lastTime)
            assertEquals(1, todayCount)
            assertEquals("solid", lastType)
            assertNull(lastSide)
        }
        with(snapshot.activities.sleep) {
            assertEquals("2026-08-21T12:40:00.000Z", lastTime)
            assertEquals(10, todayMinutes)
            assertEquals(123, goalMinutes)
            assertEquals(10, lastDurationMinutes)
            assertTrue(isActive)
            assertEquals("nap", sleepType)
            assertEquals(77, wakeWindowMinutes)
            assertEquals("Sibling First", wakeWindowSlotLabel)
            assertTrue(requireNotNull(wakeWindowRequiresNewbornOptIn))
            assertEquals("2026-08-21T12:40:00.000Z", lastSleepEndedAt)
            assertEquals(0, napCountToday)
            assertTrue(requireNotNull(morningConfirmationPending))
        }
        with(snapshot.activities.diaper) {
            assertEquals("2026-08-21T12:30:00.000Z", lastTime)
            assertEquals(0, todayCounts.wet)
            assertEquals(0, todayCounts.dirty)
            assertEquals(0, todayCounts.mixed)
            assertEquals(1, todayCounts.dry)
            assertEquals("dry", lastType)
        }
        with(snapshot.activities.pumping) {
            assertEquals("2026-08-21T12:30:00.000Z", lastTime)
            assertEquals(321.0, todayVolumeMl, 0.0)
            assertEquals(1, sessionCount)
            assertEquals("right", lastSide)
        }
        with(requireNotNull(snapshot.activities.growth.lastMeasurement)) {
            assertEquals("2026-08-21T12:30:00.000Z", date)
            assertEquals(9.999, requireNotNull(weightKg), 0.0)
            assertEquals(99.0, requireNotNull(heightCm), 0.0)
            assertEquals(99.0, requireNotNull(headCircumferenceCm), 0.0)
        }
        with(snapshot.activities.tummyTime) {
            assertEquals("2026-08-21T12:30:00.000Z", lastTime)
            assertEquals(10, todayMinutes)
            assertEquals(7, goalMinutes)
            assertEquals(10, lastDurationMinutes)
        }
        val timer = requireNotNull(snapshot.activeTimer)
        assertEquals(timer, snapshot.activeTimers.first())
        assertEquals(4, snapshot.activeTimers.size)
        assertEquals("feeding", timer.type)
        assertEquals("2026-08-21T12:45:00.000Z", timer.startTime)
        assertEquals("sibling-timer", timer.timerInstanceId)
        assertEquals("Snapshot Member", timer.context)
        assertTrue(requireNotNull(timer.isRemote))
        assertFalse(requireNotNull(timer.isPaused))
        assertNull(timer.accumulatedSeconds)
        with(snapshot.activeTimers[2]) {
            assertEquals("pumping", type)
            assertTrue(requireNotNull(isPaused))
            assertEquals(123, accumulatedSeconds)
        }
    }

    @Test
    fun rejectsAnUnknownRpcFieldSoModelDriftIsVisible() {
        val json = requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText()
        val changed = JSONObject(json).put("newRpcField", "requires a Kotlin model decision")

        assertThrows(IllegalArgumentException::class.java) {
            ActivitySnapshotCodec.decode(changed.toString())
        }
    }
}
