package com.sofibaby.app.wear

import java.time.Duration
import java.time.Instant

enum class BottleContentType(val wireValue: String) {
    Formula("formula"),
    BreastMilk("breastMilk"),
}

data class BottleLogSelection(
    val volumeMl: Int = 120,
    val contentType: BottleContentType = BottleContentType.Formula,
) {
    init {
        require(volumeMl in 0..500) { "Bottle volume must be between 0 and 500 ml" }
    }

    fun minusTen(): BottleLogSelection = copy(volumeMl = (volumeMl - 10).coerceAtLeast(0))
    fun plusTen(): BottleLogSelection = copy(volumeMl = (volumeMl + 10).coerceAtMost(500))
    fun crownSteps(steps: Int): BottleLogSelection = copy(volumeMl = (volumeMl + steps * 5).coerceIn(0, 500))
}

sealed interface BottleLogUiState {
    data object Idle : BottleLogUiState
    data object Submitting : BottleLogUiState
    data object Success : BottleLogUiState
    data class Error(val message: String, val canRetry: Boolean = true) : BottleLogUiState
}

fun interface BottleFeedingDraftFactory {
    fun create(session: WearSessionEnvelope.Active, selection: BottleLogSelection): BottleFeedingDraft
}

fun interface BottleFeedingWriter {
    fun write(session: WearSessionEnvelope.Active, draft: BottleFeedingDraft): WriteOutcome
}

class BottleLogCoordinator(
    private val drafts: BottleFeedingDraftFactory,
    private val writer: BottleFeedingWriter,
    private val refreshSummary: () -> Unit,
    private val dispatch: ((() -> Unit) -> Unit) = { it() },
    private val onUnauthorized: (Long) -> Unit = {},
    private val onStateChanged: (BottleLogUiState) -> Unit = {},
) {
    var state: BottleLogUiState = BottleLogUiState.Idle
        private set(value) {
            field = value
            onStateChanged(value)
    }
    private var pendingDraft: BottleFeedingDraft? = null
    private var generation = 0L

    @Synchronized
    fun submit(session: WearSessionEnvelope.Active, selection: BottleLogSelection) {
        if (state == BottleLogUiState.Submitting) return
        val requestGeneration = generation
        state = BottleLogUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                drafts.create(session, selection)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        state = BottleLogUiState.Error("Could not log bottle")
                    }
                }
                return@dispatch
            }
            synchronized(this) {
                if (generation != requestGeneration) return@dispatch
                pendingDraft = draft
            }
            applyOutcome(session, draft, writer.write(session, draft), requestGeneration)
        }
    }

    @Synchronized
    fun retry(session: WearSessionEnvelope.Active) {
        if (state == BottleLogUiState.Submitting) return
        val draft = pendingDraft ?: return
        val requestGeneration = generation
        state = BottleLogUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            applyOutcome(session, draft, writer.write(session, draft), requestGeneration)
        }
    }

    @Synchronized
    fun reset() {
        generation += 1
        pendingDraft = null
        state = BottleLogUiState.Idle
    }

    @Synchronized
    private fun isCurrent(expectedGeneration: Long): Boolean = generation == expectedGeneration

    private fun applyOutcome(
        session: WearSessionEnvelope.Active,
        draft: BottleFeedingDraft,
        outcome: WriteOutcome,
        expectedGeneration: Long,
    ) {
        var refresh = false
        var unauthorized: Long? = null
        synchronized(this) {
            if (generation != expectedGeneration) return
            state = when (outcome) {
                is WriteOutcome.Success -> {
                    pendingDraft = null
                    refresh = true
                    BottleLogUiState.Success
                }
                WriteOutcome.Offline -> BottleLogUiState.Error("No network connection")
                WriteOutcome.Unauthorized -> {
                    pendingDraft = null
                    unauthorized = session.revision
                    BottleLogUiState.Error("Session expired", canRetry = false)
                }
                WriteOutcome.Failed -> BottleLogUiState.Error("Could not log bottle")
            }
        }
        if (refresh && isCurrent(expectedGeneration)) refreshSummary()
        if (isCurrent(expectedGeneration)) unauthorized?.let(onUnauthorized)
    }
}

data class RestoredFeedingTimer(
    val timerInstanceId: String?,
    val activityId: String?,
    val startedAt: Instant,
    val side: BreastSide,
    val leftAccumulatedSeconds: Int,
    val rightAccumulatedSeconds: Int,
    val currentSideStartedAt: Instant,
    val isPaused: Boolean,
    val accumulatedSeconds: Int?,
    val totalPausedMs: Long,
    val pausedAt: Instant?,
    val canControl: Boolean,
    val elapsedSeconds: Long,
)

object FeedingTimerRestorer {
    fun restore(
        snapshot: ActivitySnapshot.ActiveTimer,
        now: Instant = Instant.now(),
    ): RestoredFeedingTimer? {
        if (snapshot.type != "feeding") return null
        val startedAt = runCatching { Instant.parse(snapshot.startTime) }.getOrNull() ?: return null
        val side = when (snapshot.context) {
            BreastSide.Right.wireValue -> BreastSide.Right
            else -> BreastSide.Left
        }
        val paused = snapshot.isPaused == true
        val elapsed = if (paused && snapshot.accumulatedSeconds != null) {
            snapshot.accumulatedSeconds.toLong()
        } else {
            Duration.between(startedAt, now).seconds.coerceAtLeast(0)
        }
        return RestoredFeedingTimer(
            timerInstanceId = snapshot.timerInstanceId,
            activityId = null,
            startedAt = startedAt,
            side = side,
            leftAccumulatedSeconds = 0,
            rightAccumulatedSeconds = 0,
            currentSideStartedAt = startedAt,
            isPaused = paused,
            accumulatedSeconds = snapshot.accumulatedSeconds,
            totalPausedMs = 0,
            pausedAt = null,
            canControl = snapshot.isRemote != true,
            elapsedSeconds = elapsed,
        )
    }
}

sealed interface FeedingTimerUiState {
    data object Idle : FeedingTimerUiState
    data object Submitting : FeedingTimerUiState
    data class Hydrating(val timer: RestoredFeedingTimer) : FeedingTimerUiState
    data class SnapshotActive(val timer: RestoredFeedingTimer) : FeedingTimerUiState
    data class AlreadyActive(val caregiverName: String?, val startedAt: String?) : FeedingTimerUiState
    data class Error(val message: String, val canRetry: Boolean = true) : FeedingTimerUiState
}

fun interface FeedingTimerDraftFactory {
    fun create(session: WearSessionEnvelope.Active, side: BreastSide): FeedingTimerDraft
}

fun interface FeedingTimerStarter {
    fun start(session: WearSessionEnvelope.Active, draft: FeedingTimerDraft): TimerWriteOutcome
}

fun interface CompletedFeedingDraftFactory {
    fun create(session: WearSessionEnvelope.Active, timer: RestoredFeedingTimer): CompletedFeedingDraft
}

fun interface CompletedFeedingWriter {
    fun write(session: WearSessionEnvelope.Active, draft: CompletedFeedingDraft): WriteOutcome
}

fun interface FeedingTimerMutator {
    fun mutate(session: WearSessionEnvelope.Active, timer: RestoredFeedingTimer): TimerMutationOutcome
}

fun interface FeedingTimerReader {
    fun read(session: WearSessionEnvelope.Active): TimerReadOutcome
}

class FeedingTimerCoordinator(
    private val drafts: FeedingTimerDraftFactory,
    private val starter: FeedingTimerStarter,
    private val refreshSummary: () -> Unit,
    private val completionDrafts: CompletedFeedingDraftFactory = CompletedFeedingDraftFactory { _, _ ->
        error("Completion is not configured")
    },
    private val completionWriter: CompletedFeedingWriter = CompletedFeedingWriter { _, _ -> WriteOutcome.Failed },
    private val pauser: FeedingTimerMutator = FeedingTimerMutator { _, _ -> TimerMutationOutcome.Failed },
    private val resumer: FeedingTimerMutator = FeedingTimerMutator { _, _ -> TimerMutationOutcome.Failed },
    private val sideSwitcher: FeedingTimerMutator = FeedingTimerMutator { _, _ -> TimerMutationOutcome.Failed },
    private val timerReader: FeedingTimerReader = FeedingTimerReader { TimerReadOutcome.Missing },
    private val dispatch: ((() -> Unit) -> Unit) = { it() },
    private val onUnauthorized: (Long) -> Unit = {},
    private val onStateChanged: (FeedingTimerUiState) -> Unit = {},
) {
    var state: FeedingTimerUiState = FeedingTimerUiState.Idle
        private set(value) {
            field = value
            onStateChanged(value)
    }
    private var pendingRetry: ((WearSessionEnvelope.Active) -> Unit)? = null
    private var generation = 0L

    @Synchronized
    fun restoreSnapshot(timer: ActivitySnapshot.ActiveTimer?, now: Instant = Instant.now()) {
        if (state == FeedingTimerUiState.Submitting || state is FeedingTimerUiState.Error) return
        state = timer?.let { FeedingTimerRestorer.restore(it, now) }
            ?.let(FeedingTimerUiState::SnapshotActive)
            ?: FeedingTimerUiState.Idle
    }

    fun restoreSnapshot(
        session: WearSessionEnvelope.Active,
        timer: ActivitySnapshot.ActiveTimer?,
        now: Instant = Instant.now(),
    ) {
        restoreSnapshot(timer, now)
        val publicTimer = (state as? FeedingTimerUiState.SnapshotActive)?.timer ?: return
        if (!publicTimer.canControl) return
        val requestGeneration = synchronized(this) {
            state = FeedingTimerUiState.Hydrating(publicTimer)
            generation
        }
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            applyHydrationOutcome(session, publicTimer, timerReader.read(session), requestGeneration)
        }
    }

    @Synchronized
    fun restoreHydrated(timer: RestoredFeedingTimer) {
        if (state != FeedingTimerUiState.Submitting) {
            state = FeedingTimerUiState.SnapshotActive(timer)
        }
    }

    @Synchronized
    fun start(session: WearSessionEnvelope.Active, side: BreastSide) {
        if (state == FeedingTimerUiState.Submitting) return
        val requestGeneration = generation
        state = FeedingTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                drafts.create(session, side)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        state = FeedingTimerUiState.Error("Could not start feeding")
                    }
                }
                return@dispatch
            }
            if (!isCurrent(requestGeneration)) return@dispatch
            applyStartOutcome(session, draft, starter.start(session, draft), requestGeneration)
        }
    }

    @Synchronized
    fun retry(session: WearSessionEnvelope.Active) {
        if (state == FeedingTimerUiState.Submitting) return
        val action = pendingRetry ?: return
        val requestGeneration = generation
        state = FeedingTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            action(session)
        }
    }

    @Synchronized
    fun stop(session: WearSessionEnvelope.Active) {
        if (state == FeedingTimerUiState.Submitting) return
        val timer = (state as? FeedingTimerUiState.SnapshotActive)?.timer ?: return
        if (!timer.canControl) return
        val requestGeneration = generation
        state = FeedingTimerUiState.Submitting
        dispatch {
            if (!isCurrent(requestGeneration)) return@dispatch
            val draft = try {
                completionDrafts.create(session, timer)
            } catch (_: Exception) {
                synchronized(this) {
                    if (generation == requestGeneration) {
                        state = FeedingTimerUiState.Error("Could not stop feeding")
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

    fun pause(session: WearSessionEnvelope.Active) = mutate(session, "Could not pause feeding", pauser)

    fun resume(session: WearSessionEnvelope.Active) = mutate(session, "Could not resume feeding", resumer)

    fun switchSide(session: WearSessionEnvelope.Active) = mutate(session, "Could not switch side", sideSwitcher)

    @Synchronized
    fun reset() {
        generation += 1
        pendingRetry = null
        state = FeedingTimerUiState.Idle
    }

    @Synchronized
    private fun isCurrent(expectedGeneration: Long): Boolean = generation == expectedGeneration

    private fun applyStartOutcome(
        session: WearSessionEnvelope.Active,
        draft: FeedingTimerDraft,
        outcome: TimerWriteOutcome,
        expectedGeneration: Long,
    ) {
        var shouldRefresh = false
        var unauthorizedRevision: Long? = null
        synchronized(this) {
            if (generation != expectedGeneration) return
            state = when (outcome) {
                is TimerWriteOutcome.Success -> {
                    pendingRetry = null
                    shouldRefresh = true
                    val startedAt = Instant.parse(outcome.persistedStartedAt)
                    FeedingTimerUiState.SnapshotActive(
                        RestoredFeedingTimer(
                            timerInstanceId = draft.timerInstanceId,
                            activityId = draft.activityId,
                            startedAt = startedAt,
                            side = draft.side,
                            leftAccumulatedSeconds = 0,
                            rightAccumulatedSeconds = 0,
                            currentSideStartedAt = startedAt,
                            isPaused = false,
                            accumulatedSeconds = null,
                            totalPausedMs = 0,
                            pausedAt = null,
                            canControl = true,
                            elapsedSeconds = 0,
                        ),
                    )
                }
                is TimerWriteOutcome.AlreadyActive -> {
                    pendingRetry = null
                    shouldRefresh = true
                    FeedingTimerUiState.AlreadyActive(outcome.lockHolderName, outcome.startedAt)
                }
                TimerWriteOutcome.Offline -> {
                    pendingRetry = { retrySession ->
                        applyStartOutcome(
                            retrySession,
                            draft,
                            starter.start(retrySession, draft),
                            expectedGeneration,
                        )
                    }
                    FeedingTimerUiState.Error("No network connection")
                }
                TimerWriteOutcome.Unauthorized -> {
                    pendingRetry = null
                    unauthorizedRevision = session.revision
                    FeedingTimerUiState.Error("Session expired", canRetry = false)
                }
                TimerWriteOutcome.Failed -> {
                    pendingRetry = { retrySession ->
                        applyStartOutcome(
                            retrySession,
                            draft,
                            starter.start(retrySession, draft),
                            expectedGeneration,
                        )
                    }
                    FeedingTimerUiState.Error("Could not start feeding")
                }
            }
        }
        if (shouldRefresh && isCurrent(expectedGeneration)) refreshSummary()
        if (isCurrent(expectedGeneration)) unauthorizedRevision?.let(onUnauthorized)
    }

    private fun applyCompletionOutcome(
        session: WearSessionEnvelope.Active,
        draft: CompletedFeedingDraft,
        outcome: WriteOutcome,
        expectedGeneration: Long,
    ) {
        var shouldRefresh = false
        var unauthorizedRevision: Long? = null
        synchronized(this) {
            if (generation != expectedGeneration) return
            state = when (outcome) {
                is WriteOutcome.Success -> {
                    pendingRetry = null
                    shouldRefresh = true
                    FeedingTimerUiState.Idle
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
                    FeedingTimerUiState.Error("No network connection")
                }
                WriteOutcome.Unauthorized -> {
                    pendingRetry = null
                    unauthorizedRevision = session.revision
                    FeedingTimerUiState.Error("Session expired", canRetry = false)
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
                    FeedingTimerUiState.Error("Could not stop feeding")
                }
            }
        }
        if (shouldRefresh && isCurrent(expectedGeneration)) refreshSummary()
        if (isCurrent(expectedGeneration)) unauthorizedRevision?.let(onUnauthorized)
    }

    private fun mutate(
        session: WearSessionEnvelope.Active,
        failureMessage: String,
        mutator: FeedingTimerMutator,
    ) {
        val timer: RestoredFeedingTimer
        val requestGeneration: Long
        synchronized(this) {
            if (state == FeedingTimerUiState.Submitting) return
            timer = (state as? FeedingTimerUiState.SnapshotActive)?.timer ?: return
            if (!timer.canControl) return
            requestGeneration = generation
            state = FeedingTimerUiState.Submitting
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
        timer: RestoredFeedingTimer,
        failureMessage: String,
        mutator: FeedingTimerMutator,
        outcome: TimerMutationOutcome,
        expectedGeneration: Long,
    ) {
        var shouldRefresh = false
        var unauthorizedRevision: Long? = null
        synchronized(this) {
            if (generation != expectedGeneration) return
            state = when (outcome) {
                is TimerMutationOutcome.Success -> {
                    pendingRetry = null
                    shouldRefresh = true
                    FeedingTimerUiState.SnapshotActive(outcome.timer)
                }
                TimerMutationOutcome.Offline -> {
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
                    FeedingTimerUiState.Error("No network connection")
                }
                TimerMutationOutcome.Unauthorized -> {
                    pendingRetry = null
                    unauthorizedRevision = session.revision
                    FeedingTimerUiState.Error("Session expired", canRetry = false)
                }
                TimerMutationOutcome.Failed -> {
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
                    FeedingTimerUiState.Error(failureMessage)
                }
            }
        }
        if (shouldRefresh && isCurrent(expectedGeneration)) refreshSummary()
        if (isCurrent(expectedGeneration)) unauthorizedRevision?.let(onUnauthorized)
    }

    private fun applyHydrationOutcome(
        session: WearSessionEnvelope.Active,
        publicTimer: RestoredFeedingTimer,
        outcome: TimerReadOutcome,
        expectedGeneration: Long,
    ) {
        var unauthorizedRevision: Long? = null
        synchronized(this) {
            if (generation != expectedGeneration) return
            state = when (outcome) {
                is TimerReadOutcome.Success -> {
                    pendingRetry = null
                    FeedingTimerUiState.SnapshotActive(
                        outcome.timer.copy(
                            canControl = true,
                            elapsedSeconds = publicTimer.elapsedSeconds,
                        ),
                    )
                }
                TimerReadOutcome.Missing -> FeedingTimerUiState.SnapshotActive(publicTimer)
                TimerReadOutcome.Offline -> {
                    pendingRetry = { retrySession ->
                        applyHydrationOutcome(
                            retrySession,
                            publicTimer,
                            timerReader.read(retrySession),
                            expectedGeneration,
                        )
                    }
                    FeedingTimerUiState.Error("No network connection")
                }
                TimerReadOutcome.Unauthorized -> {
                    pendingRetry = null
                    unauthorizedRevision = session.revision
                    FeedingTimerUiState.Error("Session expired", canRetry = false)
                }
                TimerReadOutcome.Failed -> {
                    pendingRetry = { retrySession ->
                        applyHydrationOutcome(
                            retrySession,
                            publicTimer,
                            timerReader.read(retrySession),
                            expectedGeneration,
                        )
                    }
                    FeedingTimerUiState.Error("Could not restore feeding")
                }
            }
        }
        if (isCurrent(expectedGeneration)) unauthorizedRevision?.let(onUnauthorized)
    }
}
