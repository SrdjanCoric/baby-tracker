package com.sofibaby.app.wear

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DiaperWriteClientTest {
    @Test
    fun hlcMatchesPhoneMillisecondWidthAndCarriesCounterOverflow() {
        val store = InMemoryWearClockStore(
            deviceId = "wear-test-device",
            state = WearClockState(1_000L, 9_999),
        )

        val clock = WearHybridLogicalClock(store) { 1_000L }

        assertEquals("1970-01-01T00:00:01.001Z-0000-wear-test-device", clock.issue())
    }

    @Test
    fun dirtyDraftMatchesPhoneRowShapeAndSendsAuthenticatedIdempotentMerge() {
        var captured: WearHttpRequest? = null
        val clockStore = InMemoryWearClockStore("wear-test-device")
        val client = SupabaseWriteClient(
            transport = {
                captured = it
                WearHttpResponse(200, "{}")
            },
            ids = { "11111111-1111-4111-8111-111111111111" },
            wallClockMillis = { 1_787_386_530_123L },
            clockStore = clockStore,
        )

        val result = client.logDiaper(active(), DiaperType.Dirty, StoolColor.Green)

        assertTrue(result is WriteOutcome.Success)
        val request = requireNotNull(captured)
        assertEquals("https://project.supabase.co/rest/v1/rpc/merge_record", request.url)
        assertEquals("POST", request.method)
        assertEquals("Bearer access-token", request.headers["Authorization"])
        assertEquals("anon-key", request.headers["apikey"])
        assertEquals("application/json", request.headers["Content-Type"])
        val rpc = JSONObject(request.body)
        assertEquals("diapers", rpc.getString("p_table"))
        assertEquals("33333333-3333-4333-8333-333333333333", rpc.getString("p_expected_user_id"))
        assertEquals("wear-diaper:11111111-1111-4111-8111-111111111111", rpc.getString("p_operation_id"))

        val phoneFixture = JSONObject(requireNotNull(javaClass.getResource("/phone-diaper-row.json")).readText())
        val actualRow = rpc.getJSONObject("p_record")
            .put("field_clocks", rpc.getJSONObject("p_field_clocks"))
        assertEquals(phoneFixture.toString(), actualRow.toString())
    }

    @Test
    fun wetDraftOmitsPhoneOptionalFieldsRatherThanWritingNulls() {
        var body = ""
        val client = client { request ->
            body = request.body
            WearHttpResponse(200, "{}")
        }

        client.logDiaper(active(), DiaperType.Wet, null)

        val record = JSONObject(body).getJSONObject("p_record")
        assertFalse(record.has("stool_color"))
        assertFalse(record.has("notes"))
    }

    private fun client(transport: WearHttpTransport) = SupabaseWriteClient(
        transport = transport,
        ids = { "11111111-1111-4111-8111-111111111111" },
        wallClockMillis = { 1_787_386_530_123L },
        clockStore = InMemoryWearClockStore("wear-test-device"),
    )

    private fun active() = WearSessionEnvelope.Active(
        phoneEpoch = "phone-install-1",
        revision = 3,
        account = WearSessionEnvelope.Account("33333333-3333-4333-8333-333333333333", "Alex"),
        baby = WearSessionEnvelope.Baby("22222222-2222-4222-8222-222222222222", "Sofi", "Europe/Belgrade"),
        supabase = WearSessionEnvelope.Supabase("https://project.supabase.co", "anon-key"),
        accessToken = "access-token",
        expiresAt = 2_000_000_000,
    )
}
