package com.sofibaby.app.wear

import android.content.SharedPreferences
import java.time.Instant
import java.time.OffsetDateTime
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

enum class TimerActivityType(val wireValue: String) {
    Feeding("feeding"),
    Sleep("sleep"),
    Pumping("pumping"),
    TummyTime("tummy_time"),
}

data class TimerDataCodec<T>(
    val encode: (T) -> JSONObject,
    val decode: (startedAt: Instant, data: JSONObject) -> T,
)

data class SharedTimerDraft<T>(
    val timerInstanceId: String,
    val activityType: TimerActivityType,
    val startedAt: String,
    val timerData: T,
    val rpcBody: String,
)

sealed interface SharedTimerAcquireOutcome<out T> {
    data class Success<T>(val draft: SharedTimerDraft<T>, val persistedStartedAt: String) :
        SharedTimerAcquireOutcome<T>
    data class AlreadyActive(
        val lockHolderId: String?,
        val lockHolderName: String?,
        val startedAt: String?,
    ) : SharedTimerAcquireOutcome<Nothing>
    data object Unauthorized : SharedTimerAcquireOutcome<Nothing>
    data object Offline : SharedTimerAcquireOutcome<Nothing>
    data object Failed : SharedTimerAcquireOutcome<Nothing>
}

sealed interface SharedTimerReadOutcome<out T> {
    data class Success<T>(val timerData: T) : SharedTimerReadOutcome<T>
    data object Missing : SharedTimerReadOutcome<Nothing>
    data object Unauthorized : SharedTimerReadOutcome<Nothing>
    data object Offline : SharedTimerReadOutcome<Nothing>
    data object Failed : SharedTimerReadOutcome<Nothing>
}

sealed interface SharedTimerMutationOutcome<out T> {
    data class Success<T>(val timerData: T) : SharedTimerMutationOutcome<T>
    data object Unauthorized : SharedTimerMutationOutcome<Nothing>
    data object Offline : SharedTimerMutationOutcome<Nothing>
    data object Failed : SharedTimerMutationOutcome<Nothing>
}

enum class TimerMutationRoute {
    TogglePause,
    OwnerPatch,
}

data class SharedTimerCompletionDraft(
    val recordId: String,
    val activityType: TimerActivityType,
    val mergeBody: String?,
)

enum class BreastSide(val wireValue: String) {
    Left("left"),
    Right("right"),
    Both("both"),
}

data class FeedingTimerDraft(
    val timerInstanceId: String,
    val activityId: String,
    val startedAt: String,
    val side: BreastSide,
    val rpcBody: String,
)

private data class FeedingTimerStartData(
    val timerInstanceId: String,
    val activityId: String,
    val side: BreastSide,
)

private val FEEDING_TIMER_START_CODEC = TimerDataCodec<FeedingTimerStartData>(
    encode = { data ->
        JSONObject()
            .put("timerInstanceId", data.timerInstanceId)
            .put("activityId", data.activityId)
            .put("side", data.side.wireValue)
            .put("type", "breast")
            .put("leftAccumulatedSeconds", 0)
            .put("rightAccumulatedSeconds", 0)
    },
    decode = { _, _ -> error("Start-only feeding timer data is not used for hydration") },
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

    fun <T> newTimerDraft(
        session: WearSessionEnvelope.Active,
        activityType: TimerActivityType,
        codec: TimerDataCodec<T>,
        buildTimerData: (timerInstanceId: String, startedAt: String) -> T,
    ): SharedTimerDraft<T> {
        val timerInstanceId = ids()
        val startedAt = MILLISECOND_INSTANT.format(Instant.ofEpochMilli(wallClockMillis()))
        val timerData = buildTimerData(timerInstanceId, startedAt)
        val body = JSONObject()
            .put("p_baby_id", session.baby.id)
            .put("p_activity_type", activityType.wireValue)
            .put("p_user_id", session.account.id)
            .put("p_timer_data", codec.encode(timerData))
            .put("p_started_at", startedAt)
            .toString()
        return SharedTimerDraft(timerInstanceId, activityType, startedAt, timerData, body)
    }

    fun <T> acquireTimer(
        session: WearSessionEnvelope.Active,
        draft: SharedTimerDraft<T>,
    ): SharedTimerAcquireOutcome<T> {
        val response = try {
            transport.execute(
                WearHttpRequest(
                    url = "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/acquire_timer_lock",
                    method = "POST",
                    headers = authenticatedHeaders(session),
                    body = draft.rpcBody,
                ),
            )
        } catch (_: Exception) {
            return SharedTimerAcquireOutcome.Offline
        }
        if (response.status == 401) return SharedTimerAcquireOutcome.Unauthorized
        if (response.status !in 200..299) return SharedTimerAcquireOutcome.Failed
        return try {
            val result = org.json.JSONArray(response.body).getJSONObject(0)
            if (result.getBoolean("success")) {
                SharedTimerAcquireOutcome.Success(draft, result.getString("started_at"))
            } else {
                SharedTimerAcquireOutcome.AlreadyActive(
                    lockHolderId = result.optString("lock_holder_id").takeIf(String::isNotBlank),
                    lockHolderName = result.optString("lock_holder_name").takeIf(String::isNotBlank),
                    startedAt = result.optString("started_at").takeIf(String::isNotBlank),
                )
            }
        } catch (_: Exception) {
            SharedTimerAcquireOutcome.Failed
        }
    }

    fun <T> loadOwnedTimer(
        session: WearSessionEnvelope.Active,
        activityType: TimerActivityType,
        codec: TimerDataCodec<T>,
    ): SharedTimerReadOutcome<T> {
        val response = try {
            transport.execute(
                WearHttpRequest(
                    url = "${session.supabase.url.trimEnd('/')}/rest/v1/active_timers" +
                        "?select=started_at%2Ctimer_data" +
                        "&baby_id=eq.${session.baby.id}" +
                        "&activity_type=eq.${activityType.wireValue}" +
                        "&started_by=eq.${session.account.id}&limit=1",
                    method = "GET",
                    headers = authenticatedHeaders(session),
                    body = "",
                ),
            )
        } catch (_: Exception) {
            return SharedTimerReadOutcome.Offline
        }
        if (response.status == 401) return SharedTimerReadOutcome.Unauthorized
        if (response.status !in 200..299) return SharedTimerReadOutcome.Failed
        return try {
            val rows = org.json.JSONArray(response.body)
            if (rows.length() == 0) return SharedTimerReadOutcome.Missing
            val row = rows.getJSONObject(0)
            SharedTimerReadOutcome.Success(
                codec.decode(
                    requireNotNull(parseServerInstant(row.getString("started_at"))),
                    row.getJSONObject("timer_data"),
                ),
            )
        } catch (_: Exception) {
            SharedTimerReadOutcome.Failed
        }
    }

    fun <T> mutateTimerData(
        session: WearSessionEnvelope.Active,
        activityType: TimerActivityType,
        timerData: T,
        codec: TimerDataCodec<T>,
        route: TimerMutationRoute,
    ): SharedTimerMutationOutcome<T> {
        val encoded = codec.encode(timerData)
        val (method, url, body) = when (route) {
            TimerMutationRoute.TogglePause -> Triple(
                "POST",
                "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/toggle_timer_pause",
                JSONObject()
                    .put("p_baby_id", session.baby.id)
                    .put("p_activity_type", activityType.wireValue)
                    .put("p_user_id", session.account.id)
                    .put("p_timer_data", encoded)
                    .toString(),
            )
            TimerMutationRoute.OwnerPatch -> Triple(
                "PATCH",
                "${session.supabase.url.trimEnd('/')}/rest/v1/active_timers" +
                    "?baby_id=eq.${session.baby.id}" +
                    "&activity_type=eq.${activityType.wireValue}" +
                    "&started_by=eq.${session.account.id}",
                JSONObject().put("timer_data", encoded).toString(),
            )
        }
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
            return SharedTimerMutationOutcome.Offline
        }
        return when (response.status) {
            in 200..299 -> SharedTimerMutationOutcome.Success(timerData)
            401 -> SharedTimerMutationOutcome.Unauthorized
            else -> SharedTimerMutationOutcome.Failed
        }
    }

    fun completeTimer(
        session: WearSessionEnvelope.Active,
        draft: SharedTimerCompletionDraft,
    ): WriteOutcome {
        draft.mergeBody?.let { body ->
            val merge = executeWrite(
                session,
                "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/merge_record",
                body,
            )
            if (merge != null) return merge
        }
        val releaseBody = JSONObject()
            .put("p_baby_id", session.baby.id)
            .put("p_activity_type", draft.activityType.wireValue)
            .put("p_user_id", session.account.id)
            .toString()
        val release = executeWrite(
            session,
            "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/release_timer_lock",
            releaseBody,
        )
        return release ?: WriteOutcome.Success(draft.recordId)
    }

    fun newSleepTimerDraft(session: WearSessionEnvelope.Active): SleepTimerDraft {
        val now = Instant.ofEpochMilli(wallClockMillis())
        val type = SleepTypeClassifier.at(now, session.baby.timezone)
        val shared = newTimerDraft(session, TimerActivityType.Sleep, SLEEP_TIMER_START_CODEC) {
                timerInstanceId, _ ->
            SleepTimerData(timerInstanceId, ids(), type)
        }
        return SleepTimerDraft(
            timerInstanceId = shared.timerInstanceId,
            activityId = shared.timerData.activityId,
            startedAt = shared.startedAt,
            type = shared.timerData.type,
            rpcBody = shared.rpcBody,
        )
    }

    fun startSleepTimer(
        session: WearSessionEnvelope.Active,
        draft: SleepTimerDraft,
    ): SleepTimerWriteOutcome {
        val shared = SharedTimerDraft(
            timerInstanceId = draft.timerInstanceId,
            activityType = TimerActivityType.Sleep,
            startedAt = draft.startedAt,
            timerData = SleepTimerData(draft.timerInstanceId, draft.activityId, draft.type),
            rpcBody = draft.rpcBody,
        )
        return when (val outcome = acquireTimer(session, shared)) {
            is SharedTimerAcquireOutcome.Success -> SleepTimerWriteOutcome.Success(outcome.persistedStartedAt)
            is SharedTimerAcquireOutcome.AlreadyActive -> SleepTimerWriteOutcome.AlreadyActive(
                outcome.lockHolderId,
                outcome.lockHolderName,
                outcome.startedAt,
            )
            SharedTimerAcquireOutcome.Unauthorized -> SleepTimerWriteOutcome.Unauthorized
            SharedTimerAcquireOutcome.Offline -> SleepTimerWriteOutcome.Offline
            SharedTimerAcquireOutcome.Failed -> SleepTimerWriteOutcome.Failed
        }
    }

    fun pauseSleepTimer(
        session: WearSessionEnvelope.Active,
        timer: RestoredSleepTimer,
    ): SleepTimerMutationOutcome {
        if (timer.isPaused || !timer.canControl) return SleepTimerMutationOutcome.Failed
        val now = Instant.ofEpochMilli(wallClockMillis())
        val totalElapsed = java.time.Duration.between(timer.startedAt, now).seconds.coerceAtLeast(0).toInt()
        val updated = timer.copy(
            isPaused = true,
            accumulatedSeconds = totalElapsed,
            pausedAt = now,
            elapsedSeconds = totalElapsed.toLong(),
        )
        return mutateSleepTimer(session, updated)
    }

    fun loadOwnedSleepTimer(session: WearSessionEnvelope.Active): SleepTimerReadOutcome {
        return when (
            val outcome = loadOwnedTimer(
                session,
                TimerActivityType.Sleep,
                restoredSleepTimerCodec(),
            )
        ) {
            is SharedTimerReadOutcome.Success -> SleepTimerReadOutcome.Success(outcome.timerData)
            SharedTimerReadOutcome.Missing -> SleepTimerReadOutcome.Missing
            SharedTimerReadOutcome.Unauthorized -> SleepTimerReadOutcome.Unauthorized
            SharedTimerReadOutcome.Offline -> SleepTimerReadOutcome.Offline
            SharedTimerReadOutcome.Failed -> SleepTimerReadOutcome.Failed
        }
    }

    fun resumeSleepTimer(
        session: WearSessionEnvelope.Active,
        timer: RestoredSleepTimer,
    ): SleepTimerMutationOutcome {
        val pausedAt = timer.pausedAt ?: return SleepTimerMutationOutcome.Failed
        if (!timer.isPaused || !timer.canControl) return SleepTimerMutationOutcome.Failed
        val now = Instant.ofEpochMilli(wallClockMillis())
        val pauseDuration = java.time.Duration.between(pausedAt, now).toMillis().coerceAtLeast(0)
        val totalElapsed = java.time.Duration.between(timer.startedAt, now).seconds.coerceAtLeast(0).toInt()
        val updated = timer.copy(
            isPaused = false,
            accumulatedSeconds = totalElapsed,
            totalPausedMs = timer.totalPausedMs + pauseDuration,
            pausedAt = null,
            elapsedSeconds = totalElapsed.toLong(),
        )
        return mutateSleepTimer(session, updated)
    }

    private fun mutateSleepTimer(
        session: WearSessionEnvelope.Active,
        timer: RestoredSleepTimer,
    ): SleepTimerMutationOutcome {
        val timerData = SleepTimerData(
            timerInstanceId = requireNotNull(timer.timerInstanceId),
            activityId = requireNotNull(timer.activityId),
            type = timer.type,
            morningClassification = timer.morningClassification,
            morningClassificationVersion = timer.morningClassificationVersion,
            isPaused = timer.isPaused,
            totalPausedMs = timer.totalPausedMs,
            pausedAt = timer.pausedAt,
            accumulatedSeconds = timer.accumulatedSeconds,
        )
        return when (
            mutateTimerData(
                session,
                TimerActivityType.Sleep,
                timerData,
                SLEEP_TIMER_CODEC,
                TimerMutationRoute.TogglePause,
            )
        ) {
            is SharedTimerMutationOutcome.Success -> SleepTimerMutationOutcome.Success(timer)
            SharedTimerMutationOutcome.Unauthorized -> SleepTimerMutationOutcome.Unauthorized
            SharedTimerMutationOutcome.Offline -> SleepTimerMutationOutcome.Offline
            SharedTimerMutationOutcome.Failed -> SleepTimerMutationOutcome.Failed
        }
    }

    private fun restoredSleepTimerCodec(): TimerDataCodec<RestoredSleepTimer> = TimerDataCodec(
        encode = { timer ->
            SLEEP_TIMER_CODEC.encode(
                SleepTimerData(
                    timerInstanceId = requireNotNull(timer.timerInstanceId),
                    activityId = requireNotNull(timer.activityId),
                    type = timer.type,
                    morningClassification = timer.morningClassification,
                    morningClassificationVersion = timer.morningClassificationVersion,
                    isPaused = timer.isPaused,
                    totalPausedMs = timer.totalPausedMs,
                    pausedAt = timer.pausedAt,
                    accumulatedSeconds = timer.accumulatedSeconds,
                ),
            )
        },
        decode = { startedAt, data ->
            val decoded = SLEEP_TIMER_CODEC.decode(startedAt, data)
            RestoredSleepTimer(
                timerInstanceId = decoded.timerInstanceId,
                activityId = decoded.activityId,
                startedAt = startedAt,
                type = decoded.type,
                isPaused = decoded.isPaused,
                accumulatedSeconds = decoded.accumulatedSeconds,
                totalPausedMs = decoded.totalPausedMs,
                pausedAt = decoded.pausedAt,
                canControl = true,
                elapsedSeconds = if (decoded.isPaused && decoded.accumulatedSeconds != null) {
                    decoded.accumulatedSeconds.toLong()
                } else {
                    java.time.Duration.between(
                        startedAt,
                        Instant.ofEpochMilli(wallClockMillis()),
                    ).seconds.coerceAtLeast(0)
                },
                morningClassification = decoded.morningClassification,
                morningClassificationVersion = decoded.morningClassificationVersion,
            )
        },
    )

    fun newCompletedSleepDraft(
        session: WearSessionEnvelope.Active,
        timer: RestoredSleepTimer,
    ): CompletedSleepDraft {
        val activityId = requireNotNull(timer.activityId) { "A sleep timer needs an activity ID before completion" }
        val now = Instant.ofEpochMilli(wallClockMillis())
        val endedAt = if (timer.isPaused) requireNotNull(timer.pausedAt) else now
        val durationSeconds = java.time.Duration.between(timer.startedAt, endedAt).seconds.coerceAtLeast(0)
        if (durationSeconds < 60) return CompletedSleepDraft(activityId, mergeBody = null)
        val timestamp = MILLISECOND_INSTANT.format(now)
        val record = JSONObject()
            .put("id", activityId)
            .put("baby_id", session.baby.id)
            .put("type", SleepTypeClassifier.classify(timer.startedAt, endedAt, session.baby.timezone).wireValue)
            .put("started_at", MILLISECOND_INSTANT.format(timer.startedAt))
            .put("ended_at", MILLISECOND_INSTANT.format(endedAt))
            .put("duration_seconds", durationSeconds)
            .put("logged_by", session.account.id)
            .put("morning_classification", "automatic")
            .put("morning_classification_version", 1)
            .put("created_at", timestamp)
            .put("updated_at", timestamp)
        val fields = listOf(
            "id", "baby_id", "type", "started_at", "ended_at", "duration_seconds",
            "logged_by", "morning_classification", "morning_classification_version",
            "created_at", "updated_at",
        )
        val clocks = JSONObject()
        fields.zip(hlc.issueBatch(fields.size)).forEach { (field, clock) -> clocks.put(field, clock) }
        val mergeBody = JSONObject()
            .put("p_table", "sleep_sessions")
            .put("p_record", record)
            .put("p_field_clocks", clocks)
            .put("p_operation_id", "wear-sleep:$activityId")
            .put("p_expected_user_id", session.account.id)
            .toString()
        return CompletedSleepDraft(activityId, mergeBody)
    }

    fun completeSleepTimer(
        session: WearSessionEnvelope.Active,
        draft: CompletedSleepDraft,
    ): WriteOutcome = completeTimer(
        session,
        SharedTimerCompletionDraft(
            recordId = draft.recordId,
            activityType = TimerActivityType.Sleep,
            mergeBody = draft.mergeBody,
        ),
    )

    fun newFeedingTimerDraft(
        session: WearSessionEnvelope.Active,
        side: BreastSide,
    ): FeedingTimerDraft {
        val shared = newTimerDraft(session, TimerActivityType.Feeding, FEEDING_TIMER_START_CODEC) {
                timerInstanceId, _ ->
            FeedingTimerStartData(timerInstanceId, ids(), side)
        }
        return FeedingTimerDraft(
            timerInstanceId = shared.timerInstanceId,
            activityId = shared.timerData.activityId,
            startedAt = shared.startedAt,
            side = shared.timerData.side,
            rpcBody = shared.rpcBody,
        )
    }

    fun startFeedingTimer(
        session: WearSessionEnvelope.Active,
        draft: FeedingTimerDraft,
    ): TimerWriteOutcome {
        val shared = SharedTimerDraft(
            timerInstanceId = draft.timerInstanceId,
            activityType = TimerActivityType.Feeding,
            startedAt = draft.startedAt,
            timerData = FeedingTimerStartData(draft.timerInstanceId, draft.activityId, draft.side),
            rpcBody = draft.rpcBody,
        )
        return when (val outcome = acquireTimer(session, shared)) {
            is SharedTimerAcquireOutcome.Success -> TimerWriteOutcome.Success(draft, outcome.persistedStartedAt)
            is SharedTimerAcquireOutcome.AlreadyActive -> TimerWriteOutcome.AlreadyActive(
                outcome.lockHolderId,
                outcome.lockHolderName,
                outcome.startedAt,
            )
            SharedTimerAcquireOutcome.Unauthorized -> TimerWriteOutcome.Unauthorized
            SharedTimerAcquireOutcome.Offline -> TimerWriteOutcome.Offline
            SharedTimerAcquireOutcome.Failed -> TimerWriteOutcome.Failed
        }
    }

    fun loadOwnedFeedingTimer(session: WearSessionEnvelope.Active): TimerReadOutcome {
        return when (
            val outcome = loadOwnedTimer(
                session,
                TimerActivityType.Feeding,
                restoredFeedingTimerCodec(),
            )
        ) {
            is SharedTimerReadOutcome.Success -> TimerReadOutcome.Success(outcome.timerData)
            SharedTimerReadOutcome.Missing -> TimerReadOutcome.Missing
            SharedTimerReadOutcome.Unauthorized -> TimerReadOutcome.Unauthorized
            SharedTimerReadOutcome.Offline -> TimerReadOutcome.Offline
            SharedTimerReadOutcome.Failed -> TimerReadOutcome.Failed
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
        return mutateTimerData(
            session,
            TimerActivityType.Feeding,
            updated,
            restoredFeedingTimerCodec(),
            TimerMutationRoute.TogglePause,
        ).toFeedingMutationOutcome()
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
        return mutateTimerData(
            session,
            TimerActivityType.Feeding,
            updated,
            restoredFeedingTimerCodec(effectiveStartTime = timer.startedAt),
            TimerMutationRoute.TogglePause,
        ).toFeedingMutationOutcome()
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
        return mutateTimerData(
            session,
            TimerActivityType.Feeding,
            updated,
            restoredFeedingTimerCodec(),
            TimerMutationRoute.OwnerPatch,
        ).toFeedingMutationOutcome()
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
            BreastSide.Both -> {
                leftSeconds += resumedPauseSeconds
                rightSeconds += resumedPauseSeconds
            }
        }
        if (!timer.isPaused) {
            val currentSeconds = java.time.Duration.between(timer.currentSideStartedAt, endedAt)
                .seconds.coerceAtLeast(0).toInt()
            when (timer.side) {
                BreastSide.Left -> leftSeconds += currentSeconds
                BreastSide.Right -> rightSeconds += currentSeconds
                BreastSide.Both -> {
                    leftSeconds += currentSeconds
                    rightSeconds += currentSeconds
                }
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
    ): WriteOutcome = completeTimer(
        session,
        SharedTimerCompletionDraft(
            recordId = draft.recordId,
            activityType = TimerActivityType.Feeding,
            mergeBody = draft.mergeBody,
        ),
    )

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
            BreastSide.Both -> copy(
                leftAccumulatedSeconds = leftAccumulatedSeconds + seconds,
                rightAccumulatedSeconds = rightAccumulatedSeconds + seconds,
            )
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

    private fun restoredFeedingTimerCodec(
        effectiveStartTime: Instant? = null,
    ): TimerDataCodec<RestoredFeedingTimer> = TimerDataCodec(
        encode = { it.timerDataJson(effectiveStartTime) },
        decode = { startedAt, data ->
            val side = when (data.getString("side")) {
                BreastSide.Left.wireValue -> BreastSide.Left
                BreastSide.Right.wireValue -> BreastSide.Right
                BreastSide.Both.wireValue -> BreastSide.Both
                else -> error("Invalid breast side")
            }
            val pausedAt = data.optString("pausedAt").takeIf(String::isNotBlank)?.let(Instant::parse)
            val isPaused = data.optBoolean("isPaused", false)
            val accumulated = data.optInt("accumulatedSeconds")
                .takeIf { data.has("accumulatedSeconds") && !data.isNull("accumulatedSeconds") }
            val now = Instant.ofEpochMilli(wallClockMillis())
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
            )
        },
    )

    private fun SharedTimerMutationOutcome<RestoredFeedingTimer>.toFeedingMutationOutcome():
        TimerMutationOutcome = when (this) {
        is SharedTimerMutationOutcome.Success -> TimerMutationOutcome.Success(timerData)
        SharedTimerMutationOutcome.Unauthorized -> TimerMutationOutcome.Unauthorized
        SharedTimerMutationOutcome.Offline -> TimerMutationOutcome.Offline
        SharedTimerMutationOutcome.Failed -> TimerMutationOutcome.Failed
        }

    private fun authenticatedHeaders(session: WearSessionEnvelope.Active): Map<String, String> = mapOf(
        "Content-Type" to "application/json",
        "apikey" to session.supabase.anonKey,
        "Authorization" to "Bearer ${session.accessToken}",
    )
}

private val MILLISECOND_INSTANT = DateTimeFormatterBuilder().appendInstant(3).toFormatter()

internal fun parseServerInstant(value: String): Instant? =
    runCatching { OffsetDateTime.parse(value).toInstant() }.getOrNull()

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
