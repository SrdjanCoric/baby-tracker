package com.sofibaby.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

class WearSessionBridgeModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    private var listenerCount = 0
    private val refreshListener: (Long) -> Unit = ::emitRefreshRequest

    override fun getName() = "WearSessionBridge"

    @ReactMethod
    fun publishState(json: String, promise: Promise) {
        val revision = try {
            validateEnvelope(json)
        } catch (error: Exception) {
            promise.reject("INVALID_WEAR_SESSION", error.message, error)
            return
        }
        val request = PutDataMapRequest.create(STATE_PATH).apply {
            dataMap.putString("json", json)
            dataMap.putLong("revision", revision)
        }.asPutDataRequest().setUrgent()
        Wearable.getDataClient(reactContext).putDataItem(request)
            .addOnSuccessListener { promise.resolve(null) }
            .addOnFailureListener { promise.reject("WEAR_DATA_LAYER", "Unable to publish Wear session", it) }
    }

    @ReactMethod
    fun getPendingRefreshRequest(promise: Promise) {
        val revision = WearSessionRefreshRequests.read(reactContext)
        promise.resolve(revision?.toDouble())
    }

    @ReactMethod
    fun addListener(eventName: String) {
        if (eventName != REFRESH_EVENT) return
        if (listenerCount++ == 0) WearSessionRefreshEvents.add(refreshListener)
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
        if (listenerCount == 0) WearSessionRefreshEvents.remove(refreshListener)
    }

    override fun invalidate() {
        WearSessionRefreshEvents.remove(refreshListener)
        super.invalidate()
    }

    private fun emitRefreshRequest(revision: Long) {
        if (!reactContext.hasActiveReactInstance()) return
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(REFRESH_EVENT, revision.toDouble())
    }

    private fun validateEnvelope(json: String): Long {
        val root = JSONObject(json)
        require(root.getInt("version") == 1) { "Unsupported envelope version" }
        require(!json.contains("refreshToken", ignoreCase = true)) { "Refresh tokens are forbidden" }
        require(root.getString("disposition") in setOf("active", "invalidated")) {
            "Unsupported disposition"
        }
        return root.getLong("revision").also { require(it >= 0) { "Invalid revision" } }
    }

    private companion object {
        const val STATE_PATH = "/sofi/wear/auth/state"
        const val REFRESH_EVENT = "WearSessionRefreshRequested"
    }
}
