package com.sofibaby.app.wear

import android.content.Context
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import java.util.concurrent.Executors

object WearSessionRuntime {
    private val mutableState = mutableStateOf<WearSessionUiState>(WearSessionUiState.SignedOut)
    private val mutableTodayState = mutableStateOf<TodaySummaryUiState>(TodaySummaryUiState.Unavailable)
    private val mutableDiaperState = mutableStateOf<DiaperQuickLogState>(DiaperQuickLogState.Idle)
    private val mutableFeedingState = mutableStateOf<FeedingTimerUiState>(FeedingTimerUiState.Idle)
    private val mutableSleepState = mutableStateOf<SleepTimerUiState>(SleepTimerUiState.Idle)
    private val mutablePumpingState = mutableStateOf<PumpingTimerUiState>(PumpingTimerUiState.Idle)
    private val mutableTummyTimeState = mutableStateOf<TummyTimeTimerUiState>(TummyTimeTimerUiState.Idle)
    private val mutableBottleState = mutableStateOf<BottleLogUiState>(BottleLogUiState.Idle)
    private val executor = Executors.newSingleThreadExecutor()
    private var coordinator: WearSessionCoordinator? = null
    private var summaryDriver: TodaySummaryRefreshDriver? = null
    private var selectionStore: android.content.SharedPreferences? = null
    private var diaperCoordinator: DiaperQuickLogCoordinator? = null
    private var feedingCoordinator: FeedingTimerCoordinator? = null
    private var sleepCoordinator: SleepTimerCoordinator? = null
    private var pumpingCoordinator: PumpingTimerCoordinator? = null
    private var tummyTimeCoordinator: TummyTimeTimerCoordinator? = null
    private var bottleCoordinator: BottleLogCoordinator? = null

    val state: State<WearSessionUiState> = mutableState
    val todayState: State<TodaySummaryUiState> = mutableTodayState
    val diaperState: State<DiaperQuickLogState> = mutableDiaperState
    val feedingState: State<FeedingTimerUiState> = mutableFeedingState
    val sleepState: State<SleepTimerUiState> = mutableSleepState
    val pumpingState: State<PumpingTimerUiState> = mutablePumpingState
    val tummyTimeState: State<TummyTimeTimerUiState> = mutableTummyTimeState
    val bottleState: State<BottleLogUiState> = mutableBottleState

    @Synchronized
    fun initialize(context: Context) {
        if (coordinator != null) return
        val applicationContext = context.applicationContext
        val vault = EncryptedSessionVault(
            store = NoBackupSessionBlobStore(applicationContext),
            cipher = AesGcmSessionCipher(AndroidKeystoreSessionKeyProvider()),
        )
        coordinator = WearSessionCoordinator(
            vault = vault,
            refreshRequests = WearRefreshRequestPublisher { revision ->
                val request = PutDataMapRequest.create(REFRESH_PATH).apply {
                    dataMap.putLong("revision", revision)
                    dataMap.putLong("requestedAt", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                Wearable.getDataClient(applicationContext).putDataItem(request)
            },
        )
        selectionStore = applicationContext.getSharedPreferences(SELECTION_STORE, Context.MODE_PRIVATE)
        val writeStore = applicationContext.getSharedPreferences(WRITE_STORE, Context.MODE_PRIVATE)
        val writeClient = SupabaseWriteClient(
            transport = UrlConnectionWearHttpTransport,
            clockStore = SharedPreferencesWearClockStore(writeStore),
        )
        val summaryCoordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryClient(UrlConnectionWearHttpTransport).load(it) },
            snapshots = { SnapshotProbe(UrlConnectionWearHttpTransport).run(it) },
            preferredBabyId = selectionStore?.getString(SELECTED_BABY_KEY, null),
            onStateChanged = ::acceptTodayState,
        )
        summaryDriver = TodaySummaryRefreshDriver(
            session = ::usableSession,
            coordinator = summaryCoordinator,
            onState = { mutableTodayState.value = it },
            onUnauthorized = { revision ->
                coordinator?.onUnauthorized(revision)
                mutableState.value = coordinator?.state ?: WearSessionUiState.SignedOut
            },
            onSuccess = { revision -> coordinator?.onProbeSucceeded(revision) },
            onSessionScopeReset = {
                selectionStore?.edit()?.remove(SELECTED_BABY_KEY)?.apply()
            },
        )
        diaperCoordinator = DiaperQuickLogCoordinator(
            drafts = writeClient::newDiaperDraft,
            writer = writeClient::writeDiaper,
            refreshSummary = { summaryDriver?.onWake() },
            dispatch = { work -> executor.execute { work() } },
            onUnauthorized = { revision ->
                coordinator?.onUnauthorized(revision)
                mutableState.value = coordinator?.state ?: WearSessionUiState.SignedOut
            },
            onStateChanged = { mutableDiaperState.value = it },
        )
        feedingCoordinator = FeedingTimerCoordinator(
            drafts = writeClient::newFeedingTimerDraft,
            starter = writeClient::startFeedingTimer,
            refreshSummary = { summaryDriver?.onWake() },
            completionDrafts = writeClient::newCompletedFeedingDraft,
            completionWriter = writeClient::completeFeedingTimer,
            pauser = writeClient::pauseFeedingTimer,
            resumer = writeClient::resumeFeedingTimer,
            sideSwitcher = writeClient::switchFeedingSide,
            timerReader = writeClient::loadOwnedFeedingTimer,
            dispatch = { work -> executor.execute { work() } },
            onUnauthorized = ::handleUnauthorized,
            onStateChanged = { mutableFeedingState.value = it },
        )
        sleepCoordinator = SleepTimerCoordinator(
            drafts = writeClient::newSleepTimerDraft,
            starter = writeClient::startSleepTimer,
            refreshSummary = { summaryDriver?.onWake() },
            completionDrafts = writeClient::newCompletedSleepDraft,
            completionWriter = writeClient::completeSleepTimer,
            pauser = writeClient::pauseSleepTimer,
            resumer = writeClient::resumeSleepTimer,
            timerReader = writeClient::loadOwnedSleepTimer,
            dispatch = { work -> executor.execute { work() } },
            onUnauthorized = ::handleUnauthorized,
            onStateChanged = { mutableSleepState.value = it },
        )
        pumpingCoordinator = PumpingTimerCoordinator(
            drafts = writeClient::newPumpingTimerDraft,
            starter = writeClient::startPumpingTimer,
            refreshSummary = { summaryDriver?.onWake() },
            completionDrafts = writeClient::newCompletedPumpingDraft,
            completionWriter = writeClient::completePumpingTimer,
            pauser = writeClient::pausePumpingTimer,
            resumer = writeClient::resumePumpingTimer,
            timerReader = writeClient::loadOwnedPumpingTimer,
            dispatch = { work -> executor.execute { work() } },
            onUnauthorized = ::handleUnauthorized,
            onStateChanged = { mutablePumpingState.value = it },
        )
        tummyTimeCoordinator = TummyTimeTimerCoordinator(
            drafts = writeClient::newTummyTimeTimerDraft,
            starter = writeClient::startTummyTimeTimer,
            refreshSummary = { summaryDriver?.onWake() },
            completionDrafts = writeClient::newCompletedTummyTimeDraft,
            completionWriter = writeClient::completeTummyTimeTimer,
            pauser = writeClient::pauseTummyTimeTimer,
            resumer = writeClient::resumeTummyTimeTimer,
            timerReader = writeClient::loadOwnedTummyTimeTimer,
            dispatch = { work -> executor.execute { work() } },
            onUnauthorized = ::handleUnauthorized,
            onStateChanged = { mutableTummyTimeState.value = it },
        )
        bottleCoordinator = BottleLogCoordinator(
            drafts = writeClient::newBottleFeedingDraft,
            writer = writeClient::writeBottleFeeding,
            refreshSummary = { summaryDriver?.onWake() },
            dispatch = { work -> executor.execute { work() } },
            onUnauthorized = ::handleUnauthorized,
            onStateChanged = { mutableBottleState.value = it },
        )
        mutableState.value = requireNotNull(coordinator).state
        loadLatest(applicationContext)
    }

    @Synchronized
    fun accept(json: String) {
        val target = coordinator ?: return
        val envelope = try {
            WearSessionEnvelopeCodec.decode(json)
        } catch (_: Exception) {
            return
        }
        summaryDriver?.prepareForSessionChange(target.currentSession(), envelope)
        val sessionScopeChanged = target.currentSession()?.let { current ->
            envelope !is WearSessionEnvelope.Active || current.phoneEpoch != envelope.phoneEpoch ||
                current.account.id != envelope.account.id
        } ?: true
        if (sessionScopeChanged) {
            diaperCoordinator?.reset()
            feedingCoordinator?.reset()
            sleepCoordinator?.reset()
            pumpingCoordinator?.reset()
            tummyTimeCoordinator?.reset()
            bottleCoordinator?.reset()
        }
        target.accept(envelope)
        mutableState.value = target.state
        if (envelope is WearSessionEnvelope.Active) {
            executor.execute { summaryDriver?.onOpen() }
        } else {
            mutableTodayState.value = TodaySummaryUiState.Unavailable
        }
    }

    fun onWake() {
        executor.execute { summaryDriver?.onWake() }
    }

    fun retry() {
        executor.execute { summaryDriver?.retry() }
    }

    fun selectBaby(babyId: String) {
        executor.execute {
            if (summaryDriver?.selectBaby(babyId) == TodayRefreshResult.Success) {
                selectionStore?.edit()?.putString(SELECTED_BABY_KEY, babyId)?.apply()
            }
        }
    }

    fun logDiaper(type: DiaperType, stoolColor: StoolColor?) {
        val session = selectedSession() ?: return
        diaperCoordinator?.submit(session, type, stoolColor)
    }

    fun retryDiaper() {
        val session = selectedSession() ?: return
        diaperCoordinator?.retry(session)
    }

    fun resetDiaper() {
        diaperCoordinator?.reset()
    }

    fun startFeeding(side: BreastSide) {
        selectedSession()?.let { feedingCoordinator?.start(it, side) }
    }

    fun pauseFeeding() {
        selectedSession()?.let { feedingCoordinator?.pause(it) }
    }

    fun resumeFeeding() {
        selectedSession()?.let { feedingCoordinator?.resume(it) }
    }

    fun switchFeedingSide() {
        selectedSession()?.let { feedingCoordinator?.switchSide(it) }
    }

    fun stopFeeding() {
        selectedSession()?.let { feedingCoordinator?.stop(it) }
    }

    fun retryFeeding() {
        selectedSession()?.let { feedingCoordinator?.retry(it) }
    }

    fun startSleep() {
        selectedSession()?.let { sleepCoordinator?.start(it) }
    }

    fun pauseSleep() {
        selectedSession()?.let { sleepCoordinator?.pause(it) }
    }

    fun resumeSleep() {
        selectedSession()?.let { sleepCoordinator?.resume(it) }
    }

    fun stopSleep() {
        selectedSession()?.let { sleepCoordinator?.stop(it) }
    }

    fun retrySleep() {
        selectedSession()?.let { sleepCoordinator?.retry(it) }
    }

    fun startPumping(side: BreastSide) {
        selectedSession()?.let { pumpingCoordinator?.start(it, side) }
    }

    fun pausePumping() {
        selectedSession()?.let { pumpingCoordinator?.pause(it) }
    }

    fun resumePumping() {
        selectedSession()?.let { pumpingCoordinator?.resume(it) }
    }

    fun stopPumping(selection: PumpingVolumeSelection) {
        selectedSession()?.let { pumpingCoordinator?.stop(it, selection) }
    }

    fun retryPumping() {
        selectedSession()?.let { pumpingCoordinator?.retry(it) }
    }

    fun startTummyTime() {
        selectedSession()?.let { tummyTimeCoordinator?.start(it) }
    }

    fun pauseTummyTime() {
        selectedSession()?.let { tummyTimeCoordinator?.pause(it) }
    }

    fun resumeTummyTime() {
        selectedSession()?.let { tummyTimeCoordinator?.resume(it) }
    }

    fun stopTummyTime() {
        selectedSession()?.let { tummyTimeCoordinator?.stop(it) }
    }

    fun retryTummyTime() {
        selectedSession()?.let { tummyTimeCoordinator?.retry(it) }
    }

    fun logBottle(selection: BottleLogSelection) {
        selectedSession()?.let { bottleCoordinator?.submit(it, selection) }
    }

    fun retryBottle() {
        selectedSession()?.let { bottleCoordinator?.retry(it) }
    }

    private fun loadLatest(context: Context) {
        Wearable.getDataClient(context).dataItems.addOnSuccessListener { items ->
            try {
                items
                    .filter { it.uri.path == STATE_PATH }
                    .maxByOrNull { DataMapItem.fromDataItem(it).dataMap.getLong("revision", -1) }
                    ?.let { item ->
                        DataMapItem.fromDataItem(item).dataMap.getString("json")?.let(::accept)
                    }
            } finally {
                items.release()
            }
        }
    }

    private fun usableSession(): WearSessionEnvelope.Active? {
        val target = coordinator ?: return null
        val session = target.currentSession() ?: return null
        val token = target.accessToken(System.currentTimeMillis() / 1_000)
        mutableState.value = target.state
        return token?.let { session.copy(accessToken = it) }
    }

    private fun selectedSession(): WearSessionEnvelope.Active? {
        val session = usableSession() ?: return null
        val selected = when (val state = mutableTodayState.value) {
            is TodaySummaryUiState.Loading -> state.selectedBaby
            is TodaySummaryUiState.Content -> state.selectedBaby
            is TodaySummaryUiState.Empty -> state.selectedBaby
            is TodaySummaryUiState.Stale -> state.selectedBaby
            is TodaySummaryUiState.Error -> state.selectedBaby
            TodaySummaryUiState.Unavailable -> null
        } ?: return session
        return session.copy(baby = WearSessionEnvelope.Baby(selected.id, selected.name, selected.timezone))
    }

    private fun acceptTodayState(state: TodaySummaryUiState) {
        mutableTodayState.value = state
        val snapshot = when (state) {
            is TodaySummaryUiState.Content -> state.snapshot
            is TodaySummaryUiState.Empty -> state.snapshot
            is TodaySummaryUiState.Stale -> state.snapshot
            else -> null
        } ?: return
        val session = selectedSession() ?: return
        feedingCoordinator?.restoreSnapshot(
            session,
            snapshot.activeTimers.firstOrNull { it.type == "feeding" },
        )
        sleepCoordinator?.restoreSnapshot(
            session,
            snapshot.activeTimers.firstOrNull { it.type == "sleep" },
        )
        pumpingCoordinator?.restoreSnapshot(
            session,
            snapshot.activeTimers.firstOrNull { it.type == "pumping" },
        )
        tummyTimeCoordinator?.restoreSnapshot(
            session,
            snapshot.activeTimers.firstOrNull { it.type == "tummyTime" },
        )
    }

    private fun handleUnauthorized(revision: Long) {
        coordinator?.onUnauthorized(revision)
        mutableState.value = coordinator?.state ?: WearSessionUiState.SignedOut
    }

    private const val STATE_PATH = "/sofi/wear/auth/state"
    private const val REFRESH_PATH = "/sofi/wear/auth/refresh-request"
    private const val SELECTION_STORE = "wear-today-summary"
    private const val WRITE_STORE = "wear-write-state"
    private const val SELECTED_BABY_KEY = "selected-baby-id"
}
