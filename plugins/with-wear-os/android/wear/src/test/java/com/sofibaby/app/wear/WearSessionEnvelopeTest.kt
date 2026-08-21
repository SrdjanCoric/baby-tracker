package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class WearSessionEnvelopeTest {
    @Test
    fun activeEnvelopeRoundTripsWithoutARefreshToken() {
        val json = """
            {
              "version": 1,
              "phoneEpoch": "phone-install-1",
              "revision": 41,
              "disposition": "active",
              "account": {"id": "user-1", "label": "Alex"},
              "baby": {"id": "baby-1", "name": "Sofi", "timezone": "Europe/Belgrade"},
              "supabase": {"url": "https://project.supabase.co", "anonKey": "anon-key"},
              "accessToken": "access-token",
              "expiresAt": 1800000000
            }
        """.trimIndent()

        val decoded = WearSessionEnvelopeCodec.decode(json) as WearSessionEnvelope.Active

        assertEquals("phone-install-1", decoded.phoneEpoch)
        assertEquals(41L, decoded.revision)
        assertEquals("Alex", decoded.account.label)
        assertEquals("Sofi", decoded.baby.name)
        assertEquals("access-token", decoded.accessToken)
        assertEquals(decoded, WearSessionEnvelopeCodec.decode(WearSessionEnvelopeCodec.encode(decoded)))
        assertFalse(WearSessionEnvelopeCodec.encode(decoded).contains("refresh", ignoreCase = true))
    }
}
