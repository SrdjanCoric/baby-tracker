package com.sofibaby.app.wear

import org.json.JSONObject

sealed interface WearSessionEnvelope {
    val revision: Long

    data class Account(val id: String, val label: String)

    data class Baby(
        val id: String,
        val name: String,
        val timezone: String,
    )

    data class Supabase(
        val url: String,
        val anonKey: String,
    )

    data class Active(
        override val revision: Long,
        val account: Account,
        val baby: Baby,
        val supabase: Supabase,
        val accessToken: String,
        val expiresAt: Long,
    ) : WearSessionEnvelope

    data class Invalidated(
        override val revision: Long,
        val reason: String,
    ) : WearSessionEnvelope
}

object WearSessionEnvelopeCodec {
    fun decode(json: String): WearSessionEnvelope {
        val root = JSONObject(json)
        require(root.getInt("version") == 1) { "Unsupported session envelope version" }
        val revision = root.getLong("revision")
        require(revision >= 0) { "Invalid session revision" }
        return when (root.getString("disposition")) {
            "active" -> decodeActive(root, revision)
            "invalidated" -> WearSessionEnvelope.Invalidated(
                revision = revision,
                reason = root.requireString("reason"),
            )
            else -> throw IllegalArgumentException("Unsupported session disposition")
        }
    }

    fun encode(envelope: WearSessionEnvelope): String {
        val root = JSONObject()
            .put("version", 1)
            .put("revision", envelope.revision)
        when (envelope) {
            is WearSessionEnvelope.Active -> root
                .put("disposition", "active")
                .put(
                    "account",
                    JSONObject()
                        .put("id", envelope.account.id)
                        .put("label", envelope.account.label),
                )
                .put(
                    "baby",
                    JSONObject()
                        .put("id", envelope.baby.id)
                        .put("name", envelope.baby.name)
                        .put("timezone", envelope.baby.timezone),
                )
                .put(
                    "supabase",
                    JSONObject()
                        .put("url", envelope.supabase.url)
                        .put("anonKey", envelope.supabase.anonKey),
                )
                .put("accessToken", envelope.accessToken)
                .put("expiresAt", envelope.expiresAt)

            is WearSessionEnvelope.Invalidated -> root
                .put("disposition", "invalidated")
                .put("reason", envelope.reason)
        }
        return root.toString()
    }

    private fun decodeActive(
        root: JSONObject,
        revision: Long,
    ): WearSessionEnvelope.Active {
        val account = root.getJSONObject("account")
        val baby = root.getJSONObject("baby")
        val supabase = root.getJSONObject("supabase")
        val supabaseUrl = supabase.requireString("url")
        require(supabaseUrl.startsWith("https://")) { "Supabase URL must use HTTPS" }
        val expiresAt = root.getLong("expiresAt")
        require(expiresAt > 0) { "Invalid access-token expiry" }
        return WearSessionEnvelope.Active(
            revision = revision,
            account = WearSessionEnvelope.Account(
                id = account.requireString("id"),
                label = account.requireString("label"),
            ),
            baby = WearSessionEnvelope.Baby(
                id = baby.requireString("id"),
                name = baby.requireString("name"),
                timezone = baby.requireString("timezone"),
            ),
            supabase = WearSessionEnvelope.Supabase(
                url = supabaseUrl,
                anonKey = supabase.requireString("anonKey"),
            ),
            accessToken = root.requireString("accessToken"),
            expiresAt = expiresAt,
        )
    }

    private fun JSONObject.requireString(key: String): String {
        val value = getString(key)
        require(value.isNotBlank()) { "$key must not be blank" }
        return value
    }
}
