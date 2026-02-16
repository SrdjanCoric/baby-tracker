package com.sofibaby.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class LiveActivityControllerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    TurboModule {

    override fun getName() = NAME

    private data class ActiveNotification(
        val type: String,
        val notificationId: Int,
        val startTimeMs: Long,
        val babyName: String,
        val context: String?,
        val isPaused: Boolean = false,
        val pausedElapsedMs: Long = 0
    )

    private val activeNotifications = mutableMapOf<String, ActiveNotification>()

    private val channelId = "active-timers"

    companion object {
        const val NAME = "LiveActivityController"

        private val NOTIFICATION_IDS = mapOf(
            "feeding" to 1001,
            "sleep" to 1002,
            "pumping" to 1003,
            "tummyTime" to 1004
        )

        private val EMOJIS = mapOf(
            "feeding" to "\uD83E\uDD31",
            "sleep" to "\uD83D\uDE34",
            "pumping" to "\uD83C\uDF7C",
            "tummyTime" to "\uD83D\uDC76"
        )

        private val LABELS = mapOf(
            "feeding" to "Feeding",
            "sleep" to "Sleep",
            "pumping" to "Pumping",
            "tummyTime" to "Tummy Time"
        )

        private val COLORS = mapOf(
            "feeding" to 0xFF8CB369.toInt(),
            "sleep" to 0xFF9E8DA9.toInt(),
            "pumping" to 0xFF7BA3A8.toInt(),
            "tummyTime" to 0xFFD4A574.toInt()
        )

        private const val PAUSED_COLOR = 0xFFD4A017.toInt()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(channelId) != null) return

        val channel = NotificationChannel(
            channelId,
            "Active Timers",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Ongoing notifications for active timer activities"
            enableVibration(false)
            setSound(null, null)
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildActivityId(type: String, notificationId: Int): String {
        return "android-$type-$notificationId"
    }

    private fun getLaunchIntent(): PendingIntent {
        val packageName = reactContext.packageName
        val intent = reactContext.packageManager.getLaunchIntentForPackage(packageName)
            ?: Intent().apply { setPackage(packageName) }
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)

        return PendingIntent.getActivity(
            reactContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun buildNotification(entry: ActiveNotification): NotificationCompat.Builder {
        val emoji = EMOJIS[entry.type] ?: ""
        val label = LABELS[entry.type] ?: entry.type

        val builder = NotificationCompat.Builder(reactContext, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(getLaunchIntent())
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (entry.isPaused) {
            val elapsedSec = entry.pausedElapsedMs / 1000
            val mins = elapsedSec / 60
            val secs = elapsedSec % 60
            val elapsedText = String.format("%d:%02d", mins, secs)

            val title = "\u23F8 $label \u00B7 Paused"
            builder.setContentTitle(title)
            builder.setContentText("${entry.babyName} \u00B7 $elapsedText")
            builder.setColor(PAUSED_COLOR)
        } else {
            val title = if (entry.context != null) {
                "$emoji $label \u00B7 ${formatContext(entry.context)}"
            } else {
                "$emoji $label"
            }
            builder.setContentTitle(title)
            builder.setContentText(entry.babyName)
            builder.setColor(COLORS[entry.type] ?: COLORS["feeding"]!!)
            builder.setUsesChronometer(true)
            builder.setWhen(entry.startTimeMs)
        }

        return builder
    }

    private fun formatContext(context: String): String {
        return when (context) {
            "left" -> "Left"
            "right" -> "Right"
            "both" -> "Both"
            "nap" -> "Nap"
            "night" -> "Night"
            else -> context.replaceFirstChar { it.uppercase() }
        }
    }

    private fun showNotification(entry: ActiveNotification) {
        ensureChannel()
        val notification = buildNotification(entry).build()
        val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(entry.notificationId, notification)
    }

    private fun cancelNotification(notificationId: Int) {
        val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(notificationId)
    }

    @ReactMethod
    fun startTimerActivity(
        activityType: String,
        babyName: String,
        context: String?,
        startTimeISO: String?,
        promise: Promise
    ) {
        val notificationId = NOTIFICATION_IDS[activityType]
        if (notificationId == null) {
            promise.resolve(null)
            return
        }

        val startTimeMs = if (startTimeISO != null) {
            try {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val date = sdf.parse(startTimeISO)
                date?.time ?: System.currentTimeMillis()
            } catch (e: Exception) {
                try {
                    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
                    sdf.timeZone = TimeZone.getTimeZone("UTC")
                    val date = sdf.parse(startTimeISO)
                    date?.time ?: System.currentTimeMillis()
                } catch (e2: Exception) {
                    System.currentTimeMillis()
                }
            }
        } else {
            System.currentTimeMillis()
        }

        val activityId = buildActivityId(activityType, notificationId)

        val entry = ActiveNotification(
            type = activityType,
            notificationId = notificationId,
            startTimeMs = startTimeMs,
            babyName = babyName,
            context = context
        )

        activeNotifications[activityId] = entry
        showNotification(entry)

        promise.resolve(activityId)
    }

    @ReactMethod
    fun updateTimerActivity(activityId: String, context: String?, promise: Promise) {
        val entry = activeNotifications[activityId]
        if (entry == null) {
            promise.resolve(false)
            return
        }

        val updated = entry.copy(context = context)
        activeNotifications[activityId] = updated
        showNotification(updated)

        promise.resolve(true)
    }

    @ReactMethod
    fun endTimerActivity(activityId: String, promise: Promise) {
        val entry = activeNotifications.remove(activityId)
        if (entry == null) {
            promise.resolve(false)
            return
        }

        cancelNotification(entry.notificationId)
        promise.resolve(true)
    }

    @ReactMethod
    fun endAllActivities(promise: Promise) {
        for ((_, entry) in activeNotifications) {
            cancelNotification(entry.notificationId)
        }
        activeNotifications.clear()
        promise.resolve(null)
    }

    @ReactMethod
    fun endActivityByType(activityType: String, promise: Promise) {
        var endedAny = false
        val toRemove = mutableListOf<String>()

        for ((id, entry) in activeNotifications) {
            if (entry.type == activityType) {
                cancelNotification(entry.notificationId)
                toRemove.add(id)
                endedAny = true
            }
        }

        for (id in toRemove) {
            activeNotifications.remove(id)
        }

        promise.resolve(endedAny)
    }

    @ReactMethod
    fun pauseTimerActivity(activityId: String, promise: Promise) {
        val entry = activeNotifications[activityId]
        if (entry == null) {
            promise.resolve(false)
            return
        }

        val elapsedMs = System.currentTimeMillis() - entry.startTimeMs

        val paused = entry.copy(
            isPaused = true,
            pausedElapsedMs = elapsedMs
        )
        activeNotifications[activityId] = paused
        showNotification(paused)

        promise.resolve(true)
    }

    @ReactMethod
    fun resumeTimerActivity(activityId: String, activeElapsedSeconds: Double, promise: Promise) {
        val entry = activeNotifications[activityId]
        if (entry == null) {
            promise.resolve(false)
            return
        }

        val newStartTimeMs = System.currentTimeMillis() - (activeElapsedSeconds * 1000).toLong()

        val resumed = entry.copy(
            isPaused = false,
            startTimeMs = newStartTimeMs,
            pausedElapsedMs = 0
        )
        activeNotifications[activityId] = resumed
        showNotification(resumed)

        promise.resolve(true)
    }

    @ReactMethod
    fun isActivityRunning(activityId: String, promise: Promise) {
        promise.resolve(activeNotifications.containsKey(activityId))
    }
}
