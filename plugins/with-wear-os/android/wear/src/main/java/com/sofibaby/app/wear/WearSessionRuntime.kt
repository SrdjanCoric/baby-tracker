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
    private val executor = Executors.newSingleThreadExecutor()
    private var coordinator: WearSessionCoordinator? = null

    val state: State<WearSessionUiState> = mutableState

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
        mutableState.value = requireNotNull(coordinator).state
        loadLatest(applicationContext)
        probeIfUsable()
    }

    @Synchronized
    fun accept(json: String) {
        val target = coordinator ?: return
        val envelope = try {
            WearSessionEnvelopeCodec.decode(json)
        } catch (_: Exception) {
            return
        }
        target.accept(envelope)
        mutableState.value = target.state
        if (envelope is WearSessionEnvelope.Active) probeIfUsable()
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

    private fun probeIfUsable() {
        val target = coordinator ?: return
        val session = target.currentSession() ?: return
        val token = target.accessToken(System.currentTimeMillis() / 1_000)
        mutableState.value = target.state
        if (token == null) return
        executor.execute {
            when (SnapshotProbe(UrlConnectionWearHttpTransport).run(session)) {
                SnapshotOutcome.Success -> target.onProbeSucceeded(session.revision)
                SnapshotOutcome.Unauthorized -> target.onUnauthorized(session.revision)
                SnapshotOutcome.Offline,
                SnapshotOutcome.Failed -> Unit
            }
            mutableState.value = target.state
        }
    }

    private const val STATE_PATH = "/sofi/wear/auth/state"
    private const val REFRESH_PATH = "/sofi/wear/auth/refresh-request"
}
