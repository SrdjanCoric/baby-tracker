package com.sofibaby.app.wear

import java.time.Duration
import java.time.Instant

fun interface BabyDirectoryLoader {
    fun load(session: WearSessionEnvelope.Active): BabyDirectoryOutcome
}

fun interface SnapshotLoader {
    fun load(session: WearSessionEnvelope.Active): SnapshotOutcome
}

enum class TodayRefreshResult {
    Success,
    Failed,
    Unauthorized,
}

sealed interface TodaySummaryUiState {
    data object Unavailable : TodaySummaryUiState

    data class Loading(
        val selectedBaby: BabyIdentity,
        val babies: List<BabyIdentity>,
    ) : TodaySummaryUiState

    data class Content(
        val selectedBaby: BabyIdentity,
        val babies: List<BabyIdentity>,
        val snapshot: ActivitySnapshot,
    ) : TodaySummaryUiState

    data class Empty(
        val selectedBaby: BabyIdentity,
        val babies: List<BabyIdentity>,
        val snapshot: ActivitySnapshot,
    ) : TodaySummaryUiState

    data class Error(
        val selectedBaby: BabyIdentity,
        val babies: List<BabyIdentity>,
        val lastSnapshot: ActivitySnapshot?,
    ) : TodaySummaryUiState
}

class TodaySummaryCoordinator(
    private val babyDirectory: BabyDirectoryLoader,
    private val snapshots: SnapshotLoader,
    preferredBabyId: String? = null,
    private val onStateChanged: (TodaySummaryUiState) -> Unit = {},
) {
    var state: TodaySummaryUiState = TodaySummaryUiState.Unavailable
        private set(value) {
            field = value
            onStateChanged(value)
        }

    private var babies: List<BabyIdentity> = emptyList()
    private var selectedBaby: BabyIdentity? = null
    private var directoryLoaded = false
    private var lastSnapshot: ActivitySnapshot? = null
    private var preferredBabyId = preferredBabyId

    fun refresh(
        session: WearSessionEnvelope.Active,
        reloadBabies: Boolean,
    ): TodayRefreshResult {
        val sessionBaby = BabyIdentity(
            id = session.baby.id,
            name = session.baby.name,
            timezone = session.baby.timezone,
        )
        if (selectedBaby == null) selectedBaby = sessionBaby
        if (reloadBabies || !directoryLoaded) {
            when (val outcome = babyDirectory.load(session)) {
                is BabyDirectoryOutcome.Success -> {
                    babies = outcome.babies.ifEmpty { listOf(sessionBaby) }
                    selectedBaby = babies.firstOrNull { it.id == preferredBabyId }
                        ?: babies.firstOrNull { it.id == selectedBaby?.id }
                        ?: babies.firstOrNull { it.id == sessionBaby.id }
                        ?: babies.first()
                    directoryLoaded = true
                }
                BabyDirectoryOutcome.Unauthorized -> return unauthorized()
                BabyDirectoryOutcome.Failed,
                BabyDirectoryOutcome.Offline -> {
                    if (babies.isEmpty()) babies = listOf(sessionBaby)
                }
            }
        }
        return loadSelected(session)
    }

    fun retry(session: WearSessionEnvelope.Active): TodayRefreshResult =
        refresh(session, reloadBabies = !directoryLoaded)

    fun selectBaby(session: WearSessionEnvelope.Active, babyId: String): TodayRefreshResult {
        val selected = babies.firstOrNull { it.id == babyId } ?: return TodayRefreshResult.Failed
        preferredBabyId = babyId
        selectedBaby = selected
        return loadSelected(session)
    }

    private fun loadSelected(session: WearSessionEnvelope.Active): TodayRefreshResult {
        val selected = selectedBaby ?: return TodayRefreshResult.Failed
        state = TodaySummaryUiState.Loading(selected, babies)
        val selectedSession = session.copy(
            baby = WearSessionEnvelope.Baby(selected.id, selected.name, selected.timezone),
        )
        return when (val outcome = snapshots.load(selectedSession)) {
            is SnapshotOutcome.Success -> {
                lastSnapshot = outcome.snapshot
                state = if (outcome.snapshot.hasVisibleActivity()) {
                    TodaySummaryUiState.Content(selected, babies, outcome.snapshot)
                } else {
                    TodaySummaryUiState.Empty(selected, babies, outcome.snapshot)
                }
                TodayRefreshResult.Success
            }
            SnapshotOutcome.Unauthorized -> unauthorized()
            SnapshotOutcome.Failed,
            SnapshotOutcome.Offline -> {
                state = TodaySummaryUiState.Error(selected, babies, lastSnapshot)
                TodayRefreshResult.Failed
            }
        }
    }

    private fun unauthorized(): TodayRefreshResult {
        val selected = selectedBaby
        if (selected != null) state = TodaySummaryUiState.Error(selected, babies, lastSnapshot)
        return TodayRefreshResult.Unauthorized
    }

    private fun ActivitySnapshot.hasVisibleActivity(): Boolean {
        val counts = activities.diaper.todayCounts
        return activeTimers.isNotEmpty() ||
            activities.feeding.lastTime != null || activities.feeding.todayCount > 0 ||
            activities.sleep.lastTime != null || activities.sleep.todayMinutes > 0 ||
            activities.diaper.lastTime != null || counts.wet + counts.dirty + counts.mixed + counts.dry > 0 ||
            activities.pumping.lastTime != null || activities.pumping.todayVolumeMl > 0 ||
            activities.pumping.sessionCount > 0 ||
            activities.tummyTime.lastTime != null || activities.tummyTime.todayMinutes > 0
    }
}

data class TodaySummaryPresentation(
    val rows: List<SummaryRow>,
    val timers: List<TimerRow>,
    val updatedAgo: String,
) {
    data class SummaryRow(val label: String, val value: String, val detail: String)
    data class TimerRow(val title: String, val detail: String)
}

object TodaySummaryProjector {
    fun project(
        snapshot: ActivitySnapshot,
        now: Instant = Instant.now(),
    ): TodaySummaryPresentation {
        val activity = snapshot.activities
        val sleepDetails = buildList {
            add("${activity.sleep.todayMinutes} min today · ${activity.sleep.goalMinutes} min goal")
            activity.sleep.wakeWindowMinutes?.let { add("Wake window $it min") }
            activity.sleep.wakeWindowSlotLabel?.let { add(it) }
            if (activity.sleep.morningConfirmationPending == true) add("Morning sleep needs confirmation")
        }.joinToString(" · ")
        val counts = activity.diaper.todayCounts
        val rows = listOf(
            TodaySummaryPresentation.SummaryRow(
                "Feeding",
                "${activity.feeding.todayCount} today",
                recent(activity.feeding.lastTime, listOfNotNull(activity.feeding.lastType, activity.feeding.lastSide), now),
            ),
            TodaySummaryPresentation.SummaryRow(
                "Sleep",
                activity.sleep.lastDurationMinutes?.let { "$it min last sleep" } ?: "No completed sleep",
                listOf(sleepDetails, recent(activity.sleep.lastTime, emptyList(), now)).filter { it.isNotBlank() }.joinToString(" · "),
            ),
            TodaySummaryPresentation.SummaryRow(
                "Diaper",
                "Wet ${counts.wet} · Dirty ${counts.dirty} · Mixed ${counts.mixed} · Dry ${counts.dry}",
                recent(activity.diaper.lastTime, listOfNotNull(activity.diaper.lastType), now),
            ),
            TodaySummaryPresentation.SummaryRow(
                "Pumping",
                "${number(activity.pumping.todayVolumeMl)} ml · ${activity.pumping.sessionCount} sessions",
                recent(activity.pumping.lastTime, listOfNotNull(activity.pumping.lastSide), now),
            ),
            TodaySummaryPresentation.SummaryRow(
                "Tummy time",
                "${activity.tummyTime.todayMinutes} min today",
                listOf(
                    "${activity.tummyTime.goalMinutes} min goal",
                    recent(activity.tummyTime.lastTime, activity.tummyTime.lastDurationMinutes?.let { listOf("$it min") } ?: emptyList(), now),
                ).joinToString(" · "),
            ),
        )
        val timers = snapshot.activeTimers.map { timer ->
            val label = when (timer.type) {
                "tummyTime" -> "Tummy time"
                else -> timer.type.replaceFirstChar { it.uppercase() }
            }
            val details = buildList {
                timer.context?.let(::add)
                if (timer.isPaused == true) add("paused")
                if (timer.isRemote == true) add("another caregiver")
                add("Started ${elapsedSince(timer.startTime, now)} ago")
            }
            TodaySummaryPresentation.TimerRow("$label active", details.joinToString(" · "))
        }
        return TodaySummaryPresentation(rows, timers, elapsedSince(snapshot.updatedAt, now))
    }

    private fun recent(time: String?, facts: List<String>, now: Instant): String =
        (facts + listOfNotNull(time?.let { "Last ${elapsedSince(it, now)}" }))
            .ifEmpty { listOf("No entries yet") }
            .joinToString(" · ")

    private fun elapsedSince(value: String, now: Instant): String {
        val instant = runCatching { Instant.parse(value) }.getOrNull() ?: return "--"
        val totalMinutes = Duration.between(instant, now).seconds.coerceAtLeast(0) / 60
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        val days = hours / 24
        return when {
            days >= 365 -> "${days / 365}y"
            days >= 60 -> "${(days / 30).coerceAtMost(11)}mo"
            days >= 1 -> "${days}d"
            hours > 0 -> "${hours}h ${minutes}m"
            else -> "${totalMinutes}m"
        }
    }

    private fun number(value: Double): String =
        if (value % 1.0 == 0.0) value.toInt().toString() else value.toString()
}

class TodaySummaryRefreshDriver(
    private val session: () -> WearSessionEnvelope.Active?,
    private val coordinator: TodaySummaryCoordinator,
    private val onState: (TodaySummaryUiState) -> Unit,
    private val onUnauthorized: (Long) -> Unit,
    private val onSuccess: (Long) -> Unit = {},
) {
    fun onOpen() = run { active -> coordinator.refresh(active, reloadBabies = true) }

    fun onWake() = run { active -> coordinator.refresh(active, reloadBabies = false) }

    fun retry() = run { active -> coordinator.retry(active) }

    fun selectBaby(babyId: String) = run { active -> coordinator.selectBaby(active, babyId) }

    private fun run(action: (WearSessionEnvelope.Active) -> TodayRefreshResult): TodayRefreshResult? {
        val active = session() ?: return null
        val result = action(active)
        onState(coordinator.state)
        if (result == TodayRefreshResult.Unauthorized) onUnauthorized(active.revision)
        if (result == TodayRefreshResult.Success) onSuccess(active.revision)
        return result
    }
}
