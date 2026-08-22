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

    @Synchronized
    fun issue(): String {
        val now = wallClockMillis()
        val previous = state
        var millis = maxOf(now, previous?.millis ?: Long.MIN_VALUE)
        var counter = if (previous != null && millis == previous.millis) previous.counter + 1 else 0
        if (counter > 9_999) {
            millis += counter / 10_000
            counter %= 10_000
        }
        state = WearClockState(millis, counter).also(store::save)
        return "${MILLISECOND_INSTANT.format(Instant.ofEpochMilli(millis))}-${counter.toString().padStart(4, '0')}-${store.deviceId}"
    }
}

sealed interface WriteOutcome {
    data class Success(val recordId: String) : WriteOutcome
    data object Unauthorized : WriteOutcome
    data object Offline : WriteOutcome
    data object Failed : WriteOutcome
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
        clockedFields.forEach { field -> clocks.put(field, hlc.issue()) }
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
    private val onStateChanged: (DiaperQuickLogState) -> Unit = {},
) {
    var state: DiaperQuickLogState = DiaperQuickLogState.Idle
        private set(value) {
            field = value
            onStateChanged(value)
        }
    private var pendingDraft: DiaperWriteDraft? = null

    @Synchronized
    fun submit(
        session: WearSessionEnvelope.Active,
        type: DiaperType,
        stoolColor: StoolColor?,
    ) {
        if (state == DiaperQuickLogState.Submitting) return
        val draft = drafts.create(session, type, stoolColor)
        pendingDraft = draft
        start(session, draft)
    }

    @Synchronized
    fun retry(session: WearSessionEnvelope.Active) {
        if (state == DiaperQuickLogState.Submitting) return
        val draft = pendingDraft ?: return
        start(session, draft)
    }

    @Synchronized
    fun reset() {
        pendingDraft = null
        state = DiaperQuickLogState.Idle
    }

    private fun start(session: WearSessionEnvelope.Active, draft: DiaperWriteDraft) {
        state = DiaperQuickLogState.Submitting
        dispatch {
            val outcome = writer.write(session, draft)
            synchronized(this) {
                state = when (outcome) {
                    is WriteOutcome.Success -> {
                        pendingDraft = null
                        refreshSummary()
                        DiaperQuickLogState.Success
                    }
                    WriteOutcome.Offline -> DiaperQuickLogState.Error("No network connection")
                    WriteOutcome.Unauthorized -> DiaperQuickLogState.Error("Session expired")
                    WriteOutcome.Failed -> DiaperQuickLogState.Error("Could not log diaper")
                }
            }
        }
    }
}
