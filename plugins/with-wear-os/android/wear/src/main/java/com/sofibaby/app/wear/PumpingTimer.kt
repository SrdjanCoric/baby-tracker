package com.sofibaby.app.wear

import java.time.Duration
import java.time.Instant
import org.json.JSONObject

data class PumpingVolumeSelection(val volumeMl: Int = 0) {
    init {
        require(volumeMl in 0..500) { "Pumping volume must be between 0 and 500 ml" }
    }

    fun plusTen(): PumpingVolumeSelection = copy(volumeMl = (volumeMl + 10).coerceAtMost(500))
    fun minusTen(): PumpingVolumeSelection = copy(volumeMl = (volumeMl - 10).coerceAtLeast(0))
}

data class PumpingVolumeRotaryOutcome(
    val selection: PumpingVolumeSelection,
    val consumed: Boolean,
)

object PumpingVolumeRotary {
    fun adjust(selection: PumpingVolumeSelection, verticalScrollPixels: Float): PumpingVolumeSelection = when {
        verticalScrollPixels > 0 -> selection.copy(volumeMl = (selection.volumeMl + 5).coerceAtMost(500))
        verticalScrollPixels < 0 -> selection.copy(volumeMl = (selection.volumeMl - 5).coerceAtLeast(0))
        else -> selection
    }

    fun handle(
        selection: PumpingVolumeSelection,
        verticalScrollPixels: Float,
        adjustmentModeActive: Boolean,
        enabled: Boolean,
    ): PumpingVolumeRotaryOutcome {
        if (!adjustmentModeActive || !enabled) return PumpingVolumeRotaryOutcome(selection, false)
        return PumpingVolumeRotaryOutcome(adjust(selection, verticalScrollPixels), true)
    }
}

data class PumpingTimerDraft(
    val timerInstanceId: String,
    val activityId: String,
    val startedAt: String,
    val side: BreastSide,
    val rpcBody: String,
)

data class CompletedPumpingDraft(
    val recordId: String,
    val mergeBody: String?,
)

data class PumpingTimerData(
    val timerInstanceId: String,
    val activityId: String,
    val side: BreastSide,
    val isPaused: Boolean = false,
    val totalPausedMs: Long = 0,
    val pausedAt: Instant? = null,
    val accumulatedSeconds: Int? = null,
)

private fun pumpingSide(value: String): BreastSide = when (value) {
    BreastSide.Left.wireValue -> BreastSide.Left
    BreastSide.Right.wireValue -> BreastSide.Right
    else -> BreastSide.Both
}

val PUMPING_TIMER_START_CODEC = TimerDataCodec<PumpingTimerData>(
    encode = { data ->
        JSONObject()
            .put("timerInstanceId", data.timerInstanceId)
            .put("activityId", data.activityId)
            .put("side", data.side.wireValue)
    },
    decode = { _, data ->
        PumpingTimerData(
            timerInstanceId = data.getString("timerInstanceId"),
            activityId = data.getString("activityId"),
            side = pumpingSide(data.optString("side")),
        )
    },
)

val PUMPING_TIMER_CODEC = TimerDataCodec<PumpingTimerData>(
    encode = { data ->
        JSONObject()
            .put("timerInstanceId", data.timerInstanceId)
            .put("activityId", data.activityId)
            .put("side", data.side.wireValue)
            .put("isPaused", data.isPaused)
            .put("totalPausedMs", data.totalPausedMs)
            .apply {
                data.pausedAt?.let { put("pausedAt", it.toString()) }
                data.accumulatedSeconds?.let { put("accumulatedSeconds", it) }
            }
    },
    decode = { _, data ->
        PumpingTimerData(
            timerInstanceId = data.getString("timerInstanceId"),
            activityId = data.getString("activityId"),
            side = pumpingSide(data.optString("side")),
            isPaused = data.optBoolean("isPaused", false),
            totalPausedMs = data.optLong("totalPausedMs", 0),
            pausedAt = data.optString("pausedAt").takeIf(String::isNotBlank)?.let(Instant::parse),
            accumulatedSeconds = data.optInt("accumulatedSeconds")
                .takeIf { data.has("accumulatedSeconds") && !data.isNull("accumulatedSeconds") },
        )
    },
)

data class RestoredPumpingTimer(
    val timerInstanceId: String?,
    val activityId: String?,
    val startedAt: Instant,
    val side: BreastSide,
    val isPaused: Boolean,
    val accumulatedSeconds: Int?,
    val totalPausedMs: Long,
    val pausedAt: Instant?,
    val canControl: Boolean,
    val elapsedSeconds: Long,
)

object PumpingTimerRestorer {
    fun restore(
        snapshot: ActivitySnapshot.ActiveTimer,
        now: Instant = Instant.now(),
    ): RestoredPumpingTimer? {
        if (snapshot.type != "pumping") return null
        val startedAt = parseServerInstant(snapshot.startTime) ?: return null
        val paused = snapshot.isPaused == true
        return RestoredPumpingTimer(
            timerInstanceId = snapshot.timerInstanceId,
            activityId = null,
            startedAt = startedAt,
            side = pumpingSide(snapshot.context.orEmpty()),
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

sealed interface PumpingTimerUiState {
    data object Idle : PumpingTimerUiState
    data object Submitting : PumpingTimerUiState
    data class Hydrating(val timer: RestoredPumpingTimer) : PumpingTimerUiState
    data class SnapshotActive(val timer: RestoredPumpingTimer) : PumpingTimerUiState
    data class AlreadyActive(val caregiverName: String?, val startedAt: String?) : PumpingTimerUiState
    data class Error(val message: String, val canRetry: Boolean = true) : PumpingTimerUiState
}

fun interface PumpingTimerDraftFactory {
    fun create(session: WearSessionEnvelope.Active, side: BreastSide): PumpingTimerDraft
}

fun interface PumpingTimerStarter {
    fun start(session: WearSessionEnvelope.Active, draft: PumpingTimerDraft): PumpingTimerWriteOutcome
}

fun interface CompletedPumpingDraftFactory {
    fun create(
        session: WearSessionEnvelope.Active,
        timer: RestoredPumpingTimer,
        selection: PumpingVolumeSelection,
    ): CompletedPumpingDraft
}

fun interface CompletedPumpingWriter {
    fun write(session: WearSessionEnvelope.Active, draft: CompletedPumpingDraft): WriteOutcome
}

fun interface PumpingTimerMutator {
    fun mutate(session: WearSessionEnvelope.Active, timer: RestoredPumpingTimer): PumpingTimerMutationOutcome
}

fun interface PumpingTimerReader {
    fun read(session: WearSessionEnvelope.Active): PumpingTimerReadOutcome
}

sealed interface PumpingTimerWriteOutcome {
    data class Success(val persistedStartedAt: String) : PumpingTimerWriteOutcome
    data class AlreadyActive(
        val lockHolderId: String?,
        val lockHolderName: String?,
        val startedAt: String?,
    ) : PumpingTimerWriteOutcome
    data object Unauthorized : PumpingTimerWriteOutcome
    data object Offline : PumpingTimerWriteOutcome
    data object Failed : PumpingTimerWriteOutcome
}

sealed interface PumpingTimerMutationOutcome {
    data class Success(val timer: RestoredPumpingTimer) : PumpingTimerMutationOutcome
    data object Unauthorized : PumpingTimerMutationOutcome
    data object Offline : PumpingTimerMutationOutcome
    data object Failed : PumpingTimerMutationOutcome
}

sealed interface PumpingTimerReadOutcome {
    data class Success(val timer: RestoredPumpingTimer) : PumpingTimerReadOutcome
    data object Missing : PumpingTimerReadOutcome
    data object Unauthorized : PumpingTimerReadOutcome
    data object Offline : PumpingTimerReadOutcome
    data object Failed : PumpingTimerReadOutcome
}

class PumpingTimerCoordinator(
    private val drafts: PumpingTimerDraftFactory,
    private val starter: PumpingTimerStarter,
    private val refreshSummary: () -> Unit,
    private val completionDrafts: CompletedPumpingDraftFactory = CompletedPumpingDraftFactory { _, _, _ ->
        error("Completion is not configured")
    },
    private val completionWriter: CompletedPumpingWriter = CompletedPumpingWriter { _, _ -> WriteOutcome.Failed },
    private val pauser: PumpingTimerMutator = PumpingTimerMutator { _, _ -> PumpingTimerMutationOutcome.Failed },
    private val resumer: PumpingTimerMutator = PumpingTimerMutator { _, _ -> PumpingTimerMutationOutcome.Failed },
    private val timerReader: PumpingTimerReader = PumpingTimerReader { PumpingTimerReadOutcome.Missing },
    private val dispatch: ((() -> Unit) -> Unit) = { it() },
    private val onUnauthorized: (Long) -> Unit = {},
    private val onStateChanged: (PumpingTimerUiState) -> Unit = {},
) {
    var state: PumpingTimerUiState = PumpingTimerUiState.Idle
        private set(value) {
            field = value
            onStateChanged(value)
        }
    private var pendingRetry: ((WearSessionEnvelope.Active) -> Unit)? = null
    private var generation = 0L

    @Synchronized
    fun restoreSnapshot(timer: ActivitySnapshot.ActiveTimer?, now: Instant = Instant.now()) {
        if (state == PumpingTimerUiState.Submitting) return
        if (state is PumpingTimerUiState.Error && pendingRetry != null) return
        state = timer?.let { PumpingTimerRestorer.restore(it, now) }
            ?.let(PumpingTimerUiState::SnapshotActive)
            ?: PumpingTimerUiState.Idle
    }

    fun restoreSnapshot(
        session: WearSessionEnvelope.Active,
        timer: ActivitySnapshot.ActiveTimer?,
        now: Instant = Instant.now(),
    ) {
        restoreSnapshot(timer, now)
        val (publicTimer, requestGeneration) = synchronized(this) {
            val currentTimer = (state as? PumpingTimerUiState.SnapshotActive)?.timer ?: return
            if (!currentTimer.canControl) return
            state = PumpingTimerUiState.Hydrating(currentTimer)
            currentTimer to generation
        }
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            applyHydrationOutcome(session, publicTimer, timerReader.read(session), requestGeneration)
        }
    }

    @Synchronized
    fun restoreHydrated(timer: RestoredPumpingTimer) {
        if (state != PumpingTimerUiState.Submitting) state = PumpingTimerUiState.SnapshotActive(timer)
    }

    @Synchronized
    fun start(session: WearSessionEnvelope.Active, side: BreastSide) {
        if (state == PumpingTimerUiState.Submitting) return
        val requestGeneration = generation
        state = PumpingTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                drafts.create(session, side)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        state = PumpingTimerUiState.Error("Could not start pumping")
                    }
                }
                return@dispatch
            }
            if (!isCurrent(requestGeneration)) return@dispatch
            applyStartOutcome(session, draft, starter.start(session, draft), requestGeneration)
        }
    }

    @Synchronized
    fun stop(session: WearSessionEnvelope.Active, selection: PumpingVolumeSelection) {
        if (state == PumpingTimerUiState.Submitting) return
        val timer = (state as? PumpingTimerUiState.SnapshotActive)?.timer ?: return
        if (!timer.canControl) return
        val requestGeneration = generation
        state = PumpingTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                completionDrafts.create(session, timer, selection)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        pendingRetry = null
                        state = PumpingTimerUiState.Error("Could not stop pumping", canRetry = false)
                    }
                }
                return@dispatch
            }
            if (!isCurrent(requestGeneration)) return@dispatch
            applyCompletionOutcome(session, draft, completionWriter.write(session, draft), requestGeneration)
        }
    }

    fun pause(session: WearSessionEnvelope.Active) = mutate(session, "Could not pause pumping", pauser)
    fun resume(session: WearSessionEnvelope.Active) = mutate(session, "Could not resume pumping", resumer)

    @Synchronized
    fun retry(session: WearSessionEnvelope.Active) {
        if (state == PumpingTimerUiState.Submitting) return
        val action = pendingRetry ?: return
        val requestGeneration = generation
        state = PumpingTimerUiState.Submitting
        dispatch { if (isCurrent(requestGeneration)) action(session) }
    }

    @Synchronized
    fun reset() {
        generation += 1
        pendingRetry = null
        state = PumpingTimerUiState.Idle
    }

    @Synchronized
    private fun isCurrent(expectedGeneration: Long): Boolean = generation == expectedGeneration

    private fun applyStartOutcome(
        session: WearSessionEnvelope.Active,
        draft: PumpingTimerDraft,
        outcome: PumpingTimerWriteOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is PumpingTimerWriteOutcome.Success -> {
                val startedAt = parseServerInstant(outcome.persistedStartedAt)
                pendingRetry = null
                if (startedAt == null) {
                    state = PumpingTimerUiState.Error("Could not start pumping", canRetry = false)
                } else {
                    state = PumpingTimerUiState.SnapshotActive(
                        RestoredPumpingTimer(
                            draft.timerInstanceId,
                            draft.activityId,
                            startedAt,
                            draft.side,
                            false,
                            null,
                            0,
                            null,
                            true,
                            0,
                        ),
                    )
                    refreshSummary()
                }
            }
            is PumpingTimerWriteOutcome.AlreadyActive -> {
                pendingRetry = null
                state = PumpingTimerUiState.AlreadyActive(outcome.lockHolderName, outcome.startedAt)
                refreshSummary()
            }
            PumpingTimerWriteOutcome.Unauthorized -> {
                pendingRetry = null
                state = PumpingTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            PumpingTimerWriteOutcome.Offline, PumpingTimerWriteOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyStartOutcome(
                        retrySession,
                        draft,
                        starter.start(retrySession, draft),
                        expectedGeneration,
                    )
                }
                state = PumpingTimerUiState.Error(
                    if (outcome == PumpingTimerWriteOutcome.Offline) "No network connection" else "Could not start pumping",
                )
            }
        }
    }

    private fun applyCompletionOutcome(
        session: WearSessionEnvelope.Active,
        draft: CompletedPumpingDraft,
        outcome: WriteOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is WriteOutcome.Success -> {
                pendingRetry = null
                state = PumpingTimerUiState.Idle
                refreshSummary()
            }
            WriteOutcome.Unauthorized -> {
                pendingRetry = null
                state = PumpingTimerUiState.Error("Session expired", canRetry = false)
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
                state = PumpingTimerUiState.Error(
                    if (outcome == WriteOutcome.Offline) "No network connection" else "Could not stop pumping",
                )
            }
        }
    }

    private fun mutate(
        session: WearSessionEnvelope.Active,
        failureMessage: String,
        mutator: PumpingTimerMutator,
    ) {
        val timer: RestoredPumpingTimer
        val requestGeneration: Long
        synchronized(this) {
            if (state == PumpingTimerUiState.Submitting) return
            timer = (state as? PumpingTimerUiState.SnapshotActive)?.timer ?: return
            if (!timer.canControl) return
            requestGeneration = generation
            state = PumpingTimerUiState.Submitting
        }
        dispatch {
            performMutation(session, timer, failureMessage, mutator, requestGeneration)
        }
    }

    private fun performMutation(
        session: WearSessionEnvelope.Active,
        timer: RestoredPumpingTimer,
        failureMessage: String,
        mutator: PumpingTimerMutator,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        val outcome = try {
            mutator.mutate(session, timer)
        } catch (_: Exception) {
            synchronized(this) {
                if (generation == expectedGeneration) {
                    pendingRetry = null
                    state = PumpingTimerUiState.Error(failureMessage, canRetry = false)
                }
            }
            return
        }
        applyMutationOutcome(session, timer, failureMessage, mutator, outcome, expectedGeneration)
    }

    private fun applyMutationOutcome(
        session: WearSessionEnvelope.Active,
        timer: RestoredPumpingTimer,
        failureMessage: String,
        mutator: PumpingTimerMutator,
        outcome: PumpingTimerMutationOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is PumpingTimerMutationOutcome.Success -> {
                pendingRetry = null
                state = PumpingTimerUiState.SnapshotActive(outcome.timer)
                refreshSummary()
            }
            PumpingTimerMutationOutcome.Unauthorized -> {
                pendingRetry = null
                state = PumpingTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
            PumpingTimerMutationOutcome.Offline, PumpingTimerMutationOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    performMutation(retrySession, timer, failureMessage, mutator, expectedGeneration)
                }
                state = PumpingTimerUiState.Error(
                    if (outcome == PumpingTimerMutationOutcome.Offline) "No network connection" else failureMessage,
                )
            }
        }
    }

    private fun applyHydrationOutcome(
        session: WearSessionEnvelope.Active,
        publicTimer: RestoredPumpingTimer,
        outcome: PumpingTimerReadOutcome,
        expectedGeneration: Long,
    ) {
        if (!isCurrent(expectedGeneration)) return
        when (outcome) {
            is PumpingTimerReadOutcome.Success -> {
                pendingRetry = null
                state = PumpingTimerUiState.SnapshotActive(
                    outcome.timer.copy(
                        canControl = true,
                        elapsedSeconds = publicTimer.elapsedSeconds,
                    ),
                )
            }
            PumpingTimerReadOutcome.Missing -> state = PumpingTimerUiState.SnapshotActive(publicTimer)
            PumpingTimerReadOutcome.Offline, PumpingTimerReadOutcome.Failed -> {
                pendingRetry = { retrySession ->
                    applyHydrationOutcome(
                        retrySession,
                        publicTimer,
                        timerReader.read(retrySession),
                        expectedGeneration,
                    )
                }
                state = PumpingTimerUiState.Error(
                    if (outcome == PumpingTimerReadOutcome.Offline) {
                        "No network connection"
                    } else {
                        "Could not restore pumping"
                    },
                )
            }
            PumpingTimerReadOutcome.Unauthorized -> {
                pendingRetry = null
                state = PumpingTimerUiState.Error("Session expired", canRetry = false)
                onUnauthorized(session.revision)
            }
        }
    }
}
