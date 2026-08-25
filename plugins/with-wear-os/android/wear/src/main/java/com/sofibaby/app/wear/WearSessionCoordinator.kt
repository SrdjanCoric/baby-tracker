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
    private var unauthorizedRefreshRequests = 0

    @Volatile
    var state: WearSessionUiState = active?.toUiState() ?: WearSessionUiState.SignedOut
        private set

    @Synchronized
    fun accept(envelope: WearSessionEnvelope) {
        val applied = try {
            vault.apply(envelope)
        } catch (_: Exception) {
            active = null
            refreshRequestedForRevision = null
            state = WearSessionUiState.SignedOut
            return
        }
        if (!applied) return
        when (envelope) {
            is WearSessionEnvelope.Active -> {
                val startsNewSession = active?.let {
                    it.phoneEpoch != envelope.phoneEpoch ||
                        it.account.id != envelope.account.id
                } ?: true
                active = envelope
                refreshRequestedForRevision = null
                if (startsNewSession) unauthorizedRefreshRequests = 0
                state = envelope.toUiState()
            }
            is WearSessionEnvelope.Invalidated -> {
                active = null
                refreshRequestedForRevision = null
                unauthorizedRefreshRequests = 0
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
        state = WearSessionUiState.ReconnectFromPhone
        if (unauthorizedRefreshRequests >= MAX_UNAUTHORIZED_REFRESH_REQUESTS) return
        unauthorizedRefreshRequests += 1
        requestRefresh(revision)
    }

    @Synchronized
    fun onProbeSucceeded(requestRevision: Long) {
        if (active?.revision != requestRevision) return
        unauthorizedRefreshRequests = 0
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

    private companion object {
        const val MAX_UNAUTHORIZED_REFRESH_REQUESTS = 1
    }
}
