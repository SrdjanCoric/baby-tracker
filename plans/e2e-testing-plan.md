# Baby Tracker App - Comprehensive E2E Testing Plan

## Implementation Status

| Section | Status | Test Files |
|---------|--------|------------|
| 1. Authentication Tests | ✅ Implemented | `e2e/auth/sign-up.yaml`, `e2e/auth/sign-in.yaml`, `e2e/auth/sign-out.yaml`, `e2e/auth/oauth.yaml`, `e2e/auth/session.yaml` |
| 2. Onboarding Tests | ✅ Implemented | `e2e/onboarding/complete-flow.yaml`, `e2e/onboarding/skip-flow.yaml` |
| 3. Baby Management Tests | ✅ Implemented | `e2e/baby/add-baby.yaml`, `e2e/baby/edit-baby.yaml`, `e2e/baby/switch-baby.yaml` |
| 4. Feeding Tests | ✅ Implemented | `e2e/feeding/breastfeeding-timer.yaml`, `e2e/feeding/bottle-feeding.yaml`, `e2e/feeding/solid-food.yaml`, `e2e/feeding/manual-entry.yaml` |
| 5. Sleep Tests | ✅ Implemented | `e2e/sleep/sleep-timer.yaml`, `e2e/sleep/manual-entry.yaml` |
| 6. Diaper Tests | ✅ Implemented | `e2e/diaper/quick-log.yaml` |
| 7. Pumping Tests | ✅ Implemented | `e2e/pumping/pumping-timer.yaml` |
| 8. Growth Tests | ✅ Implemented | `e2e/growth/log-measurement.yaml`, `e2e/growth/view-charts.yaml` |
| 9. Tummy Time Tests | ✅ Implemented | `e2e/tummy-time/timer-and-goals.yaml` |
| 10. Timeline Tests | ✅ Implemented | `e2e/timeline/view-entries.yaml`, `e2e/timeline/edit-delete.yaml` |
| 11. Statistics Tests | ✅ Implemented | `e2e/statistics/view-stats.yaml` |
| 12. Settings Tests | ✅ Implemented | `e2e/settings/theme.yaml`, `e2e/settings/notifications.yaml`, `e2e/settings/export.yaml` |
| 13. Multi-Caregiver & Sync Tests | ✅ Implemented | `e2e/sync/household.yaml`, `e2e/sync/multi-device.yaml` |
| 14. Offline & Edge Case Tests | ✅ Implemented | `e2e/offline/offline-functionality.yaml` |
| 15. Performance Tests | ✅ Implemented | `e2e/performance/performance-benchmarks.yaml` |
| 16. Accessibility Tests | ✅ Implemented | `e2e/accessibility/screen-reader.yaml` |
| 17. Platform-Specific Tests | ✅ Implemented | `e2e/ios/ios-specific.yaml`, `e2e/android/android-specific.yaml` |

**CI/CD:** GitHub Actions workflow configured in `.github/workflows/e2e-tests.yml`

---

## Overview

This document outlines a comprehensive end-to-end testing strategy using Maestro to ensure the Baby Tracker app is bulletproof across all user flows, edge cases, and scenarios.

**Testing Tool:** Maestro (https://maestro.mobile.dev)
**Test Location:** `e2e/` directory
**Test Organization:** Grouped by feature area with naming convention `{feature}-{scenario}.yaml`

---

## Table of Contents

1. [Authentication Tests](#1-authentication-tests)
2. [Onboarding Tests](#2-onboarding-tests)
3. [Baby Management Tests](#3-baby-management-tests)
4. [Feeding Tests](#4-feeding-tests)
5. [Sleep Tests](#5-sleep-tests)
6. [Diaper Tests](#6-diaper-tests)
7. [Pumping Tests](#7-pumping-tests)
8. [Growth Tests](#8-growth-tests)
9. [Tummy Time Tests](#9-tummy-time-tests)
10. [Timeline Tests](#10-timeline-tests)
11. [Statistics Tests](#11-statistics-tests)
12. [Settings Tests](#12-settings-tests)
13. [Multi-Caregiver & Sync Tests](#13-multi-caregiver--sync-tests)
14. [Offline & Edge Case Tests](#14-offline--edge-case-tests)
15. [Performance Tests](#15-performance-tests)
16. [Accessibility Tests](#16-accessibility-tests)
17. [Platform-Specific Tests](#17-platform-specific-tests)

---

## 1. Authentication Tests

### 1.1 Sign Up Flow
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| AUTH-001 | Email sign up - happy path | Enter valid email, password, display name → Submit | Account created, redirected to onboarding |
| AUTH-002 | Email sign up - invalid email | Enter "notanemail" → Submit | Shows "Invalid email" error |
| AUTH-003 | Email sign up - weak password | Enter password "123" → Submit | Shows password requirements error |
| AUTH-004 | Email sign up - existing email | Enter existing user's email → Submit | Shows "Email already registered" error |
| AUTH-005 | Email sign up - empty fields | Leave fields empty → Submit | Submit button disabled or shows required errors |
| AUTH-006 | Sign up - network error | Disable network → Submit | Shows "No internet" error with retry option |

### 1.2 Sign In Flow
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| AUTH-010 | Email sign in - happy path | Enter valid credentials → Sign in | Signed in, redirected to home |
| AUTH-011 | Email sign in - wrong password | Enter incorrect password → Sign in | Shows "Invalid credentials" error |
| AUTH-012 | Email sign in - non-existent email | Enter unregistered email → Sign in | Shows "User not found" or generic error |
| AUTH-013 | Magic link request | Enter email → Request magic link | Shows success message |
| AUTH-014 | Magic link click | Click magic link in email | App opens, user signed in |

### 1.3 OAuth Sign In
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| AUTH-020 | Google OAuth - happy path | Tap "Continue with Google" → Complete OAuth | Signed in, redirected appropriately |
| AUTH-021 | Google OAuth - cancelled | Tap Google → Cancel in browser | Returns to sign in, no error |
| AUTH-022 | Apple Sign In - happy path | Tap "Continue with Apple" → Complete | Signed in |
| AUTH-023 | Apple Sign In - cancelled | Tap Apple → Cancel | Returns to sign in |

### 1.4 Sign Out
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| AUTH-030 | Sign out - confirm | Go to Settings → Sign Out → Confirm | Signed out, local data cleared, redirected to sign in |
| AUTH-031 | Sign out - cancel | Go to Settings → Sign Out → Cancel | Stays signed in |
| AUTH-032 | Sign out - network error | Disable network → Sign out | Still signs out locally |

### 1.5 Session Management
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| AUTH-040 | Session persistence | Sign in → Kill app → Reopen | Still signed in |
| AUTH-041 | Session expiry | Wait for session to expire → Interact | Shows re-auth prompt |
| AUTH-042 | Token refresh | Wait near token expiry → Continue using | Token refreshed silently |

---

## 2. Onboarding Tests

### 2.1 First Launch Flow
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| ONB-001 | Complete onboarding | View all screens → Add baby → Continue | Baby created, redirected to home |
| ONB-002 | Skip onboarding | Tap Skip on first screen | Goes to home, onboarding marked complete |
| ONB-003 | Navigation between screens | Tap Next/Back through all screens | Can navigate forward and back |
| ONB-004 | Onboarding not shown again | Complete onboarding → Kill app → Reopen | Goes directly to home |

### 2.2 Baby Setup During Onboarding
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| ONB-010 | Add baby - valid data | Enter name, birth date → Continue | Baby created successfully |
| ONB-011 | Add baby - no name | Leave name empty → Continue | Shows name required error |
| ONB-012 | Add baby - future birth date | Select date in future → Continue | Shows invalid date error |
| ONB-013 | Add baby - very old birth date | Select date > 5 years ago → Continue | Shows warning or allows it |

### 2.3 Edge Cases
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| ONB-020 | Kill app mid-onboarding | Go to screen 2 → Kill app → Reopen | Resumes from beginning or last step |
| ONB-021 | Deep link during onboarding | Receive deep link → Tap | Completes onboarding first or queues deep link |
| ONB-022 | Rapid taps on Next | Tap Next multiple times quickly | Only advances once per tap |

---

## 3. Baby Management Tests

### 3.1 Add Baby
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| BABY-001 | Add baby from home | Tap baby selector → Add Baby → Fill form → Save | Baby added, selected as active |
| BABY-002 | Add second baby | Already have 1 baby → Add another | Both babies in selector |
| BABY-003 | Add baby - validation | Enter invalid data → Save | Shows appropriate errors |
| BABY-004 | Add baby - cancel | Start adding → Tap cancel | Returns without saving |

### 3.2 Edit Baby
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| BABY-010 | Edit baby name | Edit baby → Change name → Save | Name updated throughout app |
| BABY-011 | Edit birth date | Edit baby → Change date → Save | Date updated, age recalculated |
| BABY-012 | Edit baby - unsaved changes | Edit baby → Make changes → Navigate away | Shows "Discard changes?" prompt |
| BABY-013 | Edit baby - cancel | Edit baby → Change data → Cancel | Reverts to original data |

### 3.3 Switch Baby
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| BABY-020 | Switch active baby | Tap baby selector → Select different baby | All screens show new baby's data |
| BABY-021 | Active timer while switching | Have timer running → Switch baby | Timer continues for original baby |
| BABY-022 | Selected baby persistence | Select baby → Kill app → Reopen | Same baby still selected |

### 3.4 Delete Baby
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| BABY-030 | Delete baby - confirm | Edit baby → Delete → Confirm | Baby deleted, data removed |
| BABY-031 | Delete only baby | Delete last baby | Creates new empty baby or goes to add baby |
| BABY-032 | Delete baby - cancel | Edit baby → Delete → Cancel | Baby not deleted |

---

## 4. Feeding Tests

### 4.1 Breastfeeding Timer
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| FEED-001 | Start breastfeeding - left | Tap Feed card → Breastfeeding tab → Left side | Timer starts, "Left" highlighted |
| FEED-002 | Start breastfeeding - right | Same as above → Right side | Timer starts, "Right" highlighted |
| FEED-003 | Switch sides during feeding | Start Left → Tap Right | Left timer pauses, Right starts |
| FEED-004 | Resume paused side | Start Left → Switch to Right → Tap Left again | Left timer resumes |
| FEED-005 | Stop feeding | Start timer → Tap Stop | Feeding saved with correct durations |
| FEED-006 | Dual-side tracking | Feed on Left 5 min → Switch to Right 8 min → Stop | Shows "L: 5m, R: 8m" in timeline |
| FEED-007 | Side memory | Complete feeding on Right → Start new feeding | Right side suggested (opposite of last) |
| FEED-008 | Timer survives app background | Start timer → Background app 2 min → Return | Timer shows ~2 min elapsed |
| FEED-009 | Timer survives app kill | Start timer → Kill app → Reopen | Timer restored, continues counting |

### 4.2 Bottle Feeding
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| FEED-020 | Log bottle - formula | Tap Feed → Bottle tab → Enter 4oz → Formula → Save | Bottle feeding saved |
| FEED-021 | Log bottle - breast milk | Same → Breast milk selected | Saves with breast milk type |
| FEED-022 | Quick amount buttons | Tap 2oz quick button | Amount field shows "2 oz" |
| FEED-023 | Toggle ml/oz | Tap unit toggle | Units switch, amounts convert |
| FEED-024 | Zero amount | Try to save with 0 amount | Shows error or prevents save |
| FEED-025 | Very large amount | Enter 50oz | Accepts (some babies drink a lot) or shows warning |

### 4.3 Solid Food
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| FEED-030 | Log solids - common food | Tap Feed → Solids tab → Select "Banana" → Loved → Save | Solid feeding saved |
| FEED-031 | Log solids - custom food | Type custom food name → Save | Custom food saved |
| FEED-032 | Log solids - reaction "Meh" | Select food → Meh reaction → Save | Saves with "Meh" reaction |
| FEED-033 | Log solids - reaction "Refused" | Select food → Refused → Save | Saves with "Refused" reaction |
| FEED-034 | Recent foods shown | Log "Avocado" → Open solids again | "Avocado" appears in recent foods |
| FEED-035 | Empty food | Try to save with no food selected | Shows error |

### 4.4 Manual/Past Feeding Entry
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| FEED-040 | Log past breastfeeding | Tap "Log Past" → Set time 2 hours ago → 15 min duration | Entry created with correct time |
| FEED-041 | Log past bottle | Same for bottle feeding | Bottle entry at past time |
| FEED-042 | Future time validation | Try to set time in future | Shows error, prevents save |
| FEED-043 | Quick duration buttons | Tap "10 min" quick button | Duration set to 10 minutes |
| FEED-044 | Manual entry - cancel | Start manual entry → Cancel | Returns without saving |

### 4.5 Feeding Tab Memory
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| FEED-050 | Tab remembers last feeding type | Log breastfeeding → Close → Open Feed screen | Breastfeeding tab selected |
| FEED-051 | Tab based on actual feeding | Log bottle → Open Feed screen | Bottle tab selected |

---

## 5. Sleep Tests

### 5.1 Sleep Timer
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SLEEP-001 | Start sleep timer | Tap Sleep card → Start Sleep | Timer starts |
| SLEEP-002 | Auto-detect nap (daytime) | Start sleep at 2pm | Auto-selects "Nap" |
| SLEEP-003 | Auto-detect night (evening) | Start sleep at 9pm | Auto-selects "Night Sleep" |
| SLEEP-004 | Override sleep type | Auto-detected as Nap → Change to Night | Type changed to Night |
| SLEEP-005 | Stop sleep timer | Start timer → Wait → Stop | Sleep saved with duration |
| SLEEP-006 | Timer survives background | Start timer → Background app → Return | Timer continues |
| SLEEP-007 | Timer survives kill | Start timer → Kill app → Reopen | Timer restored |

### 5.2 Manual Sleep Entry
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SLEEP-010 | Log past nap | Tap "Log Past" → Set time → 45 min duration → Nap | Nap entry created |
| SLEEP-011 | Log past night sleep | Same → Night Sleep → 8 hours | Night sleep entry created |
| SLEEP-012 | Quick duration buttons | Tap "30 min" button | Duration set to 30 min |
| SLEEP-013 | Very long sleep | Enter 15 hours | Accepts or shows warning |
| SLEEP-014 | Very short sleep | Enter 1 minute | Accepts |

### 5.3 Sleep Goals
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SLEEP-020 | Age-based goal shown | Baby is 3 months old | Shows appropriate sleep goal (14-15h) |
| SLEEP-021 | Custom goal | Go to Sleep Settings → Set custom goal | Custom goal used |
| SLEEP-022 | Goal progress | Log sleep → Check home dashboard | Progress bar updates |

---

## 6. Diaper Tests

### 6.1 Quick Diaper Log
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| DIAPER-001 | Log wet diaper | Tap Diaper card → Wet → Save | Wet diaper saved |
| DIAPER-002 | Log dirty diaper | Tap Diaper → Dirty → Select color → Save | Dirty diaper with color saved |
| DIAPER-003 | Log mixed diaper | Tap Diaper → Mixed → Select color → Save | Mixed diaper saved |
| DIAPER-004 | Stool color picker | Tap Dirty → View color options | Shows all 7 color options |
| DIAPER-005 | Stool color selection | Select "Green" color → Save | Saves with green color |

### 6.2 Manual Diaper Entry
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| DIAPER-010 | Log past diaper | Tap "Log Past" → Set time 1 hour ago → Wet → Save | Entry at past time |
| DIAPER-011 | Future time validation | Try to set future time | Shows error |

### 6.3 Edge Cases
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| DIAPER-020 | Rapid logging | Log 5 diapers in quick succession | All 5 saved correctly |
| DIAPER-021 | Cancel without saving | Open diaper screen → Select Wet → Navigate away | No diaper saved |

---

## 7. Pumping Tests

### 7.1 Pumping Timer
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| PUMP-001 | Start pumping - left | Tap Pumping card → Left → Start | Timer starts for left side |
| PUMP-002 | Start pumping - right | Same → Right | Timer starts for right |
| PUMP-003 | Start pumping - both | Same → Both | Timer starts for both |
| PUMP-004 | Enter volume on stop | Start → Stop → Enter 4oz | Pumping saved with volume |
| PUMP-005 | Skip volume | Start → Stop → Skip volume entry | Saves with no volume |
| PUMP-006 | Timer survives background | Start → Background → Return | Timer continues |

### 7.2 Manual Pumping Entry
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| PUMP-010 | Log past pumping | Tap "Log Past" → Set details → Save | Pumping entry created |
| PUMP-011 | Quick duration buttons | Tap "15 min" | Duration set |
| PUMP-012 | Zero volume | Try to save with 0 volume | Allows (pumping can have no output) |

---

## 8. Growth Tests

### 8.1 Log Growth Measurement
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| GROWTH-001 | Log weight only | Tap Growth card → Enter weight → Save | Weight saved |
| GROWTH-002 | Log all measurements | Enter weight, height, head → Save | All measurements saved |
| GROWTH-003 | Unit toggle - weight | Toggle kg/lbs | Units switch, values convert |
| GROWTH-004 | Unit toggle - height | Toggle cm/in | Units switch, values convert |
| GROWTH-005 | Invalid weight | Enter negative or very large weight | Shows error |
| GROWTH-006 | Partial measurements | Enter only height → Save | Saves with only height |

### 8.2 Growth Charts
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| GROWTH-010 | View weight chart | Tap Growth → Charts → Weight tab | Shows WHO weight chart |
| GROWTH-011 | View height chart | Same → Height tab | Shows WHO height chart |
| GROWTH-012 | View head chart | Same → Head tab | Shows WHO head chart |
| GROWTH-013 | Percentile displayed | Log weight → View chart | Shows percentile (e.g., "50th percentile") |
| GROWTH-014 | Multiple measurements | Log 3 weights → View chart | All 3 plotted on chart |
| GROWTH-015 | Gender-specific data | Male baby → View chart | Uses male WHO data |

### 8.3 Edge Cases
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| GROWTH-020 | No measurements | New baby → View charts | Shows empty state with guidance |
| GROWTH-021 | Outlier measurement | Enter weight far outside normal | Shows warning or accepts with flag |

---

## 9. Tummy Time Tests

### 9.1 Tummy Time Timer
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| TUMMY-001 | Start timer | Tap Tummy Time card → Start | Timer starts |
| TUMMY-002 | Stop timer | Start → Stop | Session saved |
| TUMMY-003 | Progress toward goal | Start → Stop → Check home | Progress % updates |
| TUMMY-004 | Goal completion | Complete daily goal | Shows celebration/completion indicator |
| TUMMY-005 | Timer survives background | Start → Background → Return | Timer continues |

### 9.2 Manual Tummy Time Entry
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| TUMMY-010 | Log past session | Tap "Log Past" → 5 min → Save | Session created |
| TUMMY-011 | Quick duration buttons | Tap "3 min" button | Duration set to 3 min |
| TUMMY-012 | Counts toward goal | Log manual 10 min → Check progress | Progress increases by 10 min |

### 9.3 Tummy Time Goals
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| TUMMY-020 | Age-based default goal | Baby 2 months → Check goal | Shows ~30 min default |
| TUMMY-021 | Custom goal | Go to Settings → Set 45 min goal | Custom goal applied |
| TUMMY-022 | Goal suggestion at milestone | Baby turns 3 months | Shows goal increase suggestion |

---

## 10. Timeline Tests

### 10.1 View Timeline
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| TIME-001 | View all entries | Go to Timeline tab | Shows all entries in reverse chronological order |
| TIME-002 | Day headers | View timeline with entries on multiple days | Shows day headers ("Today", "Yesterday", dates) |
| TIME-003 | Activity types | Log different activities → View timeline | Each type shows with correct icon/color |
| TIME-004 | Empty timeline | New baby with no entries | Shows helpful empty state |
| TIME-005 | Infinite scroll | Have 100+ entries → Scroll to bottom | Loads older entries as you scroll |
| TIME-006 | Pull to refresh | Pull down on timeline | Refreshes entries |

### 10.2 Edit Entry
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| TIME-010 | Edit feeding | Tap feeding entry → Change side → Save | Entry updated |
| TIME-011 | Edit sleep | Tap sleep → Change duration → Save | Entry updated |
| TIME-012 | Edit diaper | Tap diaper → Change color → Save | Entry updated |
| TIME-013 | Unsaved changes warning | Edit entry → Make changes → Navigate away | Shows "Discard?" prompt |
| TIME-014 | Cancel edit | Edit → Change → Cancel | Reverts to original |

### 10.3 Delete Entry
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| TIME-020 | Delete entry - confirm | Tap entry → Delete → Confirm | Entry deleted from timeline |
| TIME-021 | Delete entry - cancel | Tap entry → Delete → Cancel | Entry not deleted |
| TIME-022 | Delete multiple entries | Delete 3 entries in a row | All 3 deleted correctly |

### 10.4 Filter/Search (if implemented)
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| TIME-030 | Filter by activity type | Select "Feeding" filter | Shows only feeding entries |
| TIME-031 | Filter by date range | Select "Last 7 days" | Shows only entries from last week |

---

## 11. Statistics Tests

### 11.1 View Statistics
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| STATS-001 | View daily stats | Go to Statistics tab | Shows today's summary |
| STATS-002 | View weekly stats | Toggle to "Weekly" | Shows weekly summary |
| STATS-003 | Feeding stats | View stats with feedings logged | Shows feeding count, total time/volume |
| STATS-004 | Sleep stats | View stats with sleep logged | Shows total sleep, nap count |
| STATS-005 | Diaper stats | View stats | Shows wet/dirty counts |
| STATS-006 | Tummy time stats | View stats | Shows total time, goal progress |
| STATS-007 | Empty state | New baby → View stats | Shows helpful empty state |

### 11.2 Trends & Insights
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| STATS-010 | Week-over-week trend | Have 2 weeks of data → View | Shows trend arrows (↑↓→) |
| STATS-011 | Insight generation | Significant change in sleep → View | Shows insight about sleep change |
| STATS-012 | Bar charts | View weekly stats | Shows bar chart for feedings/diapers |

### 11.3 Edge Cases
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| STATS-020 | Only 1 day of data | View weekly stats | Shows partial data with note |
| STATS-021 | Very active day | Log 50 activities → View stats | Handles large numbers gracefully |

---

## 12. Settings Tests

### 12.1 Theme Settings
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SET-001 | Switch to dark mode | Settings → Theme → Dark | App switches to dark mode |
| SET-002 | Switch to light mode | Settings → Theme → Light | App switches to light mode |
| SET-003 | System default | Settings → Theme → System | Follows system theme |
| SET-004 | Night mode | Settings → Theme → Night | Red-tinted overlay appears |
| SET-005 | Theme persistence | Set dark mode → Kill app → Reopen | Dark mode persists |

### 12.2 Notification Settings
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SET-010 | Enable feeding reminders | Settings → Notifications → Enable → Set 3h | Reminders scheduled |
| SET-011 | Disable feeding reminders | Disable reminders | Reminders cancelled |
| SET-012 | Timer alerts toggle | Toggle timer alerts | Alerts enabled/disabled |
| SET-013 | Quiet hours | Enable quiet hours 10pm-7am | No notifications during quiet hours |
| SET-014 | Permission denied | Deny notification permission | Shows graceful message |

### 12.3 Export Settings
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SET-020 | CSV export - all data | Export → Select all types → Export | Downloads CSV with all data |
| SET-021 | CSV export - date range | Export → Last 7 days → Export | CSV contains only last 7 days |
| SET-022 | CSV opens in Excel | Export → Open file in Excel/Sheets | File opens correctly |
| SET-023 | PDF report | Reports → Select sections → Generate | PDF generated |
| SET-024 | Share PDF | Generate PDF → Share | Share sheet opens |

### 12.4 Account Settings
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SET-030 | View account info | Settings → Profile | Shows email, display name |
| SET-031 | Delete account - confirm | Delete Account → Type "DELETE" → Confirm | Account and data deleted |
| SET-032 | Delete account - cancel | Delete Account → Cancel | Account not deleted |
| SET-033 | Delete account - offline | Disable network → Try to delete | Shows "requires internet" error |

### 12.5 Unit Preferences
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SET-040 | Toggle weight units | Settings → Units → kg/lbs toggle | Growth screen uses new unit |
| SET-041 | Toggle volume units | Settings → Units → ml/oz toggle | Feeding screens use new unit |
| SET-042 | Toggle height units | Settings → Units → cm/in toggle | Growth screen uses new unit |

---

## 13. Multi-Caregiver & Sync Tests

### 13.1 Household Management
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SYNC-001 | View invite code | Settings → Household | Shows formatted invite code (XXXX-XXXX) |
| SYNC-002 | Copy invite code | Tap copy button | Code copied to clipboard |
| SYNC-003 | Share invite code | Tap share button | Share sheet opens |
| SYNC-004 | Regenerate code | Regenerate → Confirm | New code generated |

### 13.2 Join Household
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SYNC-010 | Join with valid code | Settings → Join Household → Enter code → Join | Joined household, sees shared babies |
| SYNC-011 | Invalid code format | Enter "ABC" | Shows format error |
| SYNC-012 | Non-existent code | Enter correctly formatted but invalid code | Shows "code not found" error |
| SYNC-013 | Expired code (if applicable) | Enter expired code | Shows appropriate error |

### 13.3 Real-Time Sync
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SYNC-020 | Sync feeding between devices | Device A logs feeding → Check Device B | Feeding appears on Device B < 5 seconds |
| SYNC-021 | Sync sleep between devices | Device A starts sleep → Check Device B | Sleep timer visible on Device B |
| SYNC-022 | Sync edit | Device A edits entry → Check Device B | Edit reflected on Device B |
| SYNC-023 | Sync delete | Device A deletes entry → Check Device B | Entry removed on Device B |
| SYNC-024 | Timer sync | Device A starts timer → Device B sees it | Both show same timer state |

### 13.4 Conflict Resolution
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SYNC-030 | Simultaneous edit | Both devices edit same entry → Save | Last write wins, no data loss |
| SYNC-031 | Edit vs delete | Device A edits, Device B deletes same entry | Edit preserved (or clear resolution) |
| SYNC-032 | Offline queue | Go offline → Log 3 activities → Go online | All 3 sync correctly |

### 13.5 Caregiver Management
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| SYNC-040 | View caregivers | Settings → Household | Shows list of household members |
| SYNC-041 | Remove caregiver (owner only) | Remove caregiver → Confirm | Caregiver removed from household |
| SYNC-042 | Leave household | Leave Household → Confirm | User leaves, can no longer see shared data |

---

## 14. Offline & Edge Case Tests

### 14.1 Offline Functionality
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| OFFLINE-001 | View data offline | Disable network → View timeline | Timeline loads from cache |
| OFFLINE-002 | Log activity offline | Disable network → Log feeding | Feeding saved locally |
| OFFLINE-003 | Start timer offline | Disable network → Start sleep timer | Timer works normally |
| OFFLINE-004 | Queue syncs when online | Log 5 activities offline → Enable network | All 5 sync to server |
| OFFLINE-005 | Offline indicator | Disable network | Shows offline banner/indicator |

### 14.2 Timer Edge Cases
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| EDGE-001 | Timer > 24 hours | Start timer → Wait 24h (or mock time) | Timer continues, maybe shows warning |
| EDGE-002 | Timezone change during timer | Start timer → Change timezone | Timer unaffected (uses UTC) |
| EDGE-003 | Device restart during timer | Start timer → Restart device | Timer restored after restart |
| EDGE-004 | Multiple active timers | Start feeding timer → Try to start sleep | Handles gracefully (allow both or prompt) |
| EDGE-005 | Daylight saving transition | Start timer → DST transition occurs | Timer calculates correctly |

### 14.3 Data Edge Cases
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| EDGE-010 | Sleep spanning midnight | Start sleep at 11pm → Stop at 6am | Correctly shows as single entry |
| EDGE-011 | Very long sleep (multi-day) | Log 36-hour sleep | Handled gracefully |
| EDGE-012 | Large dataset (5000+ entries) | Have 5000 entries → Use app | Performance remains acceptable |
| EDGE-013 | Special characters in notes | Enter emoji, unicode in notes → Save | Characters preserved |
| EDGE-014 | Very long notes | Enter 1000 character note | Accepts or truncates gracefully |
| EDGE-015 | Rapid activity logging | Log 10 activities in 30 seconds | All saved correctly |

### 14.4 Memory & Performance
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| EDGE-020 | Low memory condition | Use app in low memory state | App doesn't crash |
| EDGE-021 | Storage nearly full | Use app with little storage | Graceful error if can't save |
| EDGE-022 | Background for extended time | Background app for 1 hour → Return | App resumes correctly |

---

## 15. Performance Tests

### 15.1 Launch Performance
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| PERF-001 | Cold start time | Kill app → Launch → Time to interactive | < 2 seconds |
| PERF-002 | Warm start time | Background app → Resume | < 0.5 seconds |
| PERF-003 | First load with data | Open timeline with 100 entries | < 1 second to render |

### 15.2 Scroll Performance
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| PERF-010 | Timeline scroll | Scroll through 500 entries rapidly | Smooth, 60 FPS |
| PERF-011 | Statistics scroll | Scroll statistics screen | Smooth scrolling |

### 15.3 Sync Performance
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| PERF-020 | Initial sync | New device → Sign in → Initial sync | < 10 seconds for typical data |
| PERF-021 | Incremental sync | Make change → Sync to other device | < 5 seconds |
| PERF-022 | Large offline queue | 100 queued changes → Go online | Syncs within 1 minute |

---

## 16. Accessibility Tests

### 16.1 Screen Reader
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| A11Y-001 | Navigate with VoiceOver | Enable VoiceOver → Navigate entire app | All screens navigable |
| A11Y-002 | Navigate with TalkBack | Enable TalkBack → Navigate entire app | All screens navigable |
| A11Y-003 | All buttons labeled | Navigate to each button | Descriptive labels announced |
| A11Y-004 | Timer announced | Start timer → Listen | "Timer started" announced |
| A11Y-005 | Errors announced | Trigger error → Listen | Error message announced |

### 16.2 Visual Accessibility
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| A11Y-010 | Large font size | Set largest font → Use app | All text readable, not truncated |
| A11Y-011 | High contrast | Enable high contrast mode | App remains usable |
| A11Y-012 | Color contrast | Check all text/backgrounds | Meets WCAG AA (4.5:1) |
| A11Y-013 | Touch targets | Check all interactive elements | All >= 44x44 points |

### 16.3 Reduced Motion
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| A11Y-020 | Reduced motion enabled | Enable reduced motion → Use app | Animations minimized/disabled |

---

## 17. Platform-Specific Tests

### 17.1 iOS Specific
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| IOS-001 | Face ID/Touch ID | If biometrics enabled → Launch app | Prompts for biometrics |
| IOS-002 | System appearance | Change iOS appearance → Check app | App theme follows (if system default) |
| IOS-003 | Deep link handling | Receive deep link → Tap | Opens correct screen |
| IOS-004 | Share extension | Share to app (if applicable) | Data received correctly |
| IOS-005 | iOS notification actions | Receive notification → Tap action | Action handled correctly |

### 17.2 Android Specific
| Test ID | Scenario | Steps | Expected Result |
|---------|----------|-------|-----------------|
| AND-001 | Back button behavior | Navigate deep → Press back repeatedly | Navigates back correctly |
| AND-002 | Task switching | Switch to other app → Return | State preserved |
| AND-003 | Split screen mode | Open in split screen | App usable |
| AND-004 | Android notification channels | Check Settings → Apps → Notifications | Correct channels listed |
| AND-005 | Battery optimization | Check app is not aggressively killed | Timers survive |

---

## Test Execution Guide

### Prerequisites
1. Install Maestro CLI: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Build app for testing: `npx expo run:ios` or `npx expo run:android`
3. Create test data fixtures in `e2e/fixtures/`

### Running Tests

```bash
# Run all tests
maestro test e2e/

# Run specific test file
maestro test e2e/feeding/breastfeeding-timer.yaml

# Run tests matching pattern
maestro test e2e/ --include-tags "critical"

# Run with specific device
maestro test e2e/ --device "iPhone 15 Pro"
```

### Test File Structure

```
e2e/
├── flows/
│   └── shared-flows.yaml           # Reusable flows (sign in, add baby, etc.)
├── auth/
│   ├── sign-up.yaml
│   ├── sign-in.yaml
│   ├── sign-out.yaml
│   └── oauth.yaml
├── onboarding/
│   ├── complete-flow.yaml
│   └── skip-flow.yaml
├── baby/
│   ├── add-baby.yaml
│   ├── edit-baby.yaml
│   └── switch-baby.yaml
├── feeding/
│   ├── breastfeeding-timer.yaml
│   ├── bottle-feeding.yaml
│   ├── solid-food.yaml
│   └── manual-entry.yaml
├── sleep/
│   ├── sleep-timer.yaml
│   └── manual-entry.yaml
├── diaper/
│   └── quick-log.yaml
├── pumping/
│   └── pumping-timer.yaml
├── growth/
│   ├── log-measurement.yaml
│   └── view-charts.yaml
├── tummy-time/
│   └── timer-and-goals.yaml
├── timeline/
│   ├── view-entries.yaml
│   └── edit-delete.yaml
├── statistics/
│   └── view-stats.yaml
├── settings/
│   ├── theme.yaml
│   ├── notifications.yaml
│   └── export.yaml
├── sync/
│   ├── household.yaml
│   └── multi-device.yaml
├── offline/
│   └── offline-functionality.yaml
├── performance/
│   └── performance-benchmarks.yaml
└── accessibility/
    └── screen-reader.yaml
```

### Sample Maestro Test File

```yaml
# e2e/feeding/breastfeeding-timer.yaml
appId: com.sofibaby.app
---
# Test: Start breastfeeding timer on left side
- launchApp
- assertVisible: "Feed"
- tapOn: "Feed"
- assertVisible: "Breastfeeding"
- tapOn: "Left"
- assertVisible:
    id: "timer-display"
- extendedWaitUntil:
    visible: "0:00:05"
    timeout: 10000
- tapOn: "Stop"
- assertVisible: "Feeding saved"

# Verify in timeline
- tapOn: "Timeline"
- assertVisible: "Left Breast"
```

---

## Prioritization

### Critical Path Tests (Must Pass Before Release)
- AUTH-001, AUTH-010 (Sign up/in)
- ONB-001 (Onboarding)
- BABY-001 (Add baby)
- FEED-001, FEED-009 (Breastfeeding timer + persistence)
- FEED-020 (Bottle feeding)
- SLEEP-001, SLEEP-007 (Sleep timer + persistence)
- DIAPER-001 (Quick diaper log)
- TIME-001, TIME-010, TIME-020 (Timeline view, edit, delete)
- SET-001 (Theme)
- OFFLINE-002, OFFLINE-004 (Offline logging + sync)

### High Priority Tests
- All feeding tests (FEED-*)
- All sleep tests (SLEEP-*)
- All timer persistence tests
- Sync tests (SYNC-020 through SYNC-024)
- Export tests (SET-020, SET-023)

### Medium Priority Tests
- Growth tests (GROWTH-*)
- Tummy time tests (TUMMY-*)
- Statistics tests (STATS-*)
- Accessibility tests (A11Y-*)

### Lower Priority Tests
- Performance benchmarks (PERF-*)
- Platform-specific edge cases
- Very rare edge cases

---

## Continuous Integration

### CI Configuration

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am

jobs:
  e2e-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Build iOS
        run: npx expo run:ios --configuration Release
      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash
      - name: Run E2E tests
        run: maestro test e2e/ --format junit --output e2e-results.xml
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results-ios
          path: e2e-results.xml

  e2e-android:
    runs-on: ubuntu-latest
    steps:
      # Similar steps for Android
```

---

## Test Data Management

### Fixtures

Create reusable test data fixtures:

```yaml
# e2e/fixtures/test-user.yaml
email: "test-user-{{timestamp}}@example.com"
password: "TestPassword123!"
displayName: "Test User"
```

```yaml
# e2e/fixtures/test-baby.yaml
name: "Test Baby"
birthDate: "2024-06-15"
gender: "female"
```

### Database Seeding

For complex scenarios, seed test database:

```bash
# Before test suite
npm run e2e:seed

# After test suite
npm run e2e:cleanup
```

---

## Reporting

### Test Report Template

After each test run, generate report including:
- Total tests: X
- Passed: X
- Failed: X
- Skipped: X
- Duration: X minutes
- Screenshots of failures
- Video recordings of failures
- Device/OS information

### Failure Investigation

For each failure, document:
1. Test ID
2. Steps to reproduce
3. Expected vs actual result
4. Screenshot/video
5. Logs
6. Root cause (if known)
7. Fix status

---

## Maintenance

### Test Maintenance Checklist

- [ ] Review and update tests after each feature release
- [ ] Remove obsolete tests
- [ ] Add tests for new features
- [ ] Update test data fixtures
- [ ] Review and fix flaky tests
- [ ] Update CI configuration as needed
- [ ] Keep Maestro CLI updated
- [ ] Review test coverage quarterly

---

## Definition of Done for E2E Testing

Before release, the following must be true:

- [ ] All critical path tests passing (100%)
- [ ] All high priority tests passing (>95%)
- [ ] All medium priority tests passing (>90%)
- [ ] No known flaky tests
- [ ] Tests run in CI on every PR
- [ ] Test failures investigated and resolved
- [ ] E2E test coverage documented
- [ ] Manual smoke test completed on real devices
