package com.sofibaby.app.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class SignedOutStateTest {
    @Test
    fun signedOutMessageDirectsTheCaregiverToThePhone() {
        assertEquals(
            "Sign in on your phone to continue.",
            SignedOutState.message,
        )
    }
}
