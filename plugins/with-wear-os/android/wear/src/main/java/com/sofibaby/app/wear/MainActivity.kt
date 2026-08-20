package com.sofibaby.app.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WearSessionRuntime.initialize(this)
        setContent {
            MaterialTheme {
                WearSessionScreen(WearSessionRuntime.state.value)
            }
        }
    }
}

@Composable
fun WearSessionScreen(state: WearSessionUiState) {
    when (state) {
        WearSessionUiState.SignedOut -> SignedOutScreen()
        WearSessionUiState.ReconnectFromPhone -> CenteredMessage("Reconnect from phone")
        is WearSessionUiState.SignedIn -> SignedInScreen(state)
    }
}

@Composable
fun SignedOutScreen() {
    CenteredMessage(SignedOutState.message)
}

@Composable
private fun SignedInScreen(state: WearSessionUiState.SignedIn) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = state.babyName, textAlign = TextAlign.Center)
            Text(text = state.accountLabel, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun CenteredMessage(message: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = message, textAlign = TextAlign.Center)
    }
}
