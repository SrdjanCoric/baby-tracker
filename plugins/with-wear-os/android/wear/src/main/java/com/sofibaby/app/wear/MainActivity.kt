package com.sofibaby.app.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.currentStateAsState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import java.time.Instant
import kotlinx.coroutines.delay

data class FeedingActions(
    val start: (BreastSide) -> Unit,
    val pause: () -> Unit,
    val resume: () -> Unit,
    val switchSide: () -> Unit,
    val stop: () -> Unit,
    val retryTimer: () -> Unit,
    val logBottle: (BottleLogSelection) -> Unit,
    val retryBottle: () -> Unit,
)

data class SleepActions(
    val start: () -> Unit,
    val pause: () -> Unit,
    val resume: () -> Unit,
    val stop: () -> Unit,
    val retry: () -> Unit,
)

data class PumpingActions(
    val start: (BreastSide) -> Unit,
    val pause: () -> Unit,
    val resume: () -> Unit,
    val stop: (PumpingVolumeSelection) -> Unit,
    val retry: () -> Unit,
)

data class TummyTimeActions(
    val start: () -> Unit,
    val pause: () -> Unit,
    val resume: () -> Unit,
    val stop: () -> Unit,
    val retry: () -> Unit,
)

object TodaySummaryTicker {
    fun shouldRun(hasActiveTimers: Boolean, lifecycleState: Lifecycle.State): Boolean =
        hasActiveTimers && lifecycleState == Lifecycle.State.RESUMED
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WearSessionRuntime.initialize(this)
        setContent {
            MaterialTheme {
                WearAppScreen(
                    sessionState = WearSessionRuntime.state.value,
                    todayState = WearSessionRuntime.todayState.value,
                    diaperState = WearSessionRuntime.diaperState.value,
                    feedingState = WearSessionRuntime.feedingState.value,
                    sleepState = WearSessionRuntime.sleepState.value,
                    pumpingState = WearSessionRuntime.pumpingState.value,
                    tummyTimeState = WearSessionRuntime.tummyTimeState.value,
                    bottleState = WearSessionRuntime.bottleState.value,
                    onRetry = WearSessionRuntime::retry,
                    onSelectBaby = WearSessionRuntime::selectBaby,
                    onLogDiaper = WearSessionRuntime::logDiaper,
                    onRetryDiaper = WearSessionRuntime::retryDiaper,
                    feedingActions = FeedingActions(
                        start = WearSessionRuntime::startFeeding,
                        pause = WearSessionRuntime::pauseFeeding,
                        resume = WearSessionRuntime::resumeFeeding,
                        switchSide = WearSessionRuntime::switchFeedingSide,
                        stop = WearSessionRuntime::stopFeeding,
                        retryTimer = WearSessionRuntime::retryFeeding,
                        logBottle = WearSessionRuntime::logBottle,
                        retryBottle = WearSessionRuntime::retryBottle,
                    ),
                    sleepActions = SleepActions(
                        start = WearSessionRuntime::startSleep,
                        pause = WearSessionRuntime::pauseSleep,
                        resume = WearSessionRuntime::resumeSleep,
                        stop = WearSessionRuntime::stopSleep,
                        retry = WearSessionRuntime::retrySleep,
                    ),
                    pumpingActions = PumpingActions(
                        start = WearSessionRuntime::startPumping,
                        pause = WearSessionRuntime::pausePumping,
                        resume = WearSessionRuntime::resumePumping,
                        stop = WearSessionRuntime::stopPumping,
                        retry = WearSessionRuntime::retryPumping,
                    ),
                    tummyTimeActions = TummyTimeActions(
                        start = WearSessionRuntime::startTummyTime,
                        pause = WearSessionRuntime::pauseTummyTime,
                        resume = WearSessionRuntime::resumeTummyTime,
                        stop = WearSessionRuntime::stopTummyTime,
                        retry = WearSessionRuntime::retryTummyTime,
                    ),
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        WearSessionRuntime.onWake()
    }
}

@Composable
fun WearAppScreen(
    sessionState: WearSessionUiState,
    todayState: TodaySummaryUiState,
    diaperState: DiaperQuickLogState,
    feedingState: FeedingTimerUiState,
    sleepState: SleepTimerUiState,
    pumpingState: PumpingTimerUiState,
    tummyTimeState: TummyTimeTimerUiState,
    bottleState: BottleLogUiState,
    onRetry: () -> Unit,
    onSelectBaby: (String) -> Unit,
    onLogDiaper: (DiaperType, StoolColor?) -> Unit,
    onRetryDiaper: () -> Unit,
    feedingActions: FeedingActions,
    sleepActions: SleepActions,
    pumpingActions: PumpingActions,
    tummyTimeActions: TummyTimeActions,
) {
    when (sessionState) {
        WearSessionUiState.SignedOut -> SignedOutScreen()
        WearSessionUiState.ReconnectFromPhone -> CenteredMessage("Reconnect from phone")
        is WearSessionUiState.SignedIn -> TodaySummaryScreen(
            todayState,
            diaperState,
            feedingState,
            sleepState,
            pumpingState,
            tummyTimeState,
            bottleState,
            onRetry,
            onSelectBaby,
            onLogDiaper,
            onRetryDiaper,
            feedingActions,
            sleepActions,
            pumpingActions,
            tummyTimeActions,
        )
    }
}

@Composable
fun SignedOutScreen() {
    CenteredMessage(SignedOutState.message)
}

@Composable
private fun TodaySummaryScreen(
    state: TodaySummaryUiState,
    diaperState: DiaperQuickLogState,
    feedingState: FeedingTimerUiState,
    sleepState: SleepTimerUiState,
    pumpingState: PumpingTimerUiState,
    tummyTimeState: TummyTimeTimerUiState,
    bottleState: BottleLogUiState,
    onRetry: () -> Unit,
    onSelectBaby: (String) -> Unit,
    onLogDiaper: (DiaperType, StoolColor?) -> Unit,
    onRetryDiaper: () -> Unit,
    feedingActions: FeedingActions,
    sleepActions: SleepActions,
    pumpingActions: PumpingActions,
    tummyTimeActions: TummyTimeActions,
) {
    when (state) {
        TodaySummaryUiState.Unavailable -> CenteredMessage("Loading today's activity…")
        is TodaySummaryUiState.Loading -> CenteredMessage("Loading ${state.selectedBaby.name}…")
        is TodaySummaryUiState.Error -> CenteredAction(
            message = "Could not refresh today's activity",
            action = "Retry",
            onAction = onRetry,
        )
        is TodaySummaryUiState.Content -> SummaryContent(
            selectedBaby = state.selectedBaby,
            babies = state.babies,
            snapshot = state.snapshot,
            empty = false,
            refreshFailed = false,
            onRetry = onRetry,
            onSelectBaby = onSelectBaby,
            diaperState = diaperState,
            onLogDiaper = onLogDiaper,
            onRetryDiaper = onRetryDiaper,
            feedingState = feedingState,
            sleepState = sleepState,
            pumpingState = pumpingState,
            tummyTimeState = tummyTimeState,
            bottleState = bottleState,
            feedingActions = feedingActions,
            sleepActions = sleepActions,
            pumpingActions = pumpingActions,
            tummyTimeActions = tummyTimeActions,
        )
        is TodaySummaryUiState.Empty -> SummaryContent(
            selectedBaby = state.selectedBaby,
            babies = state.babies,
            snapshot = state.snapshot,
            empty = true,
            refreshFailed = false,
            onRetry = onRetry,
            onSelectBaby = onSelectBaby,
            diaperState = diaperState,
            onLogDiaper = onLogDiaper,
            onRetryDiaper = onRetryDiaper,
            feedingState = feedingState,
            sleepState = sleepState,
            pumpingState = pumpingState,
            tummyTimeState = tummyTimeState,
            bottleState = bottleState,
            feedingActions = feedingActions,
            sleepActions = sleepActions,
            pumpingActions = pumpingActions,
            tummyTimeActions = tummyTimeActions,
        )
        is TodaySummaryUiState.Stale -> SummaryContent(
            selectedBaby = state.selectedBaby,
            babies = state.babies,
            snapshot = state.snapshot,
            empty = state.empty,
            refreshFailed = true,
            onRetry = onRetry,
            onSelectBaby = onSelectBaby,
            diaperState = diaperState,
            onLogDiaper = onLogDiaper,
            onRetryDiaper = onRetryDiaper,
            feedingState = feedingState,
            sleepState = sleepState,
            pumpingState = pumpingState,
            tummyTimeState = tummyTimeState,
            bottleState = bottleState,
            feedingActions = feedingActions,
            sleepActions = sleepActions,
            pumpingActions = pumpingActions,
            tummyTimeActions = tummyTimeActions,
        )
    }
}

@Composable
private fun SummaryContent(
    selectedBaby: BabyIdentity,
    babies: List<BabyIdentity>,
    snapshot: ActivitySnapshot,
    empty: Boolean,
    refreshFailed: Boolean,
    onRetry: () -> Unit,
    onSelectBaby: (String) -> Unit,
    diaperState: DiaperQuickLogState,
    onLogDiaper: (DiaperType, StoolColor?) -> Unit,
    onRetryDiaper: () -> Unit,
    feedingState: FeedingTimerUiState,
    sleepState: SleepTimerUiState,
    pumpingState: PumpingTimerUiState,
    tummyTimeState: TummyTimeTimerUiState,
    bottleState: BottleLogUiState,
    feedingActions: FeedingActions,
    sleepActions: SleepActions,
    pumpingActions: PumpingActions,
    tummyTimeActions: TummyTimeActions,
) {
    val presentation = remember(snapshot) { TodaySummaryProjector.projectStatic(snapshot) }
    var pickerOpen by remember { mutableStateOf(false) }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (babies.size > 1) {
            Button(onClick = { pickerOpen = !pickerOpen }, modifier = Modifier.fillMaxWidth()) {
                Text("${selectedBaby.name} ▾", textAlign = TextAlign.Center)
            }
            if (pickerOpen) {
                babies.forEach { baby ->
                    Button(
                        onClick = {
                            pickerOpen = false
                            onSelectBaby(baby.id)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (baby.id == selectedBaby.id) "✓ ${baby.name}" else baby.name)
                    }
                }
            }
        } else {
            Text(selectedBaby.name, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        }
        if (refreshFailed) {
            Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
                Text("Could not refresh · Retry", textAlign = TextAlign.Center)
            }
        }
        if (empty) {
            Text("No activity yet today", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        }
        ActiveTimerCards(snapshot.activeTimers)
        FeedingSection(snapshot, feedingState, bottleState, feedingActions)
        SleepSection(snapshot, sleepState, sleepActions)
        PumpingSection(snapshot, pumpingState, pumpingActions)
        TummyTimeSection(snapshot, tummyTimeState, tummyTimeActions)
        DiaperQuickLogSection(diaperState, onLogDiaper, onRetryDiaper)
        presentation.rows.forEach { row ->
            SummaryCard(row.label, "${row.value}\n${row.detail}")
        }
        Text(
            "Updated ${presentation.updatedAgo}",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun TummyTimeSection(
    snapshot: ActivitySnapshot,
    timerState: TummyTimeTimerUiState,
    actions: TummyTimeActions,
) {
    val snapshotTimer = snapshot.activeTimers.firstOrNull { it.type == "tummyTime" }
    val activeTimer = (timerState as? TummyTimeTimerUiState.SnapshotActive)?.timer
        ?: (timerState as? TummyTimeTimerUiState.Hydrating)?.timer
        ?: snapshotTimer?.let(TummyTimeTimerRestorer::restore)
    val busy = timerState == TummyTimeTimerUiState.Submitting ||
        timerState is TummyTimeTimerUiState.Hydrating || timerState is TummyTimeTimerUiState.Error

    Text("Tummy time", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    Text(
        "${snapshot.activities.tummyTime.todayMinutes} min today",
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Center,
    )
    if (activeTimer == null) {
        Button(onClick = actions.start, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            Text("Start tummy time")
        }
    } else {
        Text(
            if (activeTimer.canControl) {
                "Tummy time" + if (activeTimer.isPaused) " · paused" else " · active"
            } else {
                "Tummy time active"
            },
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        if (activeTimer.canControl) {
            Button(
                onClick = if (activeTimer.isPaused) actions.resume else actions.pause,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (activeTimer.isPaused) "Resume" else "Pause") }
            Button(onClick = actions.stop, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                Text("Stop tummy time")
            }
        } else {
            Text(
                "Active on another caregiver's device",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
    when (timerState) {
        TummyTimeTimerUiState.Idle, is TummyTimeTimerUiState.SnapshotActive -> Unit
        is TummyTimeTimerUiState.Hydrating -> Text(
            "Restoring tummy time…",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        TummyTimeTimerUiState.Submitting -> Text(
            "Saving tummy time…",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        is TummyTimeTimerUiState.AlreadyActive -> Text(
            "Tummy time already active${timerState.caregiverName?.let { " · $it" } ?: ""}",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        is TummyTimeTimerUiState.Error -> {
            Text(timerState.message, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            if (timerState.canRetry) {
                Button(onClick = actions.retry, modifier = Modifier.fillMaxWidth()) { Text("Retry tummy time") }
            }
        }
    }
}

@Composable
private fun PumpingSection(
    snapshot: ActivitySnapshot,
    timerState: PumpingTimerUiState,
    actions: PumpingActions,
) {
    val snapshotTimer = snapshot.activeTimers.firstOrNull { it.type == "pumping" }
    val activeTimer = (timerState as? PumpingTimerUiState.SnapshotActive)?.timer
        ?: (timerState as? PumpingTimerUiState.Hydrating)?.timer
        ?: snapshotTimer?.let(PumpingTimerRestorer::restore)
    val busy = timerState == PumpingTimerUiState.Submitting ||
        timerState is PumpingTimerUiState.Hydrating || timerState is PumpingTimerUiState.Error
    var enteringVolume by remember { mutableStateOf(false) }
    var selection by remember { mutableStateOf(PumpingVolumeSelection()) }
    var rotaryAdjustmentActive by remember { mutableStateOf(false) }
    val rotaryFocus = remember { FocusRequester() }
    LaunchedEffect(timerState) {
        if (timerState == PumpingTimerUiState.Idle) {
            enteringVolume = false
            rotaryAdjustmentActive = false
            selection = PumpingVolumeSelection()
        }
        if (timerState == PumpingTimerUiState.Submitting) rotaryAdjustmentActive = false
    }
    LaunchedEffect(rotaryAdjustmentActive) {
        if (rotaryAdjustmentActive) rotaryFocus.requestFocus()
    }

    Text("Pumping", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    if (activeTimer == null) {
        val suggested = if (snapshot.activities.pumping.lastSide == BreastSide.Left.wireValue) {
            BreastSide.Right
        } else {
            BreastSide.Left
        }
        Text(
            "Suggested ${suggested.wireValue}",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        Button(
            onClick = { actions.start(BreastSide.Left) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (suggested == BreastSide.Left) "Start left · suggested" else "Start left") }
        Button(
            onClick = { actions.start(BreastSide.Right) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (suggested == BreastSide.Right) "Start right · suggested" else "Start right") }
        Button(
            onClick = { actions.start(BreastSide.Both) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Start both") }
    } else {
        Text(
            if (activeTimer.canControl) {
                "Pumping · ${activeTimer.side.wireValue}" + if (activeTimer.isPaused) " · paused" else ""
            } else {
                "Pumping active"
            },
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        if (activeTimer.canControl) {
            Button(
                onClick = if (activeTimer.isPaused) actions.resume else actions.pause,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (activeTimer.isPaused) "Resume" else "Pause") }
            Button(
                onClick = { enteringVolume = true },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Stop pumping") }
        } else {
            Text(
                "Active on another caregiver's device",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
    if (enteringVolume && activeTimer?.canControl == true) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .onRotaryScrollEvent {
                    val outcome = PumpingVolumeRotary.handle(
                        selection,
                        it.verticalScrollPixels,
                        rotaryAdjustmentActive,
                        !busy,
                    )
                    selection = outcome.selection
                    outcome.consumed
                }
                .focusRequester(rotaryFocus)
                .focusable(),
        ) {
            Text(
                "Volume · ${selection.volumeMl} ml",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                Button(onClick = { selection = selection.minusTen() }, enabled = !busy) { Text("−10") }
                Button(onClick = { selection = selection.plusTen() }, enabled = !busy) { Text("+10") }
            }
            Button(
                onClick = { rotaryAdjustmentActive = !rotaryAdjustmentActive },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (rotaryAdjustmentActive) "Done adjusting" else "Adjust with crown · 5 ml steps")
            }
            Button(
                onClick = { actions.stop(selection) },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Save pumping") }
        }
    }
    when (timerState) {
        PumpingTimerUiState.Idle, is PumpingTimerUiState.SnapshotActive -> Unit
        is PumpingTimerUiState.Hydrating -> Text(
            "Restoring pumping…",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        PumpingTimerUiState.Submitting -> Text(
            "Saving pumping…",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        is PumpingTimerUiState.AlreadyActive -> Text(
            "Pumping already active${timerState.caregiverName?.let { " · $it" } ?: ""}",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        is PumpingTimerUiState.Error -> {
            Text(timerState.message, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            if (timerState.canRetry) {
                Button(onClick = actions.retry, modifier = Modifier.fillMaxWidth()) { Text("Retry pumping") }
            }
        }
    }
}

@Composable
private fun SleepSection(
    snapshot: ActivitySnapshot,
    timerState: SleepTimerUiState,
    actions: SleepActions,
) {
    val snapshotTimer = snapshot.activeTimers.firstOrNull { it.type == "sleep" }
    val activeTimer = (timerState as? SleepTimerUiState.SnapshotActive)?.timer
        ?: (timerState as? SleepTimerUiState.Hydrating)?.timer
        ?: snapshotTimer?.let(SleepTimerRestorer::restore)
    val busy = timerState == SleepTimerUiState.Submitting ||
        timerState is SleepTimerUiState.Hydrating || timerState is SleepTimerUiState.Error
    val now by produceState(initialValue = Instant.now(), key1 = snapshot.activities.sleep.lastSleepEndedAt) {
        while (true) {
            delay(60_000)
            value = Instant.now()
        }
    }
    val presentation = remember(snapshot.activities.sleep, now) {
        SleepSectionProjector.project(snapshot.activities.sleep, now)
    }

    Text("Sleep", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    presentation.confirmationNotice?.let {
        Text(it, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    }
    if (activeTimer == null) {
        presentation.idleReadouts.forEach {
            Text(it, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        }
        Button(onClick = actions.start, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            Text("Start sleep · automatic")
        }
    } else {
        Text(
            if (activeTimer.canControl) {
                "${activeTimer.type.wireValue.replaceFirstChar { it.uppercase() }} sleep" +
                    if (activeTimer.isPaused) " · paused" else ""
            } else {
                "Sleep active"
            },
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        if (activeTimer.canControl) {
            Button(
                onClick = if (activeTimer.isPaused) actions.resume else actions.pause,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (activeTimer.isPaused) "Resume" else "Pause") }
            Button(onClick = actions.stop, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                Text("Stop sleep")
            }
        } else {
            Text(
                "Active on another caregiver's device",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
    when (timerState) {
        SleepTimerUiState.Idle, is SleepTimerUiState.SnapshotActive -> Unit
        is SleepTimerUiState.Hydrating -> Text(
            "Restoring sleep…",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        SleepTimerUiState.Submitting -> Text(
            "Saving sleep…",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        is SleepTimerUiState.AlreadyActive -> Text(
            "Sleep already active${timerState.caregiverName?.let { " · $it" } ?: ""}",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        is SleepTimerUiState.Error -> {
            Text(timerState.message, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            if (timerState.canRetry) {
                Button(onClick = actions.retry, modifier = Modifier.fillMaxWidth()) { Text("Retry sleep") }
            }
        }
    }
}

@Composable
private fun FeedingSection(
    snapshot: ActivitySnapshot,
    timerState: FeedingTimerUiState,
    bottleState: BottleLogUiState,
    actions: FeedingActions,
) {
    val snapshotTimer = snapshot.activeTimers.firstOrNull { it.type == "feeding" }
    val activeTimer = (timerState as? FeedingTimerUiState.SnapshotActive)?.timer
        ?: (timerState as? FeedingTimerUiState.Hydrating)?.timer
        ?: snapshotTimer?.let(FeedingTimerRestorer::restore)
    val busy = timerState == FeedingTimerUiState.Submitting ||
        timerState is FeedingTimerUiState.Hydrating || timerState is FeedingTimerUiState.Error
    Text("Feeding", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    if (activeTimer == null) {
        val suggested = if (snapshot.activities.feeding.lastSide == BreastSide.Left.wireValue) {
            BreastSide.Right
        } else {
            BreastSide.Left
        }
        Text(
            "Suggested ${suggested.wireValue}",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        Button(
            onClick = { actions.start(BreastSide.Left) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (suggested == BreastSide.Left) "Start left · suggested" else "Start left") }
        Button(
            onClick = { actions.start(BreastSide.Right) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (suggested == BreastSide.Right) "Start right · suggested" else "Start right") }
    } else {
        Text(
            if (activeTimer.canControl) {
                "Breast · ${activeTimer.side.wireValue}" + if (activeTimer.isPaused) " · paused" else ""
            } else {
                "Breast active"
            },
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        if (activeTimer.canControl) {
            Button(
                onClick = actions.switchSide,
                enabled = !busy && !activeTimer.isPaused,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Switch side") }
            Button(
                onClick = if (activeTimer.isPaused) actions.resume else actions.pause,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (activeTimer.isPaused) "Resume" else "Pause") }
            Button(onClick = actions.stop, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                Text("Stop feeding")
            }
        } else {
            Text("Active on another caregiver's device", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        }
    }
    when (timerState) {
        FeedingTimerUiState.Idle, is FeedingTimerUiState.SnapshotActive -> Unit
        is FeedingTimerUiState.Hydrating -> Text(
            "Restoring feeding…",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        FeedingTimerUiState.Submitting -> Text("Saving feeding…", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        is FeedingTimerUiState.AlreadyActive -> Text(
            "Feeding already active${timerState.caregiverName?.let { " · $it" } ?: ""}",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
        is FeedingTimerUiState.Error -> {
            Text(timerState.message, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            if (timerState.canRetry) {
                Button(onClick = actions.retryTimer, modifier = Modifier.fillMaxWidth()) { Text("Retry feeding") }
            }
        }
    }
    BottleLogSection(bottleState, actions.logBottle, actions.retryBottle)
}

@Composable
private fun BottleLogSection(
    state: BottleLogUiState,
    onLog: (BottleLogSelection) -> Unit,
    onRetry: () -> Unit,
) {
    var selection by remember { mutableStateOf(BottleLogSelection()) }
    var rotaryAdjustmentActive by remember { mutableStateOf(false) }
    val rotaryFocus = remember { FocusRequester() }
    LaunchedEffect(state) {
        if (state == BottleLogUiState.Success) selection = BottleLogSelection()
        if (state == BottleLogUiState.Submitting) rotaryAdjustmentActive = false
    }
    LaunchedEffect(rotaryAdjustmentActive) {
        if (rotaryAdjustmentActive) rotaryFocus.requestFocus()
    }
    val enabled = state != BottleLogUiState.Submitting
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .onRotaryScrollEvent {
                val outcome = BottleVolumeRotary.handle(
                    selection,
                    it.verticalScrollPixels,
                    rotaryAdjustmentActive,
                    enabled,
                )
                selection = outcome.selection
                outcome.consumed
            }
            .focusRequester(rotaryFocus)
            .focusable(),
    ) {
        Text("Bottle · ${selection.volumeMl} ml", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            Button(onClick = { selection = selection.minusTen() }, enabled = enabled) { Text("−10") }
            Button(onClick = { selection = selection.plusTen() }, enabled = enabled) { Text("+10") }
        }
        Button(
            onClick = { rotaryAdjustmentActive = !rotaryAdjustmentActive },
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (rotaryAdjustmentActive) "Done adjusting" else "Adjust with crown · 5 ml steps")
        }
        Button(
            onClick = { selection = selection.copy(contentType = BottleContentType.Formula) },
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (selection.contentType == BottleContentType.Formula) "✓ Formula" else "Formula") }
        Button(
            onClick = { selection = selection.copy(contentType = BottleContentType.BreastMilk) },
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (selection.contentType == BottleContentType.BreastMilk) "✓ Breast milk" else "Breast milk") }
        Button(onClick = { onLog(selection) }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text("Log bottle")
        }
        when (state) {
            BottleLogUiState.Idle -> Unit
            BottleLogUiState.Submitting -> Text("Logging bottle…", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            BottleLogUiState.Success -> Text("Bottle logged", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            is BottleLogUiState.Error -> {
                Text(state.message, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                if (state.canRetry) {
                    Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text("Retry bottle") }
                }
            }
        }
    }
}

@Composable
private fun DiaperQuickLogSection(
    state: DiaperQuickLogState,
    onLog: (DiaperType, StoolColor?) -> Unit,
    onRetry: () -> Unit,
) {
    var colorFor by remember { mutableStateOf<DiaperType?>(null) }
    LaunchedEffect(state) {
        if (state == DiaperQuickLogState.Success) colorFor = null
    }
    val enabled = state != DiaperQuickLogState.Submitting
    Text("Quick log diaper", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    if (colorFor == null) {
        DiaperType.entries.forEach { type ->
            Button(
                onClick = {
                    if (type == DiaperType.Dirty || type == DiaperType.Mixed) colorFor = type
                    else onLog(type, null)
                },
                enabled = enabled,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(type.wireValue.replaceFirstChar { it.uppercase() })
            }
        }
    } else {
        Text("Stool color (optional)", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        Button(onClick = { onLog(requireNotNull(colorFor), null) }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text("No color")
        }
        StoolColor.entries.forEach { color ->
            Button(
                onClick = { onLog(requireNotNull(colorFor), color) },
                enabled = enabled,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(color.wireValue.replaceFirstChar { it.uppercase() })
            }
        }
        Button(onClick = { colorFor = null }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text("Back")
        }
    }
    when (state) {
        DiaperQuickLogState.Idle -> Unit
        DiaperQuickLogState.Submitting -> Text("Logging…", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        DiaperQuickLogState.Success -> Text("Diaper logged", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        is DiaperQuickLogState.Error -> {
            Text(state.message, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            if (state.canRetry) {
                Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text("Retry") }
            }
        }
    }
}

@Composable
private fun ActiveTimerCards(activeTimers: List<ActivitySnapshot.ActiveTimer>) {
    if (activeTimers.isEmpty()) return
    val lifecycleState by LocalLifecycleOwner.current.lifecycle.currentStateAsState()
    val shouldTick = TodaySummaryTicker.shouldRun(activeTimers.isNotEmpty(), lifecycleState)
    val now by produceState(initialValue = Instant.now(), key1 = activeTimers, key2 = shouldTick) {
        if (!shouldTick) return@produceState
        while (true) {
            value = Instant.now()
            delay(1_000)
        }
    }
    val timers = remember(activeTimers, now) { TodaySummaryProjector.projectTimers(activeTimers, now) }
    timers.forEach { timer ->
        SummaryCard(timer.title, timer.detail)
    }
}

@Composable
private fun SummaryCard(title: String, detail: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(12.dp))
            .padding(10.dp),
    ) {
        Text(title)
        Text(detail)
    }
}

@Composable
private fun CenteredAction(message: String, action: String, onAction: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(message, textAlign = TextAlign.Center)
            Spacer(Modifier.height(10.dp))
            Button(onClick = onAction) { Text(action) }
        }
    }
}

@Composable
private fun CenteredMessage(message: String) {
    Box(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = message, textAlign = TextAlign.Center)
    }
}
