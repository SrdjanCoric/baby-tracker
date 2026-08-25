package com.sofibaby.app.wear

import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import org.json.JSONArray
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

sealed interface SnapshotOutcome {
    data class Success(val snapshot: ActivitySnapshot) : SnapshotOutcome
    data object Unauthorized : SnapshotOutcome
    data object Offline : SnapshotOutcome
    data object Failed : SnapshotOutcome
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
        val response = try {
            transport.execute(request)
        } catch (_: Exception) {
            return SnapshotOutcome.Offline
        }
        return when (response.status) {
            in 200..299 -> try {
                val snapshot = ActivitySnapshotCodec.decode(response.body)
                if (snapshot.babyId == session.baby.id) {
                    SnapshotOutcome.Success(snapshot)
                } else {
                    SnapshotOutcome.Failed
                }
            } catch (_: Exception) {
                SnapshotOutcome.Failed
            }
            401 -> SnapshotOutcome.Unauthorized
            else -> SnapshotOutcome.Failed
        }
    }
}

data class BabyIdentity(val id: String, val name: String, val timezone: String)

sealed interface BabyDirectoryOutcome {
    data class Success(val babies: List<BabyIdentity>) : BabyDirectoryOutcome
    data object Unauthorized : BabyDirectoryOutcome
    data object Offline : BabyDirectoryOutcome
    data object Failed : BabyDirectoryOutcome
}

class BabyDirectoryClient(
    private val transport: WearHttpTransport,
) {
    fun load(session: WearSessionEnvelope.Active): BabyDirectoryOutcome {
        val request = WearHttpRequest(
            url = "${session.supabase.url.trimEnd('/')}/rest/v1/babies?select=id,name&deleted=eq.false&order=created_at.asc",
            method = "GET",
            headers = mapOf(
                "apikey" to session.supabase.anonKey,
                "Authorization" to "Bearer ${session.accessToken}",
            ),
            body = "",
        )
        val response = try {
            transport.execute(request)
        } catch (_: Exception) {
            return BabyDirectoryOutcome.Offline
        }
        return when (response.status) {
            in 200..299 -> try {
                    val rows = JSONArray(response.body)
                    BabyDirectoryOutcome.Success(
                        (0 until rows.length()).map { index ->
                            val row = rows.getJSONObject(index)
                            BabyIdentity(
                                id = row.getString("id"),
                                name = row.getString("name"),
                                timezone = session.baby.timezone,
                            )
                        },
                    )
            } catch (_: Exception) {
                BabyDirectoryOutcome.Failed
            }
            401 -> BabyDirectoryOutcome.Unauthorized
            else -> BabyDirectoryOutcome.Failed
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
            connection.doOutput = request.body.isNotEmpty()
            request.headers.forEach(connection::setRequestProperty)
            if (request.body.isNotEmpty()) {
                connection.outputStream.use { output ->
                    output.write(request.body.toByteArray(StandardCharsets.UTF_8))
                }
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
