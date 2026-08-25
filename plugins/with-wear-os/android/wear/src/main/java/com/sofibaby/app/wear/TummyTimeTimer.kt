package com.sofibaby.app.wear

import java.time.Instant
import org.json.JSONObject

data class TummyTimeTimerDraft(
    val timerInstanceId: String,
    val activityId: String,
    val startedAt: String,
    val rpcBody: String,
)

data class CompletedTummyTimeDraft(
    val recordId: String,
    val mergeBody: String,
)

data class TummyTimeTimerData(
    val timerInstanceId: String,
    val activityId: String,
    val isPaused: Boolean = false,
    val totalPausedMs: Long = 0,
    val pausedAt: Instant? = null,
    val accumulatedSeconds: Int? = null,
)

data class RestoredTummyTimeTimer(
    val timerInstanceId: String?,
    val activityId: String?,
    val startedAt: Instant,
    val isPaused: Boolean,
    val accumulatedSeconds: Int?,
    val totalPausedMs: Long,
    val pausedAt: Instant?,
    val canControl: Boolean,
    val elapsedSeconds: Long,
)

object TummyTimeTimerRestorer {
    fun restore(
        snapshot: ActivitySnapshot.ActiveTimer,
        now: Instant = Instant.now(),
    ): RestoredTummyTimeTimer? {
        if (snapshot.type != "tummyTime") return null
        val startedAt = parseServerInstant(snapshot.startTime) ?: return null
        val paused = snapshot.isPaused == true
        return RestoredTummyTimeTimer(
            timerInstanceId = snapshot.timerInstanceId,
            activityId = null,
            startedAt = startedAt,
            isPaused = paused,
            accumulatedSeconds = snapshot.accumulatedSeconds,
            totalPausedMs = 0,
            pausedAt = null,
            canControl = snapshot.isRemote != true,
            elapsedSeconds = if (paused && snapshot.accumulatedSeconds != null) {
                snapshot.accumulatedSeconds.toLong()
            } else {
                java.time.Duration.between(startedAt, now).seconds.coerceAtLeast(0)
            },
        )
    }
}

val TUMMY_TIME_TIMER_START_CODEC = TimerDataCodec<TummyTimeTimerData>(
    encode = { data ->
        JSONObject()
            .put("timerInstanceId", data.timerInstanceId)
            .put("activityId", data.activityId)
    },
    decode = { _, data ->
        TummyTimeTimerData(
            timerInstanceId = data.getString("timerInstanceId"),
            activityId = data.getString("activityId"),
        )
    },
)

val TUMMY_TIME_TIMER_CODEC = TimerDataCodec<TummyTimeTimerData>(
    encode = { data ->
        JSONObject()
            .put("timerInstanceId", data.timerInstanceId)
            .put("activityId", data.activityId)
            .put("isPaused", data.isPaused)
            .put("totalPausedMs", data.totalPausedMs)
            .apply {
                data.pausedAt?.let { put("pausedAt", it.toString()) }
                data.accumulatedSeconds?.let { put("accumulatedSeconds", it) }
            }
    },
    decode = { _, data ->
        TummyTimeTimerData(
            timerInstanceId = data.getString("timerInstanceId"),
            activityId = data.getString("activityId"),
            isPaused = data.optBoolean("isPaused", false),
            totalPausedMs = data.optLong("totalPausedMs", 0),
            pausedAt = data.optString("pausedAt").takeIf(String::isNotBlank)?.let(Instant::parse),
            accumulatedSeconds = data.optInt("accumulatedSeconds")
                .takeIf { data.has("accumulatedSeconds") && !data.isNull("accumulatedSeconds") },
        )
    },
)

sealed interface TummyTimeTimerWriteOutcome {
    data class Success(val persistedStartedAt: String) : TummyTimeTimerWriteOutcome
    data class AlreadyActive(
        val lockHolderId: String?,
        val lockHolderName: String?,
        val startedAt: String?,
    ) : TummyTimeTimerWriteOutcome
    data object Unauthorized : TummyTimeTimerWriteOutcome
    data object Offline : TummyTimeTimerWriteOutcome
    data object Failed : TummyTimeTimerWriteOutcome
}

sealed interface TummyTimeTimerMutationOutcome {
    data class Success(val timer: RestoredTummyTimeTimer) : TummyTimeTimerMutationOutcome
    data object Unauthorized : TummyTimeTimerMutationOutcome
    data object Offline : TummyTimeTimerMutationOutcome
    data object Failed : TummyTimeTimerMutationOutcome
}

sealed interface TummyTimeTimerReadOutcome {
    data class Success(val timer: RestoredTummyTimeTimer) : TummyTimeTimerReadOutcome
    data object Missing : TummyTimeTimerReadOutcome
    data object Unauthorized : TummyTimeTimerReadOutcome
    data object Offline : TummyTimeTimerReadOutcome
    data object Failed : TummyTimeTimerReadOutcome
}

sealed interface TummyTimeTimerUiState {
    data object Idle : TummyTimeTimerUiState
    data object Submitting : TummyTimeTimerUiState
    data class Hydrating(val timer: RestoredTummyTimeTimer) : TummyTimeTimerUiState
    data class SnapshotActive(val timer: RestoredTummyTimeTimer) : TummyTimeTimerUiState
    data class AlreadyActive(val caregiverName: String?, val startedAt: String?) : TummyTimeTimerUiState
    data class Error(val message: String, val canRetry: Boolean = true) : TummyTimeTimerUiState
}

fun interface TummyTimeTimerDraftFactory {
    fun create(session: WearSessionEnvelope.Active): TummyTimeTimerDraft
}

fun interface TummyTimeTimerStarter {
    fun start(
        session: WearSessionEnvelope.Active,
        draft: TummyTimeTimerDraft,
    ): TummyTimeTimerWriteOutcome
}

fun interface TummyTimeTimerReader {
    fun read(session: WearSessionEnvelope.Active): TummyTimeTimerReadOutcome
}

fun interface CompletedTummyTimeDraftFactory {
    fun create(
        session: WearSessionEnvelope.Active,
        timer: RestoredTummyTimeTimer,
    ): CompletedTummyTimeDraft
}

fun interface CompletedTummyTimeWriter {
    fun write(
        session: WearSessionEnvelope.Active,
        draft: CompletedTummyTimeDraft,
    ): WriteOutcome
}

fun interface TummyTimeTimerMutator {
    fun mutate(
        session: WearSessionEnvelope.Active,
        timer: RestoredTummyTimeTimer,
    ): TummyTimeTimerMutationOutcome
}

class TummyTimeTimerCoordinator(
    private val drafts: TummyTimeTimerDraftFactory,
    private val starter: TummyTimeTimerStarter,
    private val refreshSummary: () -> Unit,
    private val completionDrafts: CompletedTummyTimeDraftFactory = CompletedTummyTimeDraftFactory { _, _ ->
        error("Completion is not configured")
    },
    private val completionWriter: CompletedTummyTimeWriter = CompletedTummyTimeWriter { _, _ -> WriteOutcome.Failed },
    private val pauser: TummyTimeTimerMutator = TummyTimeTimerMutator { _, _ ->
        TummyTimeTimerMutationOutcome.Failed
    },
    private val resumer: TummyTimeTimerMutator = TummyTimeTimerMutator { _, _ ->
        TummyTimeTimerMutationOutcome.Failed
    },
    private val timerReader: TummyTimeTimerReader = TummyTimeTimerReader { TummyTimeTimerReadOutcome.Missing },
    private val dispatch: ((() -> Unit) -> Unit) = { it() },
    private val onUnauthorized: (Long) -> Unit = {},
    private val onStateChanged: (TummyTimeTimerUiState) -> Unit = {},
) {
    var state: TummyTimeTimerUiState = TummyTimeTimerUiState.Idle
        private set(value) {
            field = value
            onStateChanged(value)
        }
    private var pendingRetry: ((WearSessionEnvelope.Active) -> Unit)? = null
    private var generation = 0L

    @Synchronized
    fun restoreSnapshot(timer: ActivitySnapshot.ActiveTimer?, now: Instant = Instant.now()) {
        if (state == TummyTimeTimerUiState.Submitting) return
        if (state is TummyTimeTimerUiState.Error && pendingRetry != null) return
        state = timer?.let { TummyTimeTimerRestorer.restore(it, now) }
            ?.let(TummyTimeTimerUiState::SnapshotActive)
            ?: TummyTimeTimerUiState.Idle
    }

    fun restoreSnapshot(
        session: WearSessionEnvelope.Active,
        timer: ActivitySnapshot.ActiveTimer?,
        now: Instant = Instant.now(),
    ) {
        restoreSnapshot(timer, now)
        val (publicTimer, requestGeneration) = synchronized(this) {
            val currentTimer = (state as? TummyTimeTimerUiState.SnapshotActive)?.timer ?: return
            if (!currentTimer.canControl) return
            state = TummyTimeTimerUiState.Hydrating(currentTimer)
            currentTimer to generation
        }
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            applyHydrationOutcome(session, publicTimer, timerReader.read(session), requestGeneration)
        }
    }

    private fun applyHydrationOutcome(
        session: WearSessionEnvelope.Active,
        publicTimer: RestoredTummyTimeTimer,
        outcome: TummyTimeTimerReadOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is TummyTimeTimerReadOutcome.Success -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.SnapshotActive(
                    outcome.timer.copy(
                        canControl = true,
                        elapsedSeconds = publicTimer.elapsedSeconds,
                    ),
                )
            }
            TummyTimeTimerReadOutcome.Missing -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.SnapshotActive(publicTimer)
            }
            TummyTimeTimerReadOutcome.Offline, TummyTimeTimerReadOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyHydrationOutcome(
                        retrySession,
                        publicTimer,
                        timerReader.read(retrySession),
                        expectedGeneration,
                    )
                }
                state = TummyTimeTimerUiState.Error(
                    if (outcome == TummyTimeTimerReadOutcome.Offline) {
                        "No network connection"
                    } else {
                        "Could not restore tummy time"
                    },
                )
            }
            TummyTimeTimerReadOutcome.Unauthorized -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
        }
    }

    @Synchronized
    fun restoreHydrated(timer: RestoredTummyTimeTimer) {
        if (state != TummyTimeTimerUiState.Submitting) {
            pendingRetry = null
            state = TummyTimeTimerUiState.SnapshotActive(timer)
        }
    }

    @Synchronized
    fun start(session: WearSessionEnvelope.Active) {
        if (state == TummyTimeTimerUiState.Submitting) return
        val requestGeneration = generation
        state = TummyTimeTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                drafts.create(session)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        state = TummyTimeTimerUiState.Error("Could not start tummy time", canRetry = false)
                    }
                }
                return@dispatch
            }
            if (!isCurrent(requestGeneration)) return@dispatch
            applyStartOutcome(session, draft, starter.start(session, draft), requestGeneration)
        }
    }

    private fun applyStartOutcome(
        session: WearSessionEnvelope.Active,
        draft: TummyTimeTimerDraft,
        outcome: TummyTimeTimerWriteOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is TummyTimeTimerWriteOutcome.Success -> {
                val startedAt = parseServerInstant(outcome.persistedStartedAt)
                pendingRetry = null
                if (startedAt == null) {
                    state = TummyTimeTimerUiState.Error("Could not start tummy time", canRetry = false)
                } else {
                    state = TummyTimeTimerUiState.SnapshotActive(
                        RestoredTummyTimeTimer(
                            timerInstanceId = draft.timerInstanceId,
                            activityId = draft.activityId,
                            startedAt = startedAt,
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
            is TummyTimeTimerWriteOutcome.AlreadyActive -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.AlreadyActive(outcome.lockHolderName, outcome.startedAt)
                refreshSummary()
            }
            TummyTimeTimerWriteOutcome.Unauthorized -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            TummyTimeTimerWriteOutcome.Offline, TummyTimeTimerWriteOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyStartOutcome(
                        retrySession,
                        draft,
                        starter.start(retrySession, draft),
                        expectedGeneration,
                    )
                }
                state = TummyTimeTimerUiState.Error(
                    if (outcome == TummyTimeTimerWriteOutcome.Offline) {
                        "No network connection"
                    } else {
                        "Could not start tummy time"
                    },
                )
            }
        }
    }

    @Synchronized
    fun stop(session: WearSessionEnvelope.Active) {
        if (state == TummyTimeTimerUiState.Submitting) return
        val timer = (state as? TummyTimeTimerUiState.SnapshotActive)?.timer ?: return
        if (!timer.canControl) return
        val requestGeneration = generation
        state = TummyTimeTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                completionDrafts.create(session, timer)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        pendingRetry = null
                        state = TummyTimeTimerUiState.Error("Could not stop tummy time", canRetry = false)
                    }
                }
                return@dispatch
            }
            if (!isCurrent(requestGeneration)) return@dispatch
            applyCompletionOutcome(session, draft, completionWriter.write(session, draft), requestGeneration)
        }
    }

    fun pause(session: WearSessionEnvelope.Active) = mutate(session, "Could not pause tummy time", pauser)

    fun resume(session: WearSessionEnvelope.Active) = mutate(session, "Could not resume tummy time", resumer)

    private fun mutate(
        session: WearSessionEnvelope.Active,
        failureMessage: String,
        mutator: TummyTimeTimerMutator,
    ) {
        val timer: RestoredTummyTimeTimer
        val requestGeneration: Long
        synchronized(this) {
            if (state == TummyTimeTimerUiState.Submitting) return
            timer = (state as? TummyTimeTimerUiState.SnapshotActive)?.timer ?: return
            if (!timer.canControl) return
            requestGeneration = generation
            state = TummyTimeTimerUiState.Submitting
        }
        dispatch {
            performMutation(session, timer, failureMessage, mutator, requestGeneration)
        }
    }

    private fun performMutation(
        session: WearSessionEnvelope.Active,
        timer: RestoredTummyTimeTimer,
        failureMessage: String,
        mutator: TummyTimeTimerMutator,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        val outcome = try {
            mutator.mutate(session, timer)
        } catch (_: Exception) {
            synchronized(this) {
                if (generation == expectedGeneration) {
                    pendingRetry = null
                    state = TummyTimeTimerUiState.Error(failureMessage, canRetry = false)
                }
            }
            return
        }
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is TummyTimeTimerMutationOutcome.Success -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.SnapshotActive(outcome.timer)
                refreshSummary()
            }
            TummyTimeTimerMutationOutcome.Unauthorized -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            TummyTimeTimerMutationOutcome.Offline, TummyTimeTimerMutationOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    performMutation(retrySession, timer, failureMessage, mutator, expectedGeneration)
                }
                state = TummyTimeTimerUiState.Error(
                    if (outcome == TummyTimeTimerMutationOutcome.Offline) "No network connection" else failureMessage,
                )
            }
        }
    }

    @Synchronized
    fun retry(session: WearSessionEnvelope.Active) {
        if (state == TummyTimeTimerUiState.Submitting) return
        val action = pendingRetry ?: return
        val requestGeneration = generation
        state = TummyTimeTimerUiState.Submitting
        dispatch { if (isCurrent(requestGeneration)) action(session) }
    }

    private fun applyCompletionOutcome(
        session: WearSessionEnvelope.Active,
        draft: CompletedTummyTimeDraft,
        outcome: WriteOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is WriteOutcome.Success -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.Idle
                refreshSummary()
            }
            WriteOutcome.Unauthorized -> {
                pendingRetry = null
                state = TummyTimeTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            WriteOutcome.Offline, WriteOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    val originSession = retrySession.copy(baby = session.baby)
                    applyCompletionOutcome(
                        originSession,
                        draft,
                        completionWriter.write(originSession, draft),
                        expectedGeneration,
                    )
                }
                state = TummyTimeTimerUiState.Error(
                    if (outcome == WriteOutcome.Offline) "No network connection" else "Could not stop tummy time",
                )
            }
        }
    }

    @Synchronized
    fun reset() {
        generation += 1
        pendingRetry = null
        state = TummyTimeTimerUiState.Idle
    }

    @Synchronized
    private fun isCurrent(expectedGeneration: Long): Boolean = generation == expectedGeneration
}
