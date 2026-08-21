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
    private val executor = Executors.newSingleThreadExecutor()
    private var coordinator: WearSessionCoordinator? = null
    private var summaryDriver: TodaySummaryRefreshDriver? = null
    private var selectionStore: android.content.SharedPreferences? = null

    val state: State<WearSessionUiState> = mutableState
    val todayState: State<TodaySummaryUiState> = mutableTodayState

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
        val summaryCoordinator = TodaySummaryCoordinator(
            babyDirectory = { BabyDirectoryClient(UrlConnectionWearHttpTransport).load(it) },
            snapshots = { SnapshotProbe(UrlConnectionWearHttpTransport).run(it) },
            preferredBabyId = selectionStore?.getString(SELECTED_BABY_KEY, null),
            onStateChanged = { mutableTodayState.value = it },
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

    private const val STATE_PATH = "/sofi/wear/auth/state"
    private const val REFRESH_PATH = "/sofi/wear/auth/refresh-request"
    private const val SELECTION_STORE = "wear-today-summary"
    private const val SELECTED_BABY_KEY = "selected-baby-id"
}
