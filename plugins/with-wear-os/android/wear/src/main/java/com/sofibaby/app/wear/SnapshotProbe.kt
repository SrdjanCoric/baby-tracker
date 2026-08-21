package com.sofibaby.app.wear

import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import org.json.JSONObject

data class WearHttpRequest(
    val url: String,
    val method: String,
    val headers: Map<String, String>,
    val body: String,
)

data class WearHttpResponse(
    val status: Int,
    val body: String,
)

fun interface WearHttpTransport {
    fun execute(request: WearHttpRequest): WearHttpResponse
}

enum class SnapshotOutcome {
    Success,
    Unauthorized,
    Offline,
    Failed,
}

class SnapshotProbe(
    private val transport: WearHttpTransport,
) {
    fun run(session: WearSessionEnvelope.Active): SnapshotOutcome {
        val request = WearHttpRequest(
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/rpc/get_baby_activity_snapshot",
            method = "POST",
            headers = mapOf(
                "Content-Type" to "application/json",
                "apikey" to session.supabase.anonKey,
                "Authorization" to "Bearer ${session.accessToken}",
            ),
            body = JSONObject()
                .put("p_baby_id", session.baby.id)
                .put("p_timezone", session.baby.timezone)
                .toString(),
        )
        return try {
            when (transport.execute(request).status) {
                in 200..299 -> SnapshotOutcome.Success
                401 -> SnapshotOutcome.Unauthorized
                else -> SnapshotOutcome.Failed
            }
        } catch (_: Exception) {
            SnapshotOutcome.Offline
        }
    }
}

object UrlConnectionWearHttpTransport : WearHttpTransport {
    override fun execute(request: WearHttpRequest): WearHttpResponse {
        val connection = URL(request.url).openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = request.method
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.doOutput = true
            request.headers.forEach(connection::setRequestProperty)
            connection.outputStream.use { output ->
                output.write(request.body.toByteArray(StandardCharsets.UTF_8))
            }
            val status = connection.responseCode
            val body = if (status in 200..299) {
                connection.inputStream.bufferedReader().use { it.readText() }
            } else {
                ""
            }
            WearHttpResponse(status, body)
        } finally {
            connection.disconnect()
        }
    }
}
