package com.sofibaby.app.wear

import java.time.Duration
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import org.json.JSONObject

enum class SleepType(val wireValue: String) {
    Nap("nap"),
    Night("night"),
}

object SleepTypeClassifier {
    private const val DAY_START_HOUR = 6
    private const val DAY_END_HOUR = 19
    private const val RECLASSIFY_THRESHOLD_SECONDS = 30 * 60L

    fun at(instant: Instant, timezone: String): SleepType {
        val hour = instant.atZone(ZoneId.of(timezone)).hour
        return if (hour in DAY_START_HOUR until DAY_END_HOUR) SleepType.Nap else SleepType.Night
    }

    fun classify(startedAt: Instant, endedAt: Instant, timezone: String): SleepType {
        if (!endedAt.isAfter(startedAt)) return at(startedAt, timezone)
        val zone = ZoneId.of(timezone)
        val startType = at(startedAt, timezone)
        var cursor = startedAt
        var napSeconds = 0L
        var nightSeconds = 0L
        while (cursor.isBefore(endedAt)) {
            val local = cursor.atZone(zone)
            val type = at(cursor, timezone)
            val boundaryHour = if (type == SleepType.Nap) DAY_END_HOUR else DAY_START_HOUR
            var boundaryDate = local.toLocalDate()
            if (type == SleepType.Night && local.hour >= DAY_END_HOUR) {
                boundaryDate = boundaryDate.plusDays(1)
            }
            var boundary = boundaryDate.atTime(LocalTime.of(boundaryHour, 0)).atZone(zone).toInstant()
            if (!boundary.isAfter(cursor)) boundary = boundaryDate.plusDays(1)
                .atTime(LocalTime.of(boundaryHour, 0)).atZone(zone).toInstant()
            val segmentEnd = if (boundary.isBefore(endedAt)) boundary else endedAt
            val seconds = Duration.between(cursor, segmentEnd).seconds.coerceAtLeast(0)
            if (type == SleepType.Nap) napSeconds += seconds else nightSeconds += seconds
            cursor = segmentEnd
        }
        val otherType = if (startType == SleepType.Nap) SleepType.Night else SleepType.Nap
        val startSeconds = if (startType == SleepType.Nap) napSeconds else nightSeconds
        val otherSeconds = if (otherType == SleepType.Nap) napSeconds else nightSeconds
        return if (otherSeconds > RECLASSIFY_THRESHOLD_SECONDS && otherSeconds > startSeconds) {
            otherType
        } else {
            startType
        }
    }
}

data class SleepTimerDraft(
    val timerInstanceId: String,
    val activityId: String,
    val startedAt: String,
    val type: SleepType,
    val rpcBody: String,
)

data class CompletedSleepDraft(
    val recordId: String,
    val mergeBody: String?,
)

data class SleepTimerData(
    val timerInstanceId: String,
    val activityId: String,
    val type: SleepType,
    val isPaused: Boolean = false,
    val totalPausedMs: Long = 0,
    val pausedAt: Instant? = null,
    val accumulatedSeconds: Int? = null,
)

val SLEEP_TIMER_START_CODEC = TimerDataCodec<SleepTimerData>(
    encode = { data ->
        JSONObject()
            .put("timerInstanceId", data.timerInstanceId)
            .put("activityId", data.activityId)
            .put("type", data.type.wireValue)
            .put("morningClassification", "automatic")
            .put("morningClassificationVersion", 1)
    },
    decode = { _, data ->
        SleepTimerData(
            timerInstanceId = data.getString("timerInstanceId"),
            activityId = data.getString("activityId"),
            type = if (data.optString("type") == SleepType.Night.wireValue) SleepType.Night else SleepType.Nap,
            isPaused = data.optBoolean("isPaused", false),
            totalPausedMs = data.optLong("totalPausedMs", 0),
            pausedAt = data.optString("pausedAt").takeIf(String::isNotBlank)?.let(Instant::parse),
            accumulatedSeconds = data.optInt("accumulatedSeconds")
                .takeIf { data.has("accumulatedSeconds") && !data.isNull("accumulatedSeconds") },
        )
    },
)

val SLEEP_TIMER_CODEC = TimerDataCodec<SleepTimerData>(
    encode = { data ->
        JSONObject()
            .put("timerInstanceId", data.timerInstanceId)
            .put("activityId", data.activityId)
            .put("type", data.type.wireValue)
            .put("isPaused", data.isPaused)
            .put("totalPausedMs", data.totalPausedMs)
            .put("morningClassification", "automatic")
            .put("morningClassificationVersion", 1)
            .apply {
                data.pausedAt?.let { put("pausedAt", it.toString()) }
                data.accumulatedSeconds?.let { put("accumulatedSeconds", it) }
            }
    },
    decode = SLEEP_TIMER_START_CODEC.decode,
)

data class RestoredSleepTimer(
    val timerInstanceId: String?,
    val activityId: String?,
    val startedAt: Instant,
    val type: SleepType,
    val isPaused: Boolean,
    val accumulatedSeconds: Int?,
    val totalPausedMs: Long,
    val pausedAt: Instant?,
    val canControl: Boolean,
    val elapsedSeconds: Long,
)

object SleepTimerRestorer {
    fun restore(
        snapshot: ActivitySnapshot.ActiveTimer,
        now: Instant = Instant.now(),
    ): RestoredSleepTimer? {
        if (snapshot.type != "sleep") return null
        val startedAt = parseServerInstant(snapshot.startTime) ?: return null
        val paused = snapshot.isPaused == true
        return RestoredSleepTimer(
            timerInstanceId = snapshot.timerInstanceId,
            activityId = null,
            startedAt = startedAt,
            type = if (snapshot.context == SleepType.Night.wireValue) SleepType.Night else SleepType.Nap,
            isPaused = paused,
            accumulatedSeconds = snapshot.accumulatedSeconds,
            totalPausedMs = 0,
            pausedAt = null,
            canControl = snapshot.isRemote != true,
            elapsedSeconds = if (paused && snapshot.accumulatedSeconds != null) {
                snapshot.accumulatedSeconds.toLong()
            } else {
                Duration.between(startedAt, now).seconds.coerceAtLeast(0)
            },
        )
    }
}

sealed interface SleepTimerUiState {
    data object Idle : SleepTimerUiState
    data object Submitting : SleepTimerUiState
    data class Hydrating(val timer: RestoredSleepTimer) : SleepTimerUiState
    data class SnapshotActive(val timer: RestoredSleepTimer) : SleepTimerUiState
    data class AlreadyActive(val caregiverName: String?, val startedAt: String?) : SleepTimerUiState
    data class Error(val message: String, val canRetry: Boolean = true) : SleepTimerUiState
}

fun interface SleepTimerDraftFactory {
    fun create(session: WearSessionEnvelope.Active): SleepTimerDraft
}

fun interface SleepTimerStarter {
    fun start(session: WearSessionEnvelope.Active, draft: SleepTimerDraft): SleepTimerWriteOutcome
}

fun interface CompletedSleepDraftFactory {
    fun create(session: WearSessionEnvelope.Active, timer: RestoredSleepTimer): CompletedSleepDraft
}

fun interface CompletedSleepWriter {
    fun write(session: WearSessionEnvelope.Active, draft: CompletedSleepDraft): WriteOutcome
}

fun interface SleepTimerMutator {
    fun mutate(session: WearSessionEnvelope.Active, timer: RestoredSleepTimer): SleepTimerMutationOutcome
}

fun interface SleepTimerReader {
    fun read(session: WearSessionEnvelope.Active): SleepTimerReadOutcome
}

sealed interface SleepTimerWriteOutcome {
    data class Success(val persistedStartedAt: String) : SleepTimerWriteOutcome
    data class AlreadyActive(
        val lockHolderId: String?,
        val lockHolderName: String?,
        val startedAt: String?,
    ) : SleepTimerWriteOutcome
    data object Unauthorized : SleepTimerWriteOutcome
    data object Offline : SleepTimerWriteOutcome
    data object Failed : SleepTimerWriteOutcome
}

sealed interface SleepTimerMutationOutcome {
    data class Success(val timer: RestoredSleepTimer) : SleepTimerMutationOutcome
    data object Unauthorized : SleepTimerMutationOutcome
    data object Offline : SleepTimerMutationOutcome
    data object Failed : SleepTimerMutationOutcome
}

sealed interface SleepTimerReadOutcome {
    data class Success(val timer: RestoredSleepTimer) : SleepTimerReadOutcome
    data object Missing : SleepTimerReadOutcome
    data object Unauthorized : SleepTimerReadOutcome
    data object Offline : SleepTimerReadOutcome
    data object Failed : SleepTimerReadOutcome
}

class SleepTimerCoordinator(
    private val drafts: SleepTimerDraftFactory,
    private val starter: SleepTimerStarter,
    private val refreshSummary: () -> Unit,
    private val completionDrafts: CompletedSleepDraftFactory = CompletedSleepDraftFactory { _, _ ->
        error("Completion is not configured")
    },
    private val completionWriter: CompletedSleepWriter = CompletedSleepWriter { _, _ -> WriteOutcome.Failed },
    private val pauser: SleepTimerMutator = SleepTimerMutator { _, _ -> SleepTimerMutationOutcome.Failed },
    private val resumer: SleepTimerMutator = SleepTimerMutator { _, _ -> SleepTimerMutationOutcome.Failed },
    private val timerReader: SleepTimerReader = SleepTimerReader { SleepTimerReadOutcome.Missing },
    private val dispatch: ((() -> Unit) -> Unit) = { it() },
    private val onUnauthorized: (Long) -> Unit = {},
    private val onStateChanged: (SleepTimerUiState) -> Unit = {},
) {
    var state: SleepTimerUiState = SleepTimerUiState.Idle
        private set(value) {
            field = value
            onStateChanged(value)
        }
    private var pendingRetry: ((WearSessionEnvelope.Active) -> Unit)? = null
    private var generation = 0L

    @Synchronized
    fun restoreSnapshot(timer: ActivitySnapshot.ActiveTimer?, now: Instant = Instant.now()) {
        if (state is SleepTimerUiState.Error && pendingRetry != null) return
        state = timer?.let { SleepTimerRestorer.restore(it, now) }
            ?.let(SleepTimerUiState::SnapshotActive)
            ?: SleepTimerUiState.Idle
    }

    fun restoreSnapshot(
        session: WearSessionEnvelope.Active,
        timer: ActivitySnapshot.ActiveTimer?,
        now: Instant = Instant.now(),
    ) {
        restoreSnapshot(timer, now)
        val publicTimer = (state as? SleepTimerUiState.SnapshotActive)?.timer ?: return
        if (!publicTimer.canControl) return
        val requestGeneration = synchronized(this) { generation }
        state = SleepTimerUiState.Hydrating(publicTimer)
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            applyHydrationOutcome(session, publicTimer, timerReader.read(session), requestGeneration)
        }
    }

    @Synchronized
    fun restoreHydrated(timer: RestoredSleepTimer) {
        if (state != SleepTimerUiState.Submitting) state = SleepTimerUiState.SnapshotActive(timer)
    }

    @Synchronized
    fun start(session: WearSessionEnvelope.Active) {
        if (state == SleepTimerUiState.Submitting) return
        val requestGeneration = generation
        state = SleepTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                drafts.create(session)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        state = SleepTimerUiState.Error("Could not start sleep")
                    }
                }
                return@dispatch
            }
            if (!isCurrent(requestGeneration)) return@dispatch
            applyStartOutcome(session, draft, starter.start(session, draft), requestGeneration)
        }
    }

    @Synchronized
    fun stop(session: WearSessionEnvelope.Active) {
        if (state == SleepTimerUiState.Submitting) return
        val timer = (state as? SleepTimerUiState.SnapshotActive)?.timer ?: return
        if (!timer.canControl) return
        val requestGeneration = generation
        state = SleepTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                completionDrafts.create(session, timer)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        pendingRetry = null
                        state = SleepTimerUiState.Error("Could not stop sleep", canRetry = false)
                    }
                }
                return@dispatch
            }
            if (!isCurrent(requestGeneration)) return@dispatch
            applyCompletionOutcome(
                session,
                draft,
                completionWriter.write(session, draft),
                requestGeneration,
            )
        }
    }

    @Synchronized
    fun retry(session: WearSessionEnvelope.Active) {
        if (state == SleepTimerUiState.Submitting) return
        val action = pendingRetry ?: return
        val requestGeneration = generation
        state = SleepTimerUiState.Submitting
        dispatch {
            if (isCurrent(requestGeneration)) action(session)
        }
    }

    fun pause(session: WearSessionEnvelope.Active) = mutate(session, "Could not pause sleep", pauser)

    fun resume(session: WearSessionEnvelope.Active) = mutate(session, "Could not resume sleep", resumer)

    @Synchronized
    fun reset() {
        generation += 1
        pendingRetry = null
        state = SleepTimerUiState.Idle
    }

    @Synchronized
    private fun isCurrent(expectedGeneration: Long): Boolean = generation == expectedGeneration

    private fun applyStartOutcome(
        session: WearSessionEnvelope.Active,
        draft: SleepTimerDraft,
        outcome: SleepTimerWriteOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is SleepTimerWriteOutcome.Success -> {
                val startedAt = parseServerInstant(outcome.persistedStartedAt)
                if (startedAt == null) {
                    pendingRetry = null
                    state = SleepTimerUiState.Error("Could not start sleep", canRetry = false)
                } else {
                    pendingRetry = null
                    state = SleepTimerUiState.SnapshotActive(
                        RestoredSleepTimer(
                            timerInstanceId = draft.timerInstanceId,
                            activityId = draft.activityId,
                            startedAt = startedAt,
                            type = draft.type,
                            isPaused = false,
                            accumulatedSeconds = null,
                            totalPausedMs = 0,
                            pausedAt = null,
                            canControl = true,
                            elapsedSeconds = 0,
                        ),
                    )
                    refreshSummary()
                }
            }
            is SleepTimerWriteOutcome.AlreadyActive -> {
                pendingRetry = null
                state = SleepTimerUiState.AlreadyActive(outcome.lockHolderName, outcome.startedAt)
                refreshSummary()
            }
            SleepTimerWriteOutcome.Offline -> {
                pendingRetry = { retrySession ->
                    applyStartOutcome(
                        retrySession,
                        draft,
                        starter.start(retrySession, draft),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error("No network connection")
            }
            SleepTimerWriteOutcome.Unauthorized -> {
                pendingRetry = null
                state = SleepTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            SleepTimerWriteOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyStartOutcome(
                        retrySession,
                        draft,
                        starter.start(retrySession, draft),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error("Could not start sleep")
            }
        }
    }

    private fun applyCompletionOutcome(
        session: WearSessionEnvelope.Active,
        draft: CompletedSleepDraft,
        outcome: WriteOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is WriteOutcome.Success -> {
                pendingRetry = null
                state = SleepTimerUiState.Idle
                refreshSummary()
            }
            WriteOutcome.Offline -> {
                pendingRetry = { retrySession ->
                    applyCompletionOutcome(
                        retrySession,
                        draft,
                        completionWriter.write(retrySession, draft),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error("No network connection")
            }
            WriteOutcome.Unauthorized -> {
                pendingRetry = null
                state = SleepTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            WriteOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyCompletionOutcome(
                        retrySession,
                        draft,
                        completionWriter.write(retrySession, draft),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error("Could not stop sleep")
            }
        }
    }

    private fun mutate(
        session: WearSessionEnvelope.Active,
        failureMessage: String,
        mutator: SleepTimerMutator,
    ) {
        val timer: RestoredSleepTimer
        val requestGeneration: Long
        synchronized(this) {
            if (state == SleepTimerUiState.Submitting) return
            timer = (state as? SleepTimerUiState.SnapshotActive)?.timer ?: return
            if (!timer.canControl) return
            requestGeneration = generation
            state = SleepTimerUiState.Submitting
        }
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            applyMutationOutcome(
                session,
                timer,
                failureMessage,
                mutator,
                mutator.mutate(session, timer),
                requestGeneration,
            )
        }
    }

    private fun applyMutationOutcome(
        session: WearSessionEnvelope.Active,
        timer: RestoredSleepTimer,
        failureMessage: String,
        mutator: SleepTimerMutator,
        outcome: SleepTimerMutationOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is SleepTimerMutationOutcome.Success -> {
                pendingRetry = null
                state = SleepTimerUiState.SnapshotActive(outcome.timer)
                refreshSummary()
            }
            SleepTimerMutationOutcome.Offline -> {
                pendingRetry = { retrySession ->
                    applyMutationOutcome(
                        retrySession,
                        timer,
                        failureMessage,
                        mutator,
                        mutator.mutate(retrySession, timer),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error("No network connection")
            }
            SleepTimerMutationOutcome.Unauthorized -> {
                pendingRetry = null
                state = SleepTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            SleepTimerMutationOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyMutationOutcome(
                        retrySession,
                        timer,
                        failureMessage,
                        mutator,
                        mutator.mutate(retrySession, timer),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error(failureMessage)
            }
        }
    }

    private fun applyHydrationOutcome(
        session: WearSessionEnvelope.Active,
        publicTimer: RestoredSleepTimer,
        outcome: SleepTimerReadOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is SleepTimerReadOutcome.Success -> {
                pendingRetry = null
                state = SleepTimerUiState.SnapshotActive(
                    outcome.timer.copy(
                        canControl = true,
                        elapsedSeconds = publicTimer.elapsedSeconds,
                    ),
                )
            }
            SleepTimerReadOutcome.Missing -> state = SleepTimerUiState.SnapshotActive(publicTimer)
            SleepTimerReadOutcome.Offline -> {
                pendingRetry = { retrySession ->
                    applyHydrationOutcome(
                        retrySession,
                        publicTimer,
                        timerReader.read(retrySession),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error("No network connection")
            }
            SleepTimerReadOutcome.Unauthorized -> {
                pendingRetry = null
                state = SleepTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            SleepTimerReadOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyHydrationOutcome(
                        retrySession,
                        publicTimer,
                        timerReader.read(retrySession),
                        expectedGeneration,
                    )
                }
                state = SleepTimerUiState.Error("Could not restore sleep")
            }
        }
    }
}
