package com.sofibaby.app.wear

import android.content.SharedPreferences
import java.time.Instant
import java.time.format.DateTimeFormatterBuilder
import java.util.UUID
import org.json.JSONObject

enum class DiaperType(val wireValue: String) {
    Wet("wet"),
    Dirty("dirty"),
    Mixed("mixed"),
    Dry("dry"),
}

enum class StoolColor(val wireValue: String) {
    Yellow("yellow"),
    Brown("brown"),
    Green("green"),
    Orange("orange"),
    Black("black"),
    White("white"),
    Red("red"),
}

data class WearClockState(val millis: Long, val counter: Int)

interface WearClockStore {
    val deviceId: String
    fun load(): WearClockState?
    fun save(state: WearClockState)
}

class InMemoryWearClockStore(
    override val deviceId: String,
    private var state: WearClockState? = null,
) : WearClockStore {
    override fun load(): WearClockState? = state
    override fun save(state: WearClockState) {
        this.state = state
    }
}

class SharedPreferencesWearClockStore(
    private val preferences: SharedPreferences,
    deviceIds: () -> String = { UUID.randomUUID().toString() },
) : WearClockStore {
    override val deviceId: String = preferences.getString(DEVICE_ID_KEY, null)
        ?.takeIf { it.isNotBlank() && !it.contains('/') && !it.contains('\\') }
        ?: "wear-${deviceIds()}".also {
            check(preferences.edit().putString(DEVICE_ID_KEY, it).commit()) {
                "Could not persist Wear device ID"
            }
        }

    override fun load(): WearClockState? {
        if (!preferences.contains(MILLIS_KEY)) return null
        val millis = preferences.getLong(MILLIS_KEY, Long.MIN_VALUE)
        val counter = preferences.getInt(COUNTER_KEY, -1)
        return if (millis == Long.MIN_VALUE || counter !in 0..9_999) null else WearClockState(millis, counter)
    }

    override fun save(state: WearClockState) {
        check(
            preferences.edit()
                .putLong(MILLIS_KEY, state.millis)
                .putInt(COUNTER_KEY, state.counter)
                .commit(),
        ) { "Could not persist Wear HLC state" }
    }

    private companion object {
        const val DEVICE_ID_KEY = "device-id"
        const val MILLIS_KEY = "hlc-millis"
        const val COUNTER_KEY = "hlc-counter"
    }
}

class WearHybridLogicalClock(
    private val store: WearClockStore,
    private val wallClockMillis: () -> Long,
) {
    private var state = store.load()

    fun issue(): String = issueBatch(1).single()

    @Synchronized
    fun issueBatch(count: Int): List<String> {
        require(count > 0) { "Clock batch must not be empty" }
        var nextState = state
        val clocks = buildList {
            repeat(count) {
                val now = wallClockMillis()
                val previous = nextState
                var millis = maxOf(now, previous?.millis ?: Long.MIN_VALUE)
                var counter = if (previous != null && millis == previous.millis) previous.counter + 1 else 0
                if (counter > 9_999) {
                    millis += counter / 10_000
                    counter %= 10_000
                }
                nextState = WearClockState(millis, counter)
                add(
                    "${MILLISECOND_INSTANT.format(Instant.ofEpochMilli(millis))}-" +
                        "${counter.toString().padStart(4, '0')}-${store.deviceId}",
                )
            }
        }
        val finalState = requireNotNull(nextState)
        store.save(finalState)
        state = finalState
        return clocks
    }
}

sealed interface WriteOutcome {
    data class Success(val recordId: String) : WriteOutcome
    data object Unauthorized : WriteOutcome
    data object Offline : WriteOutcome
    data object Failed : WriteOutcome
}

enum class BreastSide(val wireValue: String) {
    Left("left"),
    Right("right"),
}

data class FeedingTimerDraft(
    val timerInstanceId: String,
    val activityId: String,
    val startedAt: String,
    val side: BreastSide,
    val rpcBody: String,
)

data class CompletedFeedingDraft(
    val recordId: String,
    val mergeBody: String?,
    val releaseBody: String,
)

data class BottleFeedingDraft(
    val recordId: String,
    val selection: BottleLogSelection,
    val rpcBody: String,
)

sealed interface TimerWriteOutcome {
    data class Success(val draft: FeedingTimerDraft, val persistedStartedAt: String) : TimerWriteOutcome
    data class AlreadyActive(
        val lockHolderId: String?,
        val lockHolderName: String?,
        val startedAt: String?,
    ) : TimerWriteOutcome
    data object Unauthorized : TimerWriteOutcome
    data object Offline : TimerWriteOutcome
    data object Failed : TimerWriteOutcome
}

sealed interface TimerReadOutcome {
    data class Success(val timer: RestoredFeedingTimer) : TimerReadOutcome
    data object Missing : TimerReadOutcome
    data object Unauthorized : TimerReadOutcome
    data object Offline : TimerReadOutcome
    data object Failed : TimerReadOutcome
}

sealed interface TimerMutationOutcome {
    data class Success(val timer: RestoredFeedingTimer) : TimerMutationOutcome
    data object Unauthorized : TimerMutationOutcome
    data object Offline : TimerMutationOutcome
    data object Failed : TimerMutationOutcome
}

data class DiaperWriteDraft(
    val recordId: String,
    val operationId: String,
    val type: DiaperType,
    val stoolColor: StoolColor?,
    val rpcBody: String,
)

fun interface DiaperDraftWriter {
    fun write(session: WearSessionEnvelope.Active, draft: DiaperWriteDraft): WriteOutcome
}

class SupabaseWriteClient(
    private val transport: WearHttpTransport,
    private val ids: () -> String = { UUID.randomUUID().toString() },
    private val wallClockMillis: () -> Long = System::currentTimeMillis,
    clockStore: WearClockStore,
) {
    private val hlc = WearHybridLogicalClock(clockStore, wallClockMillis)

    fun logDiaper(
        session: WearSessionEnvelope.Active,
        type: DiaperType,
        stoolColor: StoolColor?,
    ): WriteOutcome = writeDiaper(session, newDiaperDraft(session, type, stoolColor))

    fun newDiaperDraft(
        session: WearSessionEnvelope.Active,
        type: DiaperType,
        stoolColor: StoolColor?,
    ): DiaperWriteDraft {
        require(type == DiaperType.Dirty || type == DiaperType.Mixed || stoolColor == null) {
            "Stool color is only valid for dirty or mixed diapers"
        }
        val id = ids()
        val timestamp = MILLISECOND_INSTANT.format(Instant.ofEpochMilli(wallClockMillis()))
        val record = JSONObject()
            .put("id", id)
            .put("baby_id", session.baby.id)
            .put("type", type.wireValue)
        if (stoolColor != null) record.put("stool_color", stoolColor.wireValue)
        record
            .put("changed_at", timestamp)
            .put("logged_by", session.account.id)
            .put("created_at", timestamp)
        val clockedFields = buildList {
            add("id")
            add("baby_id")
            add("type")
            if (stoolColor != null) add("stool_color")
            add("changed_at")
            add("logged_by")
            add("created_at")
        }
        val clocks = JSONObject()
        clockedFields.zip(hlc.issueBatch(clockedFields.size)).forEach { (field, clock) ->
            clocks.put(field, clock)
        }
        val operationId = "wear-diaper:$id"
        val body = JSONObject()
            .put("p_table", "diapers")
            .put("p_record", record)
            .put("p_field_clocks", clocks)
            .put("p_operation_id", operationId)
            .put("p_expected_user_id", session.account.id)
            .toString()
        return DiaperWriteDraft(id, operationId, type, stoolColor, body)
    }

    fun writeDiaper(
        session: WearSessionEnvelope.Active,
        draft: DiaperWriteDraft,
    ): WriteOutcome {
        val request = WearHttpRequest(
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/merge_record",
            method = "POST",
            headers = mapOf(
                "Content-Type" to "application/json",
                "apikey" to session.supabase.anonKey,
                "Authorization" to "Bearer ${session.accessToken}",
            ),
            body = draft.rpcBody,
        )
        val response = try {
            transport.execute(request)
        } catch (_: Exception) {
            return WriteOutcome.Offline
        }
        return when (response.status) {
            in 200..299 -> WriteOutcome.Success(draft.recordId)
            401 -> WriteOutcome.Unauthorized
            else -> WriteOutcome.Failed
        }
    }

    fun newFeedingTimerDraft(
        session: WearSessionEnvelope.Active,
        side: BreastSide,
    ): FeedingTimerDraft {
        val timerInstanceId = ids()
        val activityId = ids()
        val startedAt = MILLISECOND_INSTANT.format(Instant.ofEpochMilli(wallClockMillis()))
        val timerData = JSONObject()
            .put("timerInstanceId", timerInstanceId)
            .put("activityId", activityId)
            .put("side", side.wireValue)
            .put("type", "breast")
            .put("leftAccumulatedSeconds", 0)
            .put("rightAccumulatedSeconds", 0)
        val body = JSONObject()
            .put("p_baby_id", session.baby.id)
            .put("p_activity_type", "feeding")
            .put("p_user_id", session.account.id)
            .put("p_timer_data", timerData)
            .put("p_started_at", startedAt)
            .toString()
        return FeedingTimerDraft(timerInstanceId, activityId, startedAt, side, body)
    }

    fun startFeedingTimer(
        session: WearSessionEnvelope.Active,
        draft: FeedingTimerDraft,
    ): TimerWriteOutcome {
        val request = WearHttpRequest(
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/acquire_timer_lock",
            method = "POST",
            headers = authenticatedHeaders(session),
            body = draft.rpcBody,
        )
        val response = try {
            transport.execute(request)
        } catch (_: Exception) {
            return TimerWriteOutcome.Offline
        }
        if (response.status == 401) return TimerWriteOutcome.Unauthorized
        if (response.status !in 200..299) return TimerWriteOutcome.Failed
        return try {
            val result = org.json.JSONArray(response.body).getJSONObject(0)
            if (result.getBoolean("success")) {
                TimerWriteOutcome.Success(draft, result.getString("started_at"))
            } else {
                TimerWriteOutcome.AlreadyActive(
                    lockHolderId = result.optString("lock_holder_id").takeIf(String::isNotBlank),
                    lockHolderName = result.optString("lock_holder_name").takeIf(String::isNotBlank),
                    startedAt = result.optString("started_at").takeIf(String::isNotBlank),
                )
            }
        } catch (_: Exception) {
            TimerWriteOutcome.Failed
        }
    }

    fun loadOwnedFeedingTimer(session: WearSessionEnvelope.Active): TimerReadOutcome {
        val request = WearHttpRequest(
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/active_timers" +
                "?select=started_at%2Ctimer_data" +
                "&baby_id=eq.${session.baby.id}" +
                "&activity_type=eq.feeding" +
                "&started_by=eq.${session.account.id}&limit=1",
            method = "GET",
            headers = authenticatedHeaders(session),
            body = "",
        )
        val response = try {
            transport.execute(request)
        } catch (_: Exception) {
            return TimerReadOutcome.Offline
        }
        if (response.status == 401) return TimerReadOutcome.Unauthorized
        if (response.status !in 200..299) return TimerReadOutcome.Failed
        return try {
            val rows = org.json.JSONArray(response.body)
            if (rows.length() == 0) return TimerReadOutcome.Missing
            val row = rows.getJSONObject(0)
            val startedAt = Instant.parse(row.getString("started_at"))
            val data = row.getJSONObject("timer_data")
            val side = when (data.getString("side")) {
                BreastSide.Left.wireValue -> BreastSide.Left
                BreastSide.Right.wireValue -> BreastSide.Right
                else -> return TimerReadOutcome.Failed
            }
            val pausedAt = data.optString("pausedAt").takeIf(String::isNotBlank)?.let(Instant::parse)
            val isPaused = data.optBoolean("isPaused", false)
            val accumulated = data.optInt("accumulatedSeconds")
                .takeIf { data.has("accumulatedSeconds") && !data.isNull("accumulatedSeconds") }
            val now = Instant.ofEpochMilli(wallClockMillis())
            TimerReadOutcome.Success(
                RestoredFeedingTimer(
                    timerInstanceId = data.optString("timerInstanceId").takeIf(String::isNotBlank),
                    activityId = data.optString("activityId").takeIf(String::isNotBlank),
                    startedAt = startedAt,
                    side = side,
                    leftAccumulatedSeconds = data.optInt("leftAccumulatedSeconds", 0),
                    rightAccumulatedSeconds = data.optInt("rightAccumulatedSeconds", 0),
                    currentSideStartedAt = data.optString("currentSideStartedAt")
                        .takeIf(String::isNotBlank)?.let(Instant::parse) ?: startedAt,
                    isPaused = isPaused,
                    accumulatedSeconds = accumulated,
                    totalPausedMs = data.optLong("totalPausedMs", 0L),
                    pausedAt = pausedAt,
                    canControl = true,
                    elapsedSeconds = if (isPaused && accumulated != null) {
                        accumulated.toLong()
                    } else {
                        java.time.Duration.between(startedAt, now).seconds.coerceAtLeast(0)
                    },
                ),
            )
        } catch (_: Exception) {
            TimerReadOutcome.Failed
        }
    }

    fun pauseFeedingTimer(
        session: WearSessionEnvelope.Active,
        timer: RestoredFeedingTimer,
    ): TimerMutationOutcome {
        if (timer.isPaused || !timer.canControl) return TimerMutationOutcome.Failed
        val now = Instant.ofEpochMilli(wallClockMillis())
        val sideElapsed = java.time.Duration.between(timer.currentSideStartedAt, now).seconds.coerceAtLeast(0).toInt()
        val totalElapsed = java.time.Duration.between(timer.startedAt, now).seconds.coerceAtLeast(0).toInt()
        val updated = timer.withCompletedCurrentSide(sideElapsed).copy(
            isPaused = true,
            accumulatedSeconds = totalElapsed,
            pausedAt = now,
            elapsedSeconds = totalElapsed.toLong(),
        )
        return mutateTimer(
            session = session,
            method = "POST",
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/toggle_timer_pause",
            body = JSONObject()
                .put("p_baby_id", session.baby.id)
                .put("p_activity_type", "feeding")
                .put("p_user_id", session.account.id)
                .put("p_timer_data", updated.timerDataJson())
                .toString(),
            updated = updated,
        )
    }

    fun resumeFeedingTimer(
        session: WearSessionEnvelope.Active,
        timer: RestoredFeedingTimer,
    ): TimerMutationOutcome {
        val pausedAt = timer.pausedAt ?: return TimerMutationOutcome.Failed
        if (!timer.isPaused || !timer.canControl) return TimerMutationOutcome.Failed
        val now = Instant.ofEpochMilli(wallClockMillis())
        val pauseDuration = java.time.Duration.between(pausedAt, now).toMillis().coerceAtLeast(0)
        val totalElapsed = java.time.Duration.between(timer.startedAt, now).seconds.coerceAtLeast(0).toInt()
        val updated = timer.copy(
            currentSideStartedAt = now,
            isPaused = false,
            accumulatedSeconds = totalElapsed,
            totalPausedMs = timer.totalPausedMs + pauseDuration,
            pausedAt = null,
            elapsedSeconds = totalElapsed.toLong(),
        )
        return mutateTimer(
            session = session,
            method = "POST",
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/toggle_timer_pause",
            body = JSONObject()
                .put("p_baby_id", session.baby.id)
                .put("p_activity_type", "feeding")
                .put("p_user_id", session.account.id)
                .put("p_timer_data", updated.timerDataJson(effectiveStartTime = timer.startedAt))
                .toString(),
            updated = updated,
        )
    }

    fun switchFeedingSide(
        session: WearSessionEnvelope.Active,
        timer: RestoredFeedingTimer,
    ): TimerMutationOutcome {
        if (timer.isPaused || !timer.canControl) return TimerMutationOutcome.Failed
        val now = Instant.ofEpochMilli(wallClockMillis())
        val sideElapsed = java.time.Duration.between(timer.currentSideStartedAt, now).seconds.coerceAtLeast(0).toInt()
        val updated = timer.withCompletedCurrentSide(sideElapsed).copy(
            side = if (timer.side == BreastSide.Left) BreastSide.Right else BreastSide.Left,
            currentSideStartedAt = now,
            elapsedSeconds = java.time.Duration.between(timer.startedAt, now).seconds.coerceAtLeast(0),
        )
        return mutateTimer(
            session = session,
            method = "PATCH",
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/active_timers" +
                "?baby_id=eq.${session.baby.id}&activity_type=eq.feeding&started_by=eq.${session.account.id}",
            body = JSONObject().put("timer_data", updated.timerDataJson()).toString(),
            updated = updated,
        )
    }

    fun newCompletedFeedingDraft(
        session: WearSessionEnvelope.Active,
        timer: RestoredFeedingTimer,
    ): CompletedFeedingDraft {
        val activityId = requireNotNull(timer.activityId) { "A feeding timer needs an activity ID before completion" }
        val now = Instant.ofEpochMilli(wallClockMillis())
        val endedAt = if (timer.isPaused) requireNotNull(timer.pausedAt) else now
        var leftSeconds = timer.leftAccumulatedSeconds
        var rightSeconds = timer.rightAccumulatedSeconds
        val resumedPauseSeconds = (timer.totalPausedMs / 1_000).coerceAtLeast(0).toInt()
        when (timer.side) {
            BreastSide.Left -> leftSeconds += resumedPauseSeconds
            BreastSide.Right -> rightSeconds += resumedPauseSeconds
        }
        if (!timer.isPaused) {
            val currentSeconds = java.time.Duration.between(timer.currentSideStartedAt, endedAt)
                .seconds.coerceAtLeast(0).toInt()
            when (timer.side) {
                BreastSide.Left -> leftSeconds += currentSeconds
                BreastSide.Right -> rightSeconds += currentSeconds
            }
        }
        val side = if (leftSeconds > 0 && rightSeconds > 0) {
            "both"
        } else if (leftSeconds >= rightSeconds) {
            BreastSide.Left.wireValue
        } else {
            BreastSide.Right.wireValue
        }
        val durationSeconds = java.time.Duration.between(timer.startedAt, endedAt)
            .seconds.coerceAtLeast(0)
        val releaseBody = JSONObject()
            .put("p_baby_id", session.baby.id)
            .put("p_activity_type", "feeding")
            .put("p_user_id", session.account.id)
            .toString()
        if (durationSeconds < 60) {
            return CompletedFeedingDraft(activityId, mergeBody = null, releaseBody = releaseBody)
        }
        val timestamp = MILLISECOND_INSTANT.format(now)
        val record = JSONObject()
            .put("id", activityId)
            .put("baby_id", session.baby.id)
            .put("type", "breast")
            .put("side", side)
            .put("last_finished_side", timer.side.wireValue)
            .put("started_at", MILLISECOND_INSTANT.format(timer.startedAt))
            .put("ended_at", MILLISECOND_INSTANT.format(endedAt))
            .put("duration_seconds", durationSeconds)
        if (leftSeconds > 0) record.put("left_duration_seconds", leftSeconds)
        if (rightSeconds > 0) record.put("right_duration_seconds", rightSeconds)
        record
            .put("logged_by", session.account.id)
            .put("created_at", timestamp)
            .put("updated_at", timestamp)
        val fields = buildList {
            add("id")
            add("baby_id")
            add("type")
            add("side")
            add("last_finished_side")
            add("started_at")
            add("ended_at")
            add("duration_seconds")
            if (leftSeconds > 0) add("left_duration_seconds")
            if (rightSeconds > 0) add("right_duration_seconds")
            add("logged_by")
            add("created_at")
            add("updated_at")
        }
        val clocks = JSONObject()
        fields.zip(hlc.issueBatch(fields.size)).forEach { (field, clock) -> clocks.put(field, clock) }
        val mergeBody = JSONObject()
            .put("p_table", "feedings")
            .put("p_record", record)
            .put("p_field_clocks", clocks)
            .put("p_operation_id", "wear-feeding:$activityId")
            .put("p_expected_user_id", session.account.id)
            .toString()
        return CompletedFeedingDraft(activityId, mergeBody, releaseBody)
    }

    fun completeFeedingTimer(
        session: WearSessionEnvelope.Active,
        draft: CompletedFeedingDraft,
    ): WriteOutcome {
        draft.mergeBody?.let { body ->
            val merge = executeWrite(
                session,
                "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/merge_record",
                body,
            )
            if (merge != null) return merge
        }
        val release = executeWrite(
            session,
            "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/release_timer_lock",
            draft.releaseBody,
        )
        return release ?: WriteOutcome.Success(draft.recordId)
    }

    fun newBottleFeedingDraft(
        session: WearSessionEnvelope.Active,
        selection: BottleLogSelection,
    ): BottleFeedingDraft {
        val id = ids()
        val timestamp = MILLISECOND_INSTANT.format(Instant.ofEpochMilli(wallClockMillis()))
        val record = JSONObject()
            .put("id", id)
            .put("baby_id", session.baby.id)
            .put("type", "bottle")
            .put("started_at", timestamp)
            .put("ended_at", timestamp)
            .put("amount_ml", selection.volumeMl)
            .put("content_type", selection.contentType.wireValue)
            .put("logged_by", session.account.id)
            .put("created_at", timestamp)
            .put("updated_at", timestamp)
        val fields = listOf(
            "id", "baby_id", "type", "started_at", "ended_at", "amount_ml", "content_type",
            "logged_by", "created_at", "updated_at",
        )
        val clocks = JSONObject()
        fields.zip(hlc.issueBatch(fields.size)).forEach { (field, clock) -> clocks.put(field, clock) }
        val body = JSONObject()
            .put("p_table", "feedings")
            .put("p_record", record)
            .put("p_field_clocks", clocks)
            .put("p_operation_id", "wear-bottle:$id")
            .put("p_expected_user_id", session.account.id)
            .toString()
        return BottleFeedingDraft(id, selection, body)
    }

    fun writeBottleFeeding(
        session: WearSessionEnvelope.Active,
        draft: BottleFeedingDraft,
    ): WriteOutcome = executeWrite(
        session,
        "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/merge_record",
        draft.rpcBody,
    ) ?: WriteOutcome.Success(draft.recordId)

    private fun executeWrite(
        session: WearSessionEnvelope.Active,
        url: String,
        body: String,
    ): WriteOutcome? {
        val response = try {
            transport.execute(
                WearHttpRequest(
                    url = url,
                    method = "POST",
                    headers = authenticatedHeaders(session),
                    body = body,
                ),
            )
        } catch (_: Exception) {
            return WriteOutcome.Offline
        }
        return when (response.status) {
            in 200..299 -> null
            401 -> WriteOutcome.Unauthorized
            else -> WriteOutcome.Failed
        }
    }

    private fun RestoredFeedingTimer.withCompletedCurrentSide(seconds: Int): RestoredFeedingTimer =
        when (side) {
            BreastSide.Left -> copy(leftAccumulatedSeconds = leftAccumulatedSeconds + seconds)
            BreastSide.Right -> copy(rightAccumulatedSeconds = rightAccumulatedSeconds + seconds)
        }

    private fun RestoredFeedingTimer.timerDataJson(effectiveStartTime: Instant? = null): JSONObject =
        JSONObject().apply {
            timerInstanceId?.let { put("timerInstanceId", it) }
            activityId?.let { put("activityId", it) }
            put("side", side.wireValue)
            put("type", "breast")
            put("leftAccumulatedSeconds", leftAccumulatedSeconds)
            put("rightAccumulatedSeconds", rightAccumulatedSeconds)
            put("currentSideStartedAt", MILLISECOND_INSTANT.format(currentSideStartedAt))
            put("isPaused", isPaused)
            put("totalPausedMs", totalPausedMs)
            pausedAt?.let { put("pausedAt", MILLISECOND_INSTANT.format(it)) }
            accumulatedSeconds?.let { put("accumulatedSeconds", it) }
            effectiveStartTime?.let { put("effectiveStartTime", MILLISECOND_INSTANT.format(it)) }
        }

    private fun mutateTimer(
        session: WearSessionEnvelope.Active,
        method: String,
        url: String,
        body: String,
        updated: RestoredFeedingTimer,
    ): TimerMutationOutcome {
        val response = try {
            transport.execute(
                WearHttpRequest(
                    url = url,
                    method = method,
                    headers = authenticatedHeaders(session),
                    body = body,
                ),
            )
        } catch (_: Exception) {
            return TimerMutationOutcome.Offline
        }
        return when (response.status) {
            in 200..299 -> TimerMutationOutcome.Success(updated)
            401 -> TimerMutationOutcome.Unauthorized
            else -> TimerMutationOutcome.Failed
        }
    }

    private fun authenticatedHeaders(session: WearSessionEnvelope.Active): Map<String, String> = mapOf(
        "Content-Type" to "application/json",
        "apikey" to session.supabase.anonKey,
        "Authorization" to "Bearer ${session.accessToken}",
    )
}

private val MILLISECOND_INSTANT = DateTimeFormatterBuilder().appendInstant(3).toFormatter()

sealed interface DiaperQuickLogState {
    data object Idle : DiaperQuickLogState
    data object Submitting : DiaperQuickLogState
    data class Error(val message: String, val canRetry: Boolean = true) : DiaperQuickLogState
    data object Success : DiaperQuickLogState
}

fun interface DiaperDraftFactory {
    fun create(
        session: WearSessionEnvelope.Active,
        type: DiaperType,
        stoolColor: StoolColor?,
    ): DiaperWriteDraft
}

class DiaperQuickLogCoordinator(
    private val drafts: DiaperDraftFactory,
    private val writer: DiaperDraftWriter,
    private val refreshSummary: () -> Unit,
    private val dispatch: ((() -> Unit) -> Unit) = { it() },
    private val onUnauthorized: (Long) -> Unit = {},
    private val monotonicMillis: () -> Long = { System.nanoTime() / 1_000_000 },
    private val onStateChanged: (DiaperQuickLogState) -> Unit = {},
) {
    var state: DiaperQuickLogState = DiaperQuickLogState.Idle
        private set(value) {
            field = value
            onStateChanged(value)
    }
    private var pendingDraft: DiaperWriteDraft? = null
    private var lastSubmitType: DiaperType? = null
    private var lastSubmitColor: StoolColor? = null
    private var lastSubmitAt: Long? = null

    @Synchronized
    fun submit(
        session: WearSessionEnvelope.Active,
        type: DiaperType,
        stoolColor: StoolColor?,
    ) {
        if (state == DiaperQuickLogState.Submitting) return
        val retryableDraft = pendingDraft
        if (
            (state as? DiaperQuickLogState.Error)?.canRetry == true &&
            retryableDraft?.type == type && retryableDraft.stoolColor == stoolColor
        ) {
            lastSubmitAt = monotonicMillis()
            start(session) { retryableDraft }
            return
        }
        val now = monotonicMillis()
        val previousSubmitAt = lastSubmitAt
        if (
            type == lastSubmitType && stoolColor == lastSubmitColor && previousSubmitAt != null &&
            now - previousSubmitAt in 0 until SUBMIT_DEBOUNCE_MILLIS
        ) {
            return
        }
        lastSubmitType = type
        lastSubmitColor = stoolColor
        lastSubmitAt = now
        start(session) { drafts.create(session, type, stoolColor) }
    }

    @Synchronized
    fun retry(session: WearSessionEnvelope.Active) {
        if (state == DiaperQuickLogState.Submitting) return
        val draft = pendingDraft ?: return
        start(session) { draft }
    }

    @Synchronized
    fun reset() {
        pendingDraft = null
        lastSubmitType = null
        lastSubmitColor = null
        lastSubmitAt = null
        state = DiaperQuickLogState.Idle
    }

    private fun start(session: WearSessionEnvelope.Active, createDraft: () -> DiaperWriteDraft) {
        state = DiaperQuickLogState.Submitting
        dispatch {
            val draft = try {
                createDraft()
            } catch (_: Exception) {
                synchronized(this) {
                    state = DiaperQuickLogState.Error("Could not log diaper")
                }
                return@dispatch
            }
            synchronized(this) {
                pendingDraft = draft
            }
            val outcome = writer.write(session, draft)
            var shouldRefresh = false
            var unauthorizedRevision: Long? = null
            synchronized(this) {
                state = when (outcome) {
                    is WriteOutcome.Success -> {
                        pendingDraft = null
                        shouldRefresh = true
                        DiaperQuickLogState.Success
                    }
                    WriteOutcome.Offline -> DiaperQuickLogState.Error("No network connection")
                    WriteOutcome.Unauthorized -> {
                        unauthorizedRevision = session.revision
                        DiaperQuickLogState.Error("Session expired", canRetry = false)
                    }
                    WriteOutcome.Failed -> DiaperQuickLogState.Error("Could not log diaper")
                }
            }
            if (shouldRefresh) refreshSummary()
            unauthorizedRevision?.let(onUnauthorized)
        }
    }

    private companion object {
        const val SUBMIT_DEBOUNCE_MILLIS = 1_000L
    }
}
