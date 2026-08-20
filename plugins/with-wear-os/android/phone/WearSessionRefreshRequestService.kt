package com.sofibaby.app

import android.content.Context
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

class WearSessionRefreshRequestService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        events.forEach { event ->
            if (event.type != DataEvent.TYPE_CHANGED || event.dataItem.uri.path != REFRESH_PATH) return@forEach
            val revision = DataMapItem.fromDataItem(event.dataItem).dataMap.getLong("revision", -1)
            if (revision < 0 || !WearSessionRefreshRequests.record(this, revision)) return@forEach
            WearSessionRefreshEvents.emit(revision)
        }
    }

    private companion object {
        const val REFRESH_PATH = "/sofi/wear/auth/refresh-request"
    }
}

internal object WearSessionRefreshRequests {
    private const val PREFERENCES = "wear-session-refresh"
    private const val REVISION = "revision"

    fun read(context: Context): Long? = context
        .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        .getLong(REVISION, -1)
        .takeIf { it >= 0 }

    fun record(context: Context, revision: Long): Boolean {
        val current = read(context)
        if (current != null && revision <= current) return false
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putLong(REVISION, revision)
            .apply()
        return true
    }
}

internal object WearSessionRefreshEvents {
    private val listeners = mutableSetOf<(Long) -> Unit>()

    @Synchronized fun add(listener: (Long) -> Unit) { listeners += listener }
    @Synchronized fun remove(listener: (Long) -> Unit) { listeners -= listener }
    @Synchronized fun emit(revision: Long) { listeners.toList().forEach { it(revision) } }
}
