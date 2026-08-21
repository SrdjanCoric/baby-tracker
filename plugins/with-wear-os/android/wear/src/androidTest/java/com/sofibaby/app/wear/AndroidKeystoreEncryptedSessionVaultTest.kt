package com.sofibaby.app.wear

import java.security.KeyStore
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

@RunWith(AndroidJUnit4::class)
class AndroidKeystoreEncryptedSessionVaultTest {
    private val alias = "sofi-wear-session-test-${System.nanoTime()}"

    @After
    fun deleteKey() {
        KeyStore.getInstance("AndroidKeyStore").apply {
            load(null)
            deleteEntry(alias)
        }
    }

    @Test
    fun encryptsAndReadsSessionWithAndroidKeystoreKey() {
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
        val vault = EncryptedSessionVault(
            store = store,
            cipher = AesGcmSessionCipher(AndroidKeystoreSessionKeyProvider(alias)),
        )
        val envelope = WearSessionEnvelope.Active(
            phoneEpoch = "phone-install-1",
            revision = 9,
            account = WearSessionEnvelope.Account("user-1", "Alex"),
            baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
            supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
            accessToken = "sentinel-access-token",
            expiresAt = 1_800_000_000,
        )

        assertTrue(vault.apply(envelope))
        assertEquals(envelope, vault.readActive())
    }
}
