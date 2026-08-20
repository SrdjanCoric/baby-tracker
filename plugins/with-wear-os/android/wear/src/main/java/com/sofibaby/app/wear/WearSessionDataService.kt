package com.sofibaby.app.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

class WearSessionDataService : WearableListenerService() {
    override fun onCreate() {
        super.onCreate()
        WearSessionRuntime.initialize(this)
    }

    override fun onDataChanged(events: DataEventBuffer) {
        events.forEach { event ->
            if (event.type != DataEvent.TYPE_CHANGED || event.dataItem.uri.path != STATE_PATH) return@forEach
            DataMapItem.fromDataItem(event.dataItem).dataMap.getString("json")?.let(WearSessionRuntime::accept)
        }
    }

    private companion object {
        const val STATE_PATH = "/sofi/wear/auth/state"
    }
}
