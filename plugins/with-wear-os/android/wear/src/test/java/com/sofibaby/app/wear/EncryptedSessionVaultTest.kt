package com.sofibaby.app.wear

import java.nio.charset.StandardCharsets
import javax.crypto.KeyGenerator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EncryptedSessionVaultTest {
    @Test
    fun activeSessionIsEncryptedAtRestAndReadableThroughTheVault() {
        var stored: ByteArray? = null
        val store = object : SessionBlobStore {
            override fun read(): ByteArray? = stored

            override fun write(bytes: ByteArray) {
                stored = bytes.copyOf()
            }

            override fun delete() {
                stored = null
            }
        }
        val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        val vault = EncryptedSessionVault(
            store = store,
            cipher = AesGcmSessionCipher { key },
        )
        val envelope = WearSessionEnvelope.Active(
            revision = 9,
            account = WearSessionEnvelope.Account("user-1", "Alex"),
            baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
            supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
            accessToken = "sentinel-access-token",
            expiresAt = 1_800_000_000,
        )

        assertTrue(vault.apply(envelope))

        val bytesAtRest = requireNotNull(stored)
        assertFalse(String(bytesAtRest, StandardCharsets.UTF_8).contains("sentinel-access-token"))
        assertEquals(envelope, vault.readActive())
    }

    @Test
    fun invalidationIsDurableAndAnOlderActiveEnvelopeCannotReplay() {
        var stored: ByteArray? = null
        val store = object : SessionBlobStore {
            override fun read(): ByteArray? = stored

            override fun write(bytes: ByteArray) {
                stored = bytes.copyOf()
            }

            override fun delete() {
                stored = null
            }
        }
        val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        val vault = EncryptedSessionVault(store, AesGcmSessionCipher { key })
        val active = WearSessionEnvelope.Active(
            revision = 9,
            account = WearSessionEnvelope.Account("user-1", "Alex"),
            baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
            supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
            accessToken = "access-token",
            expiresAt = 1_800_000_000,
        )

        assertTrue(vault.apply(active))
        assertTrue(vault.apply(WearSessionEnvelope.Invalidated(10, "signed_out")))
        assertEquals(null, vault.readActive())
        assertFalse(vault.apply(active))
        assertEquals(null, vault.readActive())
    }
}
