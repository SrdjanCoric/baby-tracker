package com.sofibaby.app.wear

import org.json.JSONObject

// Keep this contract in parity with targets/watch/WatchActivitySummary.swift and migration 061.
data class ActivitySnapshot(
    val schemaVersion: Int,
    val serverAsOf: String,
    val timezone: String,
    val localDay: LocalDay,
    val babyId: String,
    val babyName: String,
    val activities: Activities,
    val activeTimer: ActiveTimer?,
    val activeTimers: List<ActiveTimer>,
    val updatedAt: String,
) {
    data class LocalDay(val startedAt: String, val endsAt: String)

    data class Activities(
        val feeding: Feeding,
        val sleep: Sleep,
        val diaper: Diaper,
        val pumping: Pumping,
        val growth: Growth,
        val tummyTime: TummyTime,
    )

    data class Feeding(
        val lastTime: String?,
        val todayCount: Int,
        val lastType: String?,
        val lastSide: String?,
    )

    data class Sleep(
        val lastTime: String?,
        val todayMinutes: Int,
        val goalMinutes: Int,
        val lastDurationMinutes: Int?,
        val isActive: Boolean,
        val sleepType: String?,
        val wakeWindowMinutes: Int?,
        val wakeWindowSlotLabel: String?,
        val wakeWindowRequiresNewbornOptIn: Boolean?,
        val lastSleepEndedAt: String?,
        val napCountToday: Int?,
        val morningConfirmationPending: Boolean?,
    )

    data class Diaper(
        val lastTime: String?,
        val todayCounts: DiaperCounts,
        val lastType: String?,
    )

    data class DiaperCounts(val wet: Int, val dirty: Int, val mixed: Int, val dry: Int)

    data class Pumping(
        val lastTime: String?,
        val todayVolumeMl: Double,
        val sessionCount: Int,
        val lastSide: String?,
    )

    data class Growth(val lastMeasurement: GrowthMeasurement?)

    data class GrowthMeasurement(
        val date: String,
        val weightKg: Double?,
        val heightCm: Double?,
        val headCircumferenceCm: Double?,
    )

    data class TummyTime(
        val lastTime: String?,
        val todayMinutes: Int,
        val goalMinutes: Int,
        val lastDurationMinutes: Int?,
    )

    data class ActiveTimer(
        val type: String,
        val startTime: String,
        val timerInstanceId: String?,
        val context: String?,
        val isRemote: Boolean?,
        val isPaused: Boolean?,
        val accumulatedSeconds: Int?,
    )
}

object ActivitySnapshotCodec {
    fun decode(json: String): ActivitySnapshot {
        val root = JSONObject(json)
        root.requireOnly(
            "schemaVersion", "serverAsOf", "timezone", "localDay", "babyId", "babyName",
            "activities", "activeTimer", "activeTimers", "updatedAt",
        )
        require(root.getInt("schemaVersion") == 1) { "Unsupported snapshot schema version" }
        val localDay = root.getJSONObject("localDay")
        val activities = root.getJSONObject("activities")
        val feeding = activities.getJSONObject("feeding")
        val sleep = activities.getJSONObject("sleep")
        val diaper = activities.getJSONObject("diaper")
        val counts = diaper.getJSONObject("todayCounts")
        val pumping = activities.getJSONObject("pumping")
        val growth = activities.getJSONObject("growth")
        val tummyTime = activities.getJSONObject("tummyTime")
        localDay.requireOnly("startedAt", "endsAt")
        activities.requireOnly("feeding", "sleep", "diaper", "pumping", "growth", "tummyTime")
        feeding.requireOnly("lastTime", "todayCount", "lastType", "lastSide")
        sleep.requireOnly(
            "lastTime", "todayMinutes", "goalMinutes", "lastDurationMinutes", "isActive",
            "sleepType", "wakeWindowMinutes", "wakeWindowSlotLabel",
            "wakeWindowRequiresNewbornOptIn", "lastSleepEndedAt", "napCountToday",
            "morningConfirmationPending",
        )
        diaper.requireOnly("lastTime", "todayCounts", "lastType")
        counts.requireOnly("wet", "dirty", "mixed", "dry")
        pumping.requireOnly("lastTime", "todayVolumeMl", "sessionCount", "lastSide")
        growth.requireOnly("lastMeasurement")
        tummyTime.requireOnly("lastTime", "todayMinutes", "goalMinutes", "lastDurationMinutes")
        val timersJson = root.getJSONArray("activeTimers")
        val timers = (0 until timersJson.length()).map { decodeTimer(timersJson.getJSONObject(it)) }
        val singular = root.nullableObject("activeTimer")?.let(::decodeTimer)
        require(singular == timers.firstOrNull()) { "activeTimer must equal the first activeTimers entry" }

        return ActivitySnapshot(
            schemaVersion = root.getInt("schemaVersion"),
            serverAsOf = root.getString("serverAsOf"),
            timezone = root.getString("timezone"),
            localDay = ActivitySnapshot.LocalDay(
                startedAt = localDay.getString("startedAt"),
                endsAt = localDay.getString("endsAt"),
            ),
            babyId = root.getString("babyId"),
            babyName = root.getString("babyName"),
            activities = ActivitySnapshot.Activities(
                feeding = ActivitySnapshot.Feeding(
                    lastTime = feeding.nullableString("lastTime"),
                    todayCount = feeding.getInt("todayCount"),
                    lastType = feeding.nullableString("lastType"),
                    lastSide = feeding.nullableString("lastSide"),
                ),
                sleep = ActivitySnapshot.Sleep(
                    lastTime = sleep.nullableString("lastTime"),
                    todayMinutes = sleep.getInt("todayMinutes"),
                    goalMinutes = sleep.getInt("goalMinutes"),
                    lastDurationMinutes = sleep.nullableInt("lastDurationMinutes"),
                    isActive = sleep.getBoolean("isActive"),
                    sleepType = sleep.nullableString("sleepType"),
                    wakeWindowMinutes = sleep.nullableInt("wakeWindowMinutes"),
                    wakeWindowSlotLabel = sleep.nullableString("wakeWindowSlotLabel"),
                    wakeWindowRequiresNewbornOptIn = sleep.nullableBoolean("wakeWindowRequiresNewbornOptIn"),
                    lastSleepEndedAt = sleep.nullableString("lastSleepEndedAt"),
                    napCountToday = sleep.nullableInt("napCountToday"),
                    morningConfirmationPending = sleep.nullableBoolean("morningConfirmationPending"),
                ),
                diaper = ActivitySnapshot.Diaper(
                    lastTime = diaper.nullableString("lastTime"),
                    todayCounts = ActivitySnapshot.DiaperCounts(
                        wet = counts.getInt("wet"),
                        dirty = counts.getInt("dirty"),
                        mixed = counts.getInt("mixed"),
                        dry = counts.getInt("dry"),
                    ),
                    lastType = diaper.nullableString("lastType"),
                ),
                pumping = ActivitySnapshot.Pumping(
                    lastTime = pumping.nullableString("lastTime"),
                    todayVolumeMl = pumping.getDouble("todayVolumeMl"),
                    sessionCount = pumping.getInt("sessionCount"),
                    lastSide = pumping.nullableString("lastSide"),
                ),
                growth = ActivitySnapshot.Growth(
                    lastMeasurement = growth.nullableObject("lastMeasurement")?.let { measurement ->
                        measurement.requireOnly("date", "weightKg", "heightCm", "headCircumferenceCm")
                        ActivitySnapshot.GrowthMeasurement(
                            date = measurement.getString("date"),
                            weightKg = measurement.nullableDouble("weightKg"),
                            heightCm = measurement.nullableDouble("heightCm"),
                            headCircumferenceCm = measurement.nullableDouble("headCircumferenceCm"),
                        )
                    },
                ),
                tummyTime = ActivitySnapshot.TummyTime(
                    lastTime = tummyTime.nullableString("lastTime"),
                    todayMinutes = tummyTime.getInt("todayMinutes"),
                    goalMinutes = tummyTime.getInt("goalMinutes"),
                    lastDurationMinutes = tummyTime.nullableInt("lastDurationMinutes"),
                ),
            ),
            activeTimer = singular,
            activeTimers = timers,
            updatedAt = root.getString("updatedAt"),
        )
    }

    private fun decodeTimer(json: JSONObject): ActivitySnapshot.ActiveTimer {
        json.requireOnly(
            "type", "startTime", "timerInstanceId", "context", "isRemote", "isPaused",
            "accumulatedSeconds",
        )
        return ActivitySnapshot.ActiveTimer(
            type = json.getString("type"),
            startTime = json.getString("startTime"),
            timerInstanceId = json.nullableString("timerInstanceId"),
            context = json.nullableString("context"),
            isRemote = json.nullableBoolean("isRemote"),
            isPaused = json.nullableBoolean("isPaused"),
            accumulatedSeconds = json.nullableInt("accumulatedSeconds"),
        )
    }

    private fun JSONObject.requireOnly(vararg allowedKeys: String) {
        val allowed = allowedKeys.toSet()
        val unknown = keys().asSequence().filterNot(allowed::contains).toList()
        require(unknown.isEmpty()) { "Unknown snapshot fields: ${unknown.joinToString()}" }
    }

    private fun JSONObject.nullableObject(key: String): JSONObject? =
        if (!has(key) || isNull(key)) null else getJSONObject(key)

    private fun JSONObject.nullableString(key: String): String? =
        if (!has(key) || isNull(key)) null else getString(key)

    private fun JSONObject.nullableInt(key: String): Int? =
        if (!has(key) || isNull(key)) null else getInt(key)

    private fun JSONObject.nullableDouble(key: String): Double? =
        if (!has(key) || isNull(key)) null else getDouble(key)

    private fun JSONObject.nullableBoolean(key: String): Boolean? =
        if (!has(key) || isNull(key)) null else getBoolean(key)
}
