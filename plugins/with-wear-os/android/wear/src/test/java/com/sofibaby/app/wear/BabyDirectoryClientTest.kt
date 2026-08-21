package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class BabyDirectoryClientTest {
    @Test
    fun loadsRlsScopedBabyIdentitiesWithTheSessionTimezone() {
        var captured: WearHttpRequest? = null
        val client = BabyDirectoryClient { request ->
            captured = request
            WearHttpResponse(200, """[{"id":"baby-1","name":"Sofi"},{"id":"baby-2","name":"Leo"}]""")
        }

        val result = client.load(active())

        assertEquals(
            BabyDirectoryOutcome.Success(
                listOf(
                    BabyIdentity("baby-1", "Sofi", "Europe/Belgrade"),
                    BabyIdentity("baby-2", "Leo", "Europe/Belgrade"),
                ),
            ),
            result,
        )
        val request = requireNotNull(captured)
        assertEquals(
            "https://project.supabase.co/rest/v1/babies?select=id,name&deleted=eq.false&order=created_at.asc",
            request.url,
        )
        assertEquals("GET", request.method)
        assertEquals("Bearer access-token", request.headers["Authorization"])
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
