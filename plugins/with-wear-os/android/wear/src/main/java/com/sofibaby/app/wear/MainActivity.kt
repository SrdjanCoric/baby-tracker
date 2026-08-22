package com.sofibaby.app.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
                    onRetry = WearSessionRuntime::retry,
                    onSelectBaby = WearSessionRuntime::selectBaby,
                    onLogDiaper = WearSessionRuntime::logDiaper,
                    onRetryDiaper = WearSessionRuntime::retryDiaper,
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
    onRetry: () -> Unit,
    onSelectBaby: (String) -> Unit,
    onLogDiaper: (DiaperType, StoolColor?) -> Unit,
    onRetryDiaper: () -> Unit,
) {
    when (sessionState) {
        WearSessionUiState.SignedOut -> SignedOutScreen()
        WearSessionUiState.ReconnectFromPhone -> CenteredMessage("Reconnect from phone")
        is WearSessionUiState.SignedIn -> TodaySummaryScreen(
            todayState,
            diaperState,
            onRetry,
            onSelectBaby,
            onLogDiaper,
            onRetryDiaper,
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
    onRetry: () -> Unit,
    onSelectBaby: (String) -> Unit,
    onLogDiaper: (DiaperType, StoolColor?) -> Unit,
    onRetryDiaper: () -> Unit,
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
