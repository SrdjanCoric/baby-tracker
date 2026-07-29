# Sofi Baby Tracker - Complete Setup Guide for Testing

This guide walks you through setting up everything needed to test the Sofi Baby Tracker app on real devices through the App Store (TestFlight) and Play Store (Internal Testing). Written for non-technical users with step-by-step instructions.

**Time Required:** Approximately 2-4 hours for complete setup

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Part A: Supabase Setup (Backend)](#part-a-supabase-setup-backend)
3. [Part B: Expo/EAS Setup (Build Service)](#part-b-expoeas-setup-build-service)
4. [Part C: Apple Developer Setup (iOS)](#part-c-apple-developer-setup-ios)
5. [Part D: Google Play Setup (Android)](#part-d-google-play-setup-android)
6. [Part E: OAuth Provider Setup (Google/Apple Sign-In)](#part-e-oauth-provider-setup-googleapple-sign-in)
7. [Part F: Building and Submitting the App](#part-f-building-and-submitting-the-app)
8. [Part G: Inviting Testers](#part-g-inviting-testers)
9. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

Before you begin, you'll need:

### Required Accounts (Create if you don't have them)

| Account | Cost | Link | Why You Need It |
|---------|------|------|-----------------|
| **Supabase** | Free | https://supabase.com | Backend database and authentication |
| **Expo** | Free | https://expo.dev | Build service for the app |
| **Apple Developer** | $99/year | https://developer.apple.com | Required to publish iOS apps |
| **Google Play Developer** | $25 one-time | https://play.google.com/console | Required to publish Android apps |

### Required Information

Keep these details handy as you'll need them throughout this guide:
- Your email address
- A credit card for developer account registration
- The Sofi Baby Tracker project code (already on your computer)

---

## Part A: Supabase Setup (Backend)

Supabase provides the database and user authentication for the app.

### Step A1: Create a Supabase Account

1. Go to https://supabase.com
2. Click **"Start your project"** (green button)
3. Sign up with:
   - GitHub (recommended if you have one)
   - Or create account with email/password
4. Verify your email if prompted

### Step A2: Create a New Project

1. After signing in, click **"New Project"**
2. Fill in the project details:
   - **Name:** `sofi-baby-tracker` (or any name you prefer)
   - **Database Password:** Create a strong password and **SAVE IT SOMEWHERE SAFE** (you'll need it later)
   - **Region:** Choose the closest region to your users (e.g., "East US" for US-based users)
3. Click **"Create new project"**
4. Wait 1-2 minutes for the project to be created

### Step A3: Get Your Project Credentials

Once your project is ready:

1. Click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** in the Settings menu
3. You'll see two important values - copy these somewhere safe:

```
Project URL: https://xxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** Keep these values - you'll add them to the app later.

### Step A4: Set Up the Database Tables

1. Click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/migrations/001_initial_schema.sql` from the Sofi Baby Tracker project
4. Copy the entire contents
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter / Cmd+Enter)
7. You should see "Success. No rows returned"

**Repeat for all migration files in order:**
- `002_regenerate_invite_code.sql`
- `003_household_member_visibility.sql`
- `004_security_definer_search_path.sql`
- `005_join_household_by_invite_code.sql`
- `006_add_logged_by_attribution.sql`
- `007_caregiver_removal_function.sql`
- `008_fix_invite_code_generation_security.sql`

### Step A5: Configure Email Authentication

1. In the left sidebar, click **"Authentication"**
2. Under **Configuration**, click **"Providers"**
3. Find **"Email"** in the list and make sure it's enabled (toggle ON)
4. Click on **"Email"** to expand settings:
   - **Enable email confirmations:** ON (recommended for production)
   - **Secure email change:** ON
   - **Enable double confirmation:** ON

**Note:** Magic Links are enabled by default when Email is enabled.

**Rate Limits & Expiration (Good to Know):**
- Users can only request a magic link once every 60 seconds
- Magic links expire after 1 hour

### Step A6: Configure Email Templates

The app uses Magic Link for passwordless login. You need to configure the email template.

1. In the left sidebar, click **"Authentication"**
2. Under **Configuration**, click **"Emails"**
3. Click on **"Magic link"** in the list of templates

You'll see an editor with:
- **Subject:** "Your Magic Link" (you can customize this)
- **Body:** HTML template with template variables

**Default Magic Link Template:**
```html
<h2>Magic Link</h2>

<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

**Available Template Variables:**
| Variable | What it does |
|----------|--------------|
| `{{ .ConfirmationURL }}` | The clickable login link (most important!) |
| `{{ .Token }}` | 6-digit one-time password (alternative to link) |
| `{{ .TokenHash }}` | Hashed token for custom implementations |
| `{{ .SiteURL }}` | Your app's configured site URL |
| `{{ .Email }}` | The user's email address |
| `{{ .RedirectTo }}` | Where to redirect after login |
| `{{ .Data }}` | Any custom metadata passed during sign-in |

**Customized Template Example (Optional):**
```html
<h2>Welcome to Sofi Baby Tracker!</h2>

<p>Hi there,</p>
<p>Click the button below to sign in to your Sofi Baby Tracker account:</p>

<p><a href="{{ .ConfirmationURL }}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign In to Sofi Baby Tracker</a></p>

<p>This link will expire in 1 hour.</p>
<p>If you didn't request this email, you can safely ignore it.</p>
```

4. Click **"Save"** after making changes

**Other Templates to Customize (Optional):**
- **Confirm signup** - Welcome email when users register
- **Reset Password** - Password reset emails
- **Change Email Address** - Confirmation for email changes

### Step A7: Configure a Custom SMTP Provider (Required for Production)

**Important:** Supabase's built-in email service only allows **2 emails per day** - this is only for basic testing. For real testing with multiple users, you MUST set up a custom SMTP provider.

**Option 1: Resend (Recommended - Easiest Setup)**

1. Go to https://resend.com and create a free account (3,000 emails/month free)
2. Verify your email address
3. In Resend dashboard, click **"API Keys"** in the sidebar
4. Click **"Create API Key"**
5. Name it "Sofi Baby Tracker Supabase" and click **"Add"**
6. **COPY the API key immediately** (starts with `re_...`) - you won't see it again!

**Configure in Supabase:**
1. Go to **"Project Settings"** (gear icon in left sidebar)
2. Click **"Authentication"** in the settings menu
3. Scroll down to **"SMTP Settings"**
4. Toggle **"Enable Custom SMTP"** ON
5. Fill in these settings:

| Setting | Value |
|---------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Minimum interval | `60` seconds |
| User | `resend` |
| Password | Your Resend API key (the `re_...` key) |
| Sender email | `noreply@resend.dev` (or your verified domain) |
| Sender name | `Sofi Baby Tracker` |

6. Click **"Save"**

**Option 2: SendGrid (Alternative)**

1. Go to https://sendgrid.com and create a free account (100 emails/day free)
2. Complete email verification and sender authentication
3. Go to **Settings** → **API Keys** → **Create API Key**
4. Select "Full Access" and create the key
5. Copy the API key

**Configure in Supabase:**
| Setting | Value |
|---------|-------|
| Host | `smtp.sendgrid.net` |
| Port | `587` |
| User | `apikey` (literally type "apikey") |
| Password | Your SendGrid API key |
| Sender email | Your verified sender email |
| Sender name | `Sofi Baby Tracker` |

**Option 3: Mailgun, Postmark, AWS SES**

Similar process - get SMTP credentials from your provider and enter them in Supabase. Each provider has slightly different settings, check their documentation.

### Step A8: Set Up Redirect URLs (Critical for Mobile App!)

This tells Supabase where to send users after they click a magic link or sign in with Google/Apple.

1. In the left sidebar, click **"Authentication"**
2. Under **Configuration**, click **"URL Configuration"**

**Configure Site URL:**

The Site URL is the default redirect destination. For a mobile app, you need a full URL with scheme and hostname:

```
sofibaby://login-callback/
```

**Important:** Supabase requires the format `scheme://hostname/` - just `sofibaby://` alone won't work!

**Configure Redirect URLs:**

Click **"Add URL"** to add each of these:

```
sofibaby://login-callback/
```

For development/testing with Expo Go, also add:
```
exp://localhost:8081
exp://127.0.0.1:8081
```

**Why these URLs matter:**
- `sofibaby://login-callback/` - The full deep link URL that opens your app
- The redirect URLs whitelist tells Supabase which destinations are allowed
- If a URL isn't in this list, authentication redirects will fail

4. Click **"Save"** after adding all URLs

See [`DEEP_LINKS.md`](DEEP_LINKS.md) for callback routing, onboarding resume behavior, timer action links, and focused tests.

---

## Part B: Expo/EAS Setup (Build Service)

Expo Application Services (EAS) builds your app for iOS and Android.

### Step B1: Create an Expo Account

1. Go to https://expo.dev
2. Click **"Sign Up"**
3. Create an account with email or GitHub

### Step B2: Install Expo CLI (On Your Computer)

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
npm install -g eas-cli
```

### Step B3: Log In to EAS

In Terminal, run:

```bash
eas login
```

Enter your Expo username and password.

### Step B4: Configure the Project for EAS

Navigate to the Sofi Baby Tracker project folder in Terminal:

```bash
cd /path/to/sofi-baby-tracker
```

Run the configuration command:

```bash
eas build:configure
```

This creates an `eas.json` file with build settings.

### Step B5: Create EAS Configuration

Create or update the `eas.json` file in the project root:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID_EMAIL",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json"
      }
    }
  }
}
```

---

## Part C: Apple Developer Setup (iOS)

### Step C1: Enroll in Apple Developer Program

1. Go to https://developer.apple.com/programs/enroll/
2. Click **"Start Your Enrollment"**
3. Sign in with your Apple ID (or create one)
4. Choose **"Individual"** or **"Organization"**
5. Pay the $99/year fee
6. Wait for approval (usually 24-48 hours)

### Step C2: Create an App ID

1. Go to https://developer.apple.com/account
2. Click **"Certificates, Identifiers & Profiles"**
3. Click **"Identifiers"** in the sidebar
4. Click the **"+"** button
5. Select **"App IDs"** → Continue
6. Select **"App"** → Continue
7. Fill in:
   - **Description:** Sofi Baby Tracker
   - **Bundle ID:** Select "Explicit" and enter: `com.sofibaby.app`
8. Scroll down to **Capabilities** and enable:
   - **Sign In with Apple** (check the box)
9. Click **"Continue"** → **"Register"**

### Step C3: Create Your App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click **"My Apps"**
3. Click the **"+"** button → **"New App"**
4. Fill in:
   - **Platforms:** iOS
   - **Name:** Sofi Baby Tracker
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select `com.sofibaby.app`
   - **SKU:** `babytracker` (unique identifier, can be anything)
   - **User Access:** Full Access
5. Click **"Create"**

### Step C4: Set Up TestFlight

1. In your app page, click **"TestFlight"** tab
2. You'll see a message about needing a build - that comes later
3. For now, click **"Test Information"** (left sidebar)
4. Fill in:
   - **Beta App Description:** A privacy-first baby tracking app for caregivers
   - **Feedback Email:** your@email.com
   - **Privacy Policy URL:** (optional for testing, required for release)
5. Click **"Save"**

### Step C5: Generate App-Specific Password (for EAS)

EAS needs this to upload builds to App Store Connect:

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. In **"Sign-In and Security"**, find **"App-Specific Passwords"**
4. Click **"Generate an App-Specific Password"**
5. Name it: `EAS Build Service`
6. Click **"Create"**
7. **COPY AND SAVE** the password shown (you can't see it again!)

---

## Part D: Google Play Setup (Android)

### Step D1: Create a Google Play Developer Account

1. Go to https://play.google.com/console
2. Click **"Create a developer account"**
3. Sign in with your Google account
4. Accept the Developer Distribution Agreement
5. Pay the one-time $25 registration fee
6. Complete identity verification (may take a few days)

### Step D2: Create Your App

1. In Google Play Console, click **"Create app"**
2. Fill in:
   - **App name:** Sofi Baby Tracker
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free (or Paid if applicable)
3. Check the declarations checkboxes
4. Click **"Create app"**

### Step D3: Complete Store Listing (Required for Testing)

1. In your app's dashboard, go to **"Main store listing"**
2. Fill in the required fields:
   - **Short description:** A privacy-first baby tracking app
   - **Full description:** Track your baby's feeding, sleep, diapers, and growth with real-time sync between caregivers.
3. Add **Screenshots** (required):
   - You need at least 2 phone screenshots
   - For testing, you can use placeholder images (take screenshots from the simulator)
4. Add **Feature graphic** (1024x500 pixels)
5. Add **App icon** (512x512 pixels)
6. Click **"Save"**

### Step D4: Set Up Content Rating

1. Go to **"App content"** → **"Content rating"**
2. Click **"Start questionnaire"**
3. Answer the questions honestly (Sofi Baby Tracker has no violent/adult content)
4. Click **"Submit"**

### Step D5: Set Up Internal Testing

1. Go to **"Testing"** → **"Internal testing"**
2. Click **"Create track"** if needed
3. Click **"Testers"** tab
4. Click **"Create email list"**
5. Name it: "Beta Testers"
6. Add tester email addresses
7. Click **"Save changes"**

### Step D6: Create a Service Account (for EAS to Upload Builds)

1. Go to **"Setup"** → **"API access"**
2. Click **"Create new service account"**
3. This opens Google Cloud Console:
   - Click **"+ Create Service Account"**
   - **Service account name:** eas-build-upload
   - Click **"Create and Continue"**
   - **Role:** Select "Service Account User"
   - Click **"Continue"** → **"Done"**
4. Click on the new service account
5. Click **"Keys"** tab → **"Add Key"** → **"Create new key"**
6. Choose **"JSON"** → Click **"Create"**
7. A JSON file downloads - **SAVE THIS SECURELY**
8. Rename it to `google-play-service-account.json`
9. Place it in your Sofi Baby Tracker project root
10. Back in Google Play Console → API access:
    - Find your service account
    - Click **"Grant access"**
    - Set permissions to **"Release to production, exclude devices"**
    - Click **"Invite user"**

---

## Part E: OAuth Provider Setup (Google/Apple Sign-In)

### Step E1: Set Up Google Sign-In

**In Google Cloud Console:**

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Go to **"APIs & Services"** → **"Credentials"**
4. Click **"Create Credentials"** → **"OAuth 2.0 Client IDs"**

**For iOS:**
1. Application type: **iOS**
2. Name: Sofi Baby Tracker iOS
3. Bundle ID: `com.sofibaby.app`
4. Click **"Create"**
5. Copy the **Client ID**

**For Android:**
1. Click **"Create Credentials"** → **"OAuth 2.0 Client IDs"**
2. Application type: **Android**
3. Name: Sofi Baby Tracker Android
4. Package name: `com.sofibaby.app`
5. SHA-1 certificate fingerprint: Run this command to get it:
   ```bash
   eas credentials --platform android
   ```
   Look for the SHA-1 fingerprint
6. Click **"Create"**
7. Copy the **Client ID**

**Configure OAuth Consent Screen:**
1. Go to **"OAuth consent screen"**
2. Choose **"External"** → Create
3. Fill in:
   - App name: Sofi Baby Tracker
   - User support email: your@email.com
   - Developer contact: your@email.com
4. Click **"Save and Continue"**
5. Add scopes: `email`, `profile`, `openid`
6. Add test users (your email and testers)
7. Click **"Save"**

**In Supabase:**
1. Go to **Authentication** → **Providers**
2. Find **Google** and enable it
3. Enter:
   - **Client ID:** [from Google Cloud Console]
   - **Client Secret:** [from Google Cloud Console]
4. Click **"Save"**

### Step E2: Set Up Apple Sign-In

**In Apple Developer Portal:**

1. Go to https://developer.apple.com/account
2. Click **"Certificates, Identifiers & Profiles"**
3. Click **"Keys"** in the sidebar
4. Click **"+"** to create a new key
5. Fill in:
   - **Key Name:** Sofi Baby Tracker Sign In
   - Check **"Sign in with Apple"**
   - Click **"Configure"** next to Sign in with Apple
   - Primary App ID: Select `com.sofibaby.app`
6. Click **"Continue"** → **"Register"**
7. **Download the key** (.p8 file) - **YOU CAN ONLY DOWNLOAD THIS ONCE**
8. Note down the **Key ID** shown

**Get your Team ID:**
1. In the Apple Developer portal top right, click your name
2. Note your **Team ID** (10-character code)

**In Supabase:**
1. Go to **Authentication** → **Providers**
2. Find **Apple** and enable it
3. Enter:
   - **Service ID:** `com.sofibaby.app`
   - **Team ID:** [your Team ID]
   - **Key ID:** [from the key you created]
   - **Private Key:** Open the .p8 file in a text editor and copy the entire contents
4. Click **"Save"**

---

## Part F: Building and Submitting the App

### Step F1: Add Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with your actual Supabase credentials from Step A3.

### Step F2: Add Environment Variables to EAS

Run these commands to securely store your credentials:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --scope project

eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --scope project
```

### Step F3: Build for iOS (TestFlight)

```bash
eas build --platform ios --profile production
```

This will:
1. Ask you to log in to your Apple Developer account
2. Generate certificates and provisioning profiles
3. Build the app in the cloud
4. When done, you can submit directly

To submit to TestFlight:

```bash
eas submit --platform ios
```

Or submit directly after build:

```bash
eas build --platform ios --profile production --auto-submit
```

### Step F4: Build for Android (Play Store)

```bash
eas build --platform android --profile production
```

This builds an AAB (Android App Bundle) file.

To submit to Play Store:

```bash
eas submit --platform android
```

### Step F5: Wait for Processing

- **iOS:** TestFlight builds usually process in 15-30 minutes
- **Android:** Internal testing tracks are usually available within minutes

---

## Part G: Inviting Testers

### iOS TestFlight Testers

1. Go to https://appstoreconnect.apple.com
2. Open your app → **TestFlight**
3. Once your build is processed, click on it
4. Click **"+ Add Internal Testers"** or **"External Testers"**
   - **Internal:** Up to 100 Apple Developer team members (instant access)
   - **External:** Up to 10,000 testers (requires brief review, ~24-48 hours)
5. Enter tester email addresses
6. Testers receive an email invitation to install TestFlight

**Testers need to:**
1. Download **TestFlight** app from App Store
2. Accept the email invitation
3. Install Sofi Baby Tracker through TestFlight

### Android Internal Testing

1. Go to https://play.google.com/console
2. Open your app → **Testing** → **Internal testing**
3. Make sure testers are added to your email list
4. Create a new release:
   - Upload the AAB file (or it was auto-uploaded by EAS)
   - Write release notes
   - Click **"Review release"** → **"Start rollout"**
5. Copy the **opt-in URL** from the Testers tab
6. Send this link to your testers

**Testers need to:**
1. Open the opt-in link on their Android device
2. Accept the invitation
3. Download Sofi Baby Tracker from Play Store (shows as internal test)

---

## Troubleshooting

### Email & Magic Link Issues

**"Magic link email not arriving":**
1. **Check spam/junk folder** - Magic link emails often get filtered
2. **Verify SMTP is configured** - Go to Supabase → Project Settings → Authentication → SMTP Settings
   - If using default Supabase email: Only 2 emails/day allowed!
   - You MUST configure custom SMTP for real testing
3. **Check rate limits** - Users can only request 1 magic link per 60 seconds
4. **Check Supabase logs:**
   - Go to Authentication → Logs
   - Look for any error messages related to email sending
5. **Verify sender email is valid:**
   - If using Resend: Must use `@resend.dev` or a verified domain
   - If using SendGrid: Sender email must be verified

**"Magic link clicked but nothing happens":**
1. **Check Redirect URLs** - Go to Authentication → URL Configuration
   - Make sure `sofibaby://login-callback/` is in the Site URL or Redirect URLs
   - The app's custom scheme must exactly match
2. **Check the app is installed** - The magic link uses deep linking which requires the app
3. **For testing on simulator:** Deep links may not work - test on real device

**"Magic link expired":**
- Magic links expire after 1 hour
- User must request a new one
- Check if there's a delay in email delivery

**"Too many requests" error:**
- Users can only request magic link once every 60 seconds
- Wait and try again

### Build Issues

**"Build failed" in EAS:**
- Check the build logs in Expo dashboard (https://expo.dev)
- Ensure all environment variables are set correctly
- Make sure credentials are valid
- Check that `eas.json` exists and is valid JSON

**"Missing environment variables":**
- Verify `.env` file exists with correct values
- Add secrets to EAS: `eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "your-url"`

### OAuth Issues

**"Google Sign-In not working":**
- Verify OAuth Client IDs match your app bundle/package
- Check SHA-1 fingerprint is correct for Android
- Ensure OAuth consent screen is configured
- Make sure Google provider is enabled in Supabase → Authentication → Providers

**"Apple Sign-In not working":**
- Verify your Service ID matches your bundle identifier (`com.sofibaby.app`)
- Check that the Sign In with Apple capability is enabled in Apple Developer portal
- Ensure your private key is correct (no extra spaces/newlines)
- In Supabase, make sure Apple provider is enabled with correct Team ID and Key ID

**"Redirect not working after OAuth":**
- Check all redirect URLs are added in Supabase URL Configuration
- The URL in `redirectTo` must exactly match what's in the allowlist
- For mobile apps, ensure deep linking is configured in `app.json`

### App Store / Play Store Issues

**"TestFlight build rejected":**
- Check your app has all required metadata
- Ensure no placeholder content remains
- Check for missing privacy policy URL
- Make sure export compliance information is filled in

**"Can't see app in Play Store":**
- Make sure you're signed into the correct Google account
- Clear Play Store cache: Settings → Apps → Play Store → Clear cache
- Try the opt-in link again
- Wait a few minutes after publishing - it takes time to propagate

**"App crashes on launch":**
- Check that environment variables are correctly set in the build
- Verify Supabase project is active and accessible
- Check EAS build logs for any warnings

### Getting Help

- **Supabase Documentation:** https://supabase.com/docs/guides/auth
- **Supabase Email Templates:** https://supabase.com/docs/guides/auth/auth-email-templates
- **Expo/EAS Documentation:** https://docs.expo.dev
- **Apple Developer Support:** https://developer.apple.com/support/
- **Google Play Support:** https://support.google.com/googleplay/android-developer/

---

## Quick Reference: Important URLs

| Service | URL |
|---------|-----|
| Supabase Dashboard | https://app.supabase.com |
| Expo Dashboard | https://expo.dev |
| App Store Connect | https://appstoreconnect.apple.com |
| Google Play Console | https://play.google.com/console |
| Apple Developer | https://developer.apple.com |
| Google Cloud Console | https://console.cloud.google.com |

---

## Checklist Summary

Use this checklist to track your progress:

### Supabase
- [x] Account created
- [x] Project created
- [x] Database migrations run (8 files)
- [x] Email authentication enabled
- [x] Magic link email template reviewed/customized
- [ ] Custom SMTP provider configured (Resend/SendGrid) - Required for real testing!
- [x] Site URL set to `sofibaby://login-callback/`
- [x] Redirect URLs configured (`sofibaby://login-callback/`)
- [ ] Google OAuth configured (in Providers)
- [ ] Apple OAuth configured (in Providers)

### Expo/EAS
- [x] Account created
- [x] EAS CLI installed
- [x] Project configured
- [x] Environment secrets added

### Apple (iOS)
- [x] Developer account enrolled ($99/year)
- [x] App ID created
- [x] App created in App Store Connect (App ID: 6758142736)
- [x] TestFlight configured
- [x] App-specific password generated
- [x] Sign In with Apple key created

### Google Play (Android)
- [x] Developer account created ($25)
- [x] App created
- [ ] Store listing filled in
- [ ] Content rating completed
- [x] Internal testing track created
- [x] Service account JSON obtained

### Final Steps
- [x] iOS build completed
- [x] iOS submitted to TestFlight
- [x] Android build completed
- [x] Android submitted to Play Store (Internal Testing)
- [ ] Testers invited

---

**Congratulations!** Once you complete all these steps, your testers will be able to download and test Sofi Baby Tracker on their real devices through TestFlight (iOS) and Play Store Internal Testing (Android).
