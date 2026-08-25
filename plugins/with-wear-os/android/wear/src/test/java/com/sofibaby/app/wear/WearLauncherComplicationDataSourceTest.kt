package com.sofibaby.app.wear

import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.MonochromaticImageComplicationData
import androidx.wear.watchface.complications.data.SmallImageComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class WearLauncherComplicationDataSourceTest {
    @Test
    fun smallImageRequestReturnsAnAppLauncher() = runBlocking {
        val service =
            Robolectric.buildService(WearLauncherComplicationDataSource::class.java).create().get()

        val data =
            service.onComplicationRequest(
                ComplicationRequest(
                    complicationInstanceId = 7,
                    complicationType = ComplicationType.SMALL_IMAGE,
                    immediateResponseRequired = true,
                ),
            ) as SmallImageComplicationData

        assertEquals(ComplicationType.SMALL_IMAGE, data.type)
        assertNotNull(data.smallImage.image)
        assertNotNull(data.tapAction)
        assertEquals(
            MainActivity::class.java.name,
            shadowOf(requireNotNull(data.tapAction)).savedIntent.component?.className,
        )
        assertNotNull(service.getPreviewData(ComplicationType.SMALL_IMAGE))
    }

    @Test
    fun monochromaticImageRequestReturnsAnAppLauncher() = runBlocking {
        val service =
            Robolectric.buildService(WearLauncherComplicationDataSource::class.java).create().get()

        val data =
            service.onComplicationRequest(
                ComplicationRequest(
                    complicationInstanceId = 8,
                    complicationType = ComplicationType.MONOCHROMATIC_IMAGE,
                    immediateResponseRequired = true,
                ),
            ) as MonochromaticImageComplicationData

        assertEquals(ComplicationType.MONOCHROMATIC_IMAGE, data.type)
        assertNotNull(data.monochromaticImage.image)
        assertNotNull(data.tapAction)
        assertEquals(
            MainActivity::class.java.name,
            shadowOf(requireNotNull(data.tapAction)).savedIntent.component?.className,
        )
        assertNotNull(service.getPreviewData(ComplicationType.MONOCHROMATIC_IMAGE))
    }
}
