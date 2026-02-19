package com.sofibaby.app

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class LiveActivityControllerPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == LiveActivityControllerModule.NAME) {
            LiveActivityControllerModule(reactContext)
        } else {
            null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                LiveActivityControllerModule.NAME to ReactModuleInfo(
                    LiveActivityControllerModule.NAME,
                    LiveActivityControllerModule.NAME,
                    false,
                    false,
                    false,
                    true
                )
            )
        }
    }
}
