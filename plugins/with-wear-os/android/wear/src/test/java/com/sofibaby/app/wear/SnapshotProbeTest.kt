package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

class SnapshotProbeTest {
    @Test
    fun sendsTheSelectedBabySnapshotRpcWithTheAccessToken() {
        var captured: WearHttpRequest? = null
        val fixture = JSONObject(requireNotNull(javaClass.getResource("/activity-snapshot.json")).readText())
            .put("babyId", "baby-1")
            .put("babyName", "Sofi")
            .toString()
        val probe = SnapshotProbe { request ->
            captured = request
            WearHttpResponse(200, fixture)
        }

        val outcome = probe.run(active())

        assertEquals("baby-1", (outcome as SnapshotOutcome.Success).snapshot.babyId)
        val request = requireNotNull(captured)
        assertEquals("https://project.supabase.co/rest/v1/rpc/get_baby_activity_snapshot", request.url)
        assertEquals("POST", request.method)
        assertEquals("Bearer access-token", request.headers["Authorization"])
        assertEquals("anon-key", request.headers["apikey"])
        assertTrue(request.body.contains("\"p_baby_id\":\"baby-1\""))
        assertTrue(request.body.contains("\"p_timezone\":\"Europe/Belgrade\""))
    }

    @Test
    fun reportsUnauthorizedWithoutRetrying() {
        var attempts = 0
        val probe = SnapshotProbe {
            attempts += 1
            WearHttpResponse(401, "provider body must not be surfaced")
        }

        assertEquals(SnapshotOutcome.Unauthorized, probe.run(active()))
        assertEquals(1, attempts)
    }

    @Test
    fun reportsMalformedSuccessfulPayloadAsFailed() {
        val probe = SnapshotProbe { WearHttpResponse(200, "{}") }

        assertEquals(SnapshotOutcome.Failed, probe.run(active()))
    }

    private fun active() = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = 3,
        account = WearSessionEnvelope.Account("user-1", "Alex"),
        baby = WearSessionEnvelope.Baby("baby-1", "Sofi", "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = 2_000_000_000,
    )
}
