package com.sofibaby.app.wear

fun interface WearRefreshRequestPublisher {
    fun publish(revision: Long)
}

sealed interface WearSessionUiState {
    data object SignedOut : WearSessionUiState

    data object ReconnectFromPhone : WearSessionUiState

    data class SignedIn(
        val accountLabel: String,
        val babyName: String,
    ) : WearSessionUiState
}

class WearSessionCoordinator(
    private val vault: EncryptedSessionVault,
    private val refreshRequests: WearRefreshRequestPublisher,
    private val refreshWindowSeconds: Long = 5 * 60,
) {
    private var active = vault.readActive()
    private var refreshRequestedForRevision: Long? = null

    @Volatile
    var state: WearSessionUiState = active?.toUiState() ?: WearSessionUiState.SignedOut
        private set

    @Synchronized
    fun accept(envelope: WearSessionEnvelope) {
        if (!vault.apply(envelope)) return
        when (envelope) {
            is WearSessionEnvelope.Active -> {
                active = envelope
                refreshRequestedForRevision = null
                state = envelope.toUiState()
            }
            is WearSessionEnvelope.Invalidated -> {
                active = null
                refreshRequestedForRevision = null
                state = WearSessionUiState.SignedOut
            }
        }
    }

    @Synchronized
    fun accessToken(nowEpochSeconds: Long): String? {
        val session = active ?: return null
        if (state == WearSessionUiState.ReconnectFromPhone) return null
        if (session.expiresAt <= nowEpochSeconds + refreshWindowSeconds) {
            requestRefresh(session.revision)
            return null
        }
        return session.accessToken
    }

    @Synchronized
    fun onUnauthorized(requestRevision: Long) {
        val revision = active?.revision ?: return
        if (requestRevision != revision) return
        requestRefresh(revision)
    }

    @Synchronized
    fun currentSession(): WearSessionEnvelope.Active? = active

    private fun requestRefresh(revision: Long) {
        state = WearSessionUiState.ReconnectFromPhone
        if (refreshRequestedForRevision == revision) return
        refreshRequestedForRevision = revision
        refreshRequests.publish(revision)
    }

    private fun WearSessionEnvelope.Active.toUiState() = WearSessionUiState.SignedIn(
        accountLabel = account.label,
        babyName = baby.name,
    )
}
