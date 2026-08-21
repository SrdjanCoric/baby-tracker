package com.sofibaby.app.wear

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.io.FileNotFoundException
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

interface SessionBlobStore {
    fun read(): ByteArray?

    fun write(bytes: ByteArray)

    fun delete()
}

class NoBackupSessionBlobStore(context: Context) : SessionBlobStore {
    private val file = AtomicFile(File(context.noBackupFilesDir, "wear-session.enc"))

    override fun read(): ByteArray? = try {
        file.readFully()
    } catch (_: FileNotFoundException) {
        null
    }

    override fun write(bytes: ByteArray) {
        val output = file.startWrite()
        try {
            output.write(bytes)
            file.finishWrite(output)
        } catch (error: Exception) {
            file.failWrite(output)
            throw error
        }
    }

    override fun delete() = file.delete()
}

class AndroidKeystoreSessionKeyProvider(
    private val alias: String = "sofi-wear-session-v1",
) : SessionKeyProvider {
    override fun getOrCreate(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).run {
            init(
                KeyGenParameterSpec.Builder(
                    alias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
    }
}

fun interface SessionKeyProvider {
    fun getOrCreate(): SecretKey
}

class AesGcmSessionCipher(
    private val keyProvider: SessionKeyProvider,
) {
    fun encrypt(plaintext: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, keyProvider.getOrCreate())
        val nonce = requireNotNull(cipher.iv).also {
            require(it.size == NONCE_SIZE) { "Unexpected AES-GCM nonce size" }
        }
        cipher.updateAAD(AAD)
        val ciphertext = cipher.doFinal(plaintext)
        return ByteBuffer.allocate(1 + nonce.size + ciphertext.size)
            .put(FORMAT_VERSION)
            .put(nonce)
            .put(ciphertext)
            .array()
    }

    fun decrypt(blob: ByteArray): ByteArray {
        require(blob.size > 1 + NONCE_SIZE) { "Invalid encrypted session" }
        val buffer = ByteBuffer.wrap(blob)
        require(buffer.get() == FORMAT_VERSION) { "Unsupported encrypted-session format" }
        val nonce = ByteArray(NONCE_SIZE).also(buffer::get)
        val ciphertext = ByteArray(buffer.remaining()).also(buffer::get)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, keyProvider.getOrCreate(), GCMParameterSpec(TAG_BITS, nonce))
        cipher.updateAAD(AAD)
        return cipher.doFinal(ciphertext)
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val NONCE_SIZE = 12
        const val TAG_BITS = 128
        const val FORMAT_VERSION: Byte = 1
        val AAD = "com.sofibaby.app.wear.session.v1".toByteArray(StandardCharsets.UTF_8)
    }
}

class EncryptedSessionVault(
    private val store: SessionBlobStore,
    private val cipher: AesGcmSessionCipher,
) {
    fun apply(envelope: WearSessionEnvelope): Boolean {
        val current = readEnvelope()
        if (
            current != null &&
            envelope.phoneEpoch == current.phoneEpoch &&
            envelope.revision <= current.revision
        ) {
            return false
        }
        val plaintext = WearSessionEnvelopeCodec.encode(envelope).toByteArray(StandardCharsets.UTF_8)
        store.write(cipher.encrypt(plaintext))
        return true
    }

    fun readActive(): WearSessionEnvelope.Active? =
        readEnvelope() as? WearSessionEnvelope.Active

    private fun readEnvelope(): WearSessionEnvelope? {
        return try {
            val blob = store.read() ?: return null
            val plaintext = cipher.decrypt(blob)
            WearSessionEnvelopeCodec.decode(String(plaintext, StandardCharsets.UTF_8))
        } catch (_: Exception) {
            runCatching(store::delete)
            null
        }
    }
}
