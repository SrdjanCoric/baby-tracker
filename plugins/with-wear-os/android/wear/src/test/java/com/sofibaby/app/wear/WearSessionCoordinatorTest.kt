package com.sofibaby.app.wear

import java.io.IOException
import javax.crypto.KeyGenerator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WearSessionCoordinatorTest {
    @Test
    fun rejectedCredentialRequestsOnePhoneRefreshAndDoesNotRetrySilently() {
        val requests = mutableListOf<Long>()
        val coordinator = coordinator(requests)
        coordinator.accept(active(revision = 4, expiresAt = 2_000))

        assertEquals("access-token", coordinator.accessToken(nowEpochSeconds = 1_000))

        coordinator.onUnauthorized(4)
        coordinator.onUnauthorized(4)

        assertEquals(listOf(4L), requests)
        assertEquals(WearSessionUiState.ReconnectFromPhone, coordinator.state)
        assertNull(coordinator.accessToken(nowEpochSeconds = 1_000))
    }

    @Test
    fun staleCredentialRequestsRefreshWithoutExposingItsToken() {
        val requests = mutableListOf<Long>()
        val coordinator = coordinator(requests)
        coordinator.accept(active(revision = 7, expiresAt = 1_100))

        assertNull(coordinator.accessToken(nowEpochSeconds = 1_000))
        assertEquals(listOf(7L), requests)
        assertEquals(WearSessionUiState.ReconnectFromPhone, coordinator.state)
    }

    @Test
    fun newerPhoneEnvelopeRecoversFromReconnectAndInvalidationSignsOut() {
        val requests = mutableListOf<Long>()
        val coordinator = coordinator(requests)
        coordinator.accept(active(revision = 4, expiresAt = 2_000))
        coordinator.onUnauthorized(4)

        coordinator.accept(active(revision = 5, expiresAt = 3_000))
        assertEquals("access-token", coordinator.accessToken(nowEpochSeconds = 1_000))
        assertEquals("Sofi", (coordinator.state as WearSessionUiState.SignedIn).babyName)

        coordinator.accept(WearSessionEnvelope.Invalidated("phone-install-1", 6, "signed_out"))
        assertEquals(WearSessionUiState.SignedOut, coordinator.state)
        assertNull(coordinator.accessToken(nowEpochSeconds = 1_000))
    }

    @Test
    fun lateUnauthorizedResponseCannotRejectANewerCredential() {
        val requests = mutableListOf<Long>()
        val coordinator = coordinator(requests)
        coordinator.accept(active(revision = 4, expiresAt = 2_000))
        coordinator.accept(active(revision = 5, expiresAt = 3_000))

        coordinator.onUnauthorized(4)

        assertEquals(emptyList<Long>(), requests)
        assertEquals("access-token", coordinator.accessToken(nowEpochSeconds = 1_000))
        assertEquals("Sofi", (coordinator.state as WearSessionUiState.SignedIn).babyName)
    }

    @Test
    fun failedSessionWriteDegradesToSignedOutWithoutThrowing() {
        val store = object : SessionBlobStore {
            override fun read(): ByteArray? = null

            override fun write(bytes: ByteArray) = throw IOException("disk full")

            override fun delete() = Unit
        }
        val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        val coordinator = WearSessionCoordinator(
            vault = EncryptedSessionVault(store, AesGcmSessionCipher { key }),
            refreshRequests = WearRefreshRequestPublisher { },
        )

        coordinator.accept(active(revision = 4, expiresAt = 2_000))

        assertEquals(WearSessionUiState.SignedOut, coordinator.state)
        assertNull(coordinator.accessToken(nowEpochSeconds = 1_000))
    }

    private fun coordinator(requests: MutableList<Long>): WearSessionCoordinator {
        var stored: ByteArray? = null
        val store = object : SessionBlobStore {
            override fun read(): ByteArray? = stored
            override fun write(bytes: ByteArray) { stored = bytes.copyOf() }
            override fun delete() { stored = null }
        }
        val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        return WearSessionCoordinator(
            vault = EncryptedSessionVault(store, AesGcmSessionCipher { key }),
            refreshRequests = WearRefreshRequestPublisher(requests::add),
        )
    }

    private fun active(revision: Long, expiresAt: Long) = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = revision,
        account = WearSessionEnvelope.Account("user-1", "Alex"),
        baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = expiresAt,
    )
}
