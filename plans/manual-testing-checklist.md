# Baby Tracker App - Manual Testing Checklist

This checklist covers all implemented features that need manual testing before release.

---

## Pre-Testing Setup

- [ ] Fresh install the app (delete and reinstall)
- [ ] Test on iOS simulator/device
- [ ] Test on Android emulator/device
- [ ] Have a way to force-kill the app for timer persistence tests

---

## 1. Baby Profile Management

### 1.1 Add Baby
- [ ] Tap "Add Baby" from empty state or profile screen
- [ ] Enter baby name (required) - verify validation error shows if empty
- [ ] Select birth date - verify cannot select future date
- [ ] Select gender (optional)
- [ ] Save baby profile
- [ ] Verify baby appears in BabyHeader

### 1.2 Edit Baby
- [ ] Tap on baby name in header to open selector
- [ ] Tap edit icon/button on a baby
- [ ] Change baby name - verify it updates
- [ ] Change birth date - verify it updates
- [ ] Cancel edit - verify changes are not saved

### 1.3 Multiple Babies
- [ ] Add a second baby
- [ ] Tap BabyHeader to see baby selector dropdown
- [ ] Switch between babies
- [ ] Verify dashboard data changes when switching babies
- [ ] Verify timeline shows entries for selected baby only
- [ ] Close and reopen app - verify last selected baby is remembered

### 1.4 Edge Cases
- [ ] Try to save baby with very long name (50+ characters)
- [ ] Try to set birth date to exactly today
- [ ] Delete all babies - verify empty state shows

---

## 2. Navigation & UI

### 2.1 Tab Navigation
- [ ] Home tab shows dashboard with activity cards
- [ ] Timeline tab shows chronological entries
- [ ] Stats tab shows statistics (basic view)
- [ ] Profile tab shows settings and baby info

### 2.2 Dark Mode
- [ ] Change device to dark mode
- [ ] Verify all screens render correctly in dark mode
- [ ] Verify text is readable in dark mode
- [ ] Verify activity colors are visible in dark mode
- [ ] Switch back to light mode - verify it updates

### 2.3 Dashboard Cards
- [ ] All 6 activity cards visible (Feeding, Sleep, Diaper, Pumping, Growth, Tummy Time)
- [ ] Each card shows "time since" last entry (or appropriate default)
- [ ] Each card has correct activity color
- [ ] Tapping each card navigates to correct screen

---

## 3. Feeding - Breastfeeding

### 3.1 Timer Flow
- [ ] Tap Feeding card → Opens tabbed feeding screen
- [ ] Breastfeeding tab is selected (or last used tab)
- [ ] Tap Left side button → Timer starts
- [ ] Timer counts up correctly (verify seconds)
- [ ] Switch to Right side during feeding → Timer continues, side changes
- [ ] Stop timer → Feeding saved
- [ ] Verify feeding appears in Timeline

### 3.2 Side Memory
- [ ] Complete a feeding on Left side
- [ ] Start new feeding → Right side should be suggested/highlighted
- [ ] Complete feeding on Right side
- [ ] Start new feeding → Left side should be suggested/highlighted

### 3.3 Timer Persistence - App Background
- [ ] Start breastfeeding timer
- [ ] Background the app (press home)
- [ ] Wait 30 seconds
- [ ] Return to app
- [ ] Verify timer shows correct elapsed time (~30 seconds)

### 3.4 Timer Persistence - App Kill
- [ ] Start breastfeeding timer
- [ ] Note the time on timer
- [ ] Force kill the app
- [ ] Wait 60 seconds
- [ ] Reopen app
- [ ] Verify timer is still running with correct time

### 3.5 Manual Entry (Log Past Breastfeeding)
- [ ] Go to Feeding screen → Breastfeeding tab
- [ ] Tap "Log Past" button
- [ ] Select start time in the past (e.g., 2 hours ago)
- [ ] Select duration using quick buttons (5, 10, 15, 20, 30, 45 min)
- [ ] Select side (Left/Right)
- [ ] Save → Verify entry appears in Timeline with correct time

### 3.6 Manual Entry Validation
- [ ] Try to select a future start time → Should show error/be prevented
- [ ] Try to enter duration < 1 minute → Should show error
- [ ] Try to enter duration > 2 hours → Should show error

---

## 4. Feeding - Bottle

### 4.1 Basic Flow
- [ ] Go to Feeding screen → Bottle tab
- [ ] Select content type: Formula
- [ ] Enter amount using quick buttons (1oz, 2oz, 3oz, etc.)
- [ ] Save → Verify entry in Timeline shows "Formula · X oz"

### 4.2 Content Types
- [ ] Log bottle with Formula selected
- [ ] Log bottle with Breast Milk selected
- [ ] Verify both appear correctly in Timeline

### 4.3 Volume Units
- [ ] Toggle to ml display
- [ ] Verify quick buttons show ml values (30ml, 60ml, etc.)
- [ ] Enter amount in ml
- [ ] Verify Timeline shows amount in selected unit

### 4.4 Manual Entry (Log Past Bottle)
- [ ] Tap "Log Past" in Bottle tab
- [ ] Select past time
- [ ] Select content type
- [ ] Enter volume
- [ ] Save → Verify in Timeline

---

## 5. Feeding - Solid Food

### 5.1 Basic Flow
- [ ] Go to Feeding screen → Solids tab
- [ ] Enter food type (e.g., "Banana")
- [ ] Select reaction: Loved it (😍)
- [ ] Save → Verify Timeline shows "Banana · 😍 Loved it"

### 5.2 Reactions
- [ ] Log solid with "Loved it" reaction
- [ ] Log solid with "Meh" reaction
- [ ] Log solid with "Refused" reaction
- [ ] Verify each appears correctly in Timeline with emoji

### 5.3 Recent Foods
- [ ] Log a few different foods (Banana, Avocado, Carrot)
- [ ] Start new solid entry
- [ ] Verify recent foods appear for quick selection
- [ ] Tap recent food → Verify it populates the input

### 5.4 Custom Food Entry
- [ ] Enter a new food not in common foods list
- [ ] Save → Verify it appears in Timeline
- [ ] Start new entry → Verify custom food appears in recent foods

---

## 6. Feeding - Tab Memory

### 6.1 Last Used Tab
- [ ] Go to Feeding screen
- [ ] Select Bottle tab
- [ ] Log a bottle feeding
- [ ] Go back to Home
- [ ] Tap Feeding card again → Verify Bottle tab is selected
- [ ] Close and reopen app → Tap Feeding → Verify Bottle tab still selected

---

## 7. Sleep Tracking

### 7.1 Timer Flow
- [ ] Tap Sleep card from Home
- [ ] Tap Start Sleep button
- [ ] Timer counts up correctly
- [ ] Tap "Wake Up" / Stop → Sleep saved
- [ ] Verify sleep appears in Timeline

### 7.2 Sleep Type Auto-Detection
- [ ] Start sleep during daytime hours (e.g., 2 PM) → Should default to "Nap"
- [ ] Start sleep during nighttime hours (e.g., 8 PM) → Should default to "Night"
- [ ] Verify can manually override the auto-detected type

### 7.3 Timer Persistence
- [ ] Start sleep timer
- [ ] Background app for 1 minute → Return → Verify correct time
- [ ] Start sleep timer
- [ ] Force kill app → Wait 2 minutes → Reopen → Verify timer correct

### 7.4 Manual Sleep Entry
- [ ] Tap "Log Past Sleep" option
- [ ] Select past start time
- [ ] Select duration with quick buttons (15, 30, 45 min, 1h, 2h)
- [ ] Select type (Nap/Night)
- [ ] Save → Verify in Timeline

### 7.5 Sleep Goals (Smart Goals)
- [ ] Go to Sleep settings
- [ ] Verify age-based goal is shown (based on baby's birth date)
- [ ] Customize the daily sleep goal
- [ ] Verify dashboard shows progress toward goal

### 7.6 Wake Time Display
- [ ] Complete a sleep session
- [ ] Return to Home → Sleep card should show "Awake: Xh Xm"
- [ ] Verify wake time updates as time passes

---

## 8. Diaper Tracking

### 8.1 Quick Log - Wet
- [ ] Tap Diaper card from Home
- [ ] Tap "Wet" button
- [ ] Verify diaper is saved immediately
- [ ] Verify appears in Timeline as "Wet"

### 8.2 Dirty/Mixed with Color
- [ ] Tap "Dirty" button
- [ ] Color picker should appear
- [ ] Select stool color (Yellow, Brown, Green, etc.)
- [ ] Save → Verify Timeline shows type and color

### 8.3 All Stool Colors
Test each color selection:
- [ ] Yellow (mustard)
- [ ] Brown
- [ ] Green
- [ ] Black (meconium)
- [ ] White/Pale
- [ ] Red-tinged
- [ ] Orange

### 8.4 Mixed Diaper
- [ ] Select "Mixed" type
- [ ] Select stool color
- [ ] Save → Verify shows "Mixed" with color in Timeline

### 8.5 Manual Diaper Entry
- [ ] Tap "Log Past Diaper" option
- [ ] Select past time
- [ ] Select diaper type
- [ ] Select color (if dirty/mixed)
- [ ] Save → Verify in Timeline with correct time

### 8.6 Diaper Count
- [ ] Log several diapers today
- [ ] Check Home screen "Today's Summary"
- [ ] Verify diaper count is accurate

---

## 9. Growth Tracking

### 9.1 Basic Measurement Entry
- [ ] Tap Growth card from Home
- [ ] Enter weight (kg or lbs)
- [ ] Enter height (cm or inches)
- [ ] Enter head circumference (cm)
- [ ] Save → Verify appears in Timeline

### 9.2 Partial Measurements
- [ ] Enter only weight (leave height/head empty)
- [ ] Save → Verify saves successfully
- [ ] Verify Timeline shows only the entered measurement

### 9.3 Units Display
- [ ] Verify weight can be entered in kg or lbs
- [ ] Verify height can be entered in cm or inches
- [ ] Verify values display correctly in Timeline

### 9.4 Dashboard Display
- [ ] After logging growth measurement
- [ ] Home Growth card shows "Last: [date]" or similar

---

## 10. Tummy Time Tracking

### 10.1 Timer Flow
- [ ] Tap Tummy Time card from Home
- [ ] Tap Start button
- [ ] Timer counts up
- [ ] Progress ring updates as time passes
- [ ] Stop timer → Session saved

### 10.2 Daily Goal Progress
- [ ] Verify progress ring shows percentage of daily goal
- [ ] Complete multiple tummy time sessions
- [ ] Verify progress accumulates correctly
- [ ] Reach 100% → Verify celebration/completion indicator

### 10.3 Timer Persistence
- [ ] Start tummy time timer
- [ ] Background app → Return → Verify correct time
- [ ] Start timer → Kill app → Reopen → Verify timer correct

### 10.4 Manual Entry
- [ ] Tap "Log Past Tummy Time"
- [ ] Select past time
- [ ] Select duration (1, 2, 3, 5, 10, 15 min)
- [ ] Save → Verify contributes to daily goal progress

### 10.5 Smart Goals (Age-Based)
- [ ] Verify default goal matches baby's age:
  - 0-4 weeks: 15 min
  - 1-2 months: 30 min
  - 2-3 months: 45 min
  - 3-6 months: 60 min
  - 6+ months: 60 min

### 10.6 Custom Goal
- [ ] Go to Tummy Time settings
- [ ] Change daily goal to custom value
- [ ] Verify new goal is used on dashboard
- [ ] Verify goal persists after app restart

### 10.7 Goal Suggestion Modal
- [ ] When baby crosses age milestone (1mo, 2mo, 3mo, 6mo)
- [ ] Verify suggestion modal appears offering new goal
- [ ] Dismiss modal → Verify doesn't appear again
- [ ] Accept new goal → Verify goal updates

---

## 11. Pumping Tracking

### 11.1 Timer Flow
- [ ] Tap Pumping card from Home
- [ ] Select side (Left/Right/Both)
- [ ] Start timer
- [ ] Timer counts up
- [ ] Stop timer → Volume input appears
- [ ] Enter volume
- [ ] Save → Verify in Timeline

### 11.2 Volume Entry
- [ ] After stopping timer, enter volume in ml
- [ ] Toggle to oz, enter volume
- [ ] Verify Timeline shows correct amount

### 11.3 Timer Persistence
- [ ] Start pumping timer
- [ ] Background app → Return → Verify correct time
- [ ] Kill app → Reopen → Verify timer correct

### 11.4 Manual Entry
- [ ] Tap "Log Past Pumping"
- [ ] Select past time
- [ ] Select duration
- [ ] Select side
- [ ] Enter volume
- [ ] Save → Verify in Timeline

---

## 12. Timeline

### 12.1 Display
- [ ] All entry types appear in Timeline
- [ ] Entries sorted by time (newest first)
- [ ] Day headers show correctly ("Today", "Yesterday", dates)
- [ ] Each entry shows correct icon and details

### 12.2 Activity Type Display
Verify each type displays correctly:
- [ ] Breastfeeding: Shows side and duration
- [ ] Bottle: Shows content type and amount
- [ ] Solids: Shows food and reaction emoji
- [ ] Sleep: Shows type (nap/night) and duration
- [ ] Diaper: Shows type and color (if applicable)
- [ ] Pumping: Shows side, duration, and volume
- [ ] Growth: Shows measurements
- [ ] Tummy Time: Shows duration

### 12.3 Edit Entry
- [ ] Tap on any entry in Timeline
- [ ] Edit screen opens with current values
- [ ] Make changes
- [ ] Save → Verify changes appear in Timeline

### 12.4 Delete Entry
- [ ] Tap on entry → Tap Delete button
- [ ] Confirmation dialog appears
- [ ] Confirm delete → Entry removed from Timeline
- [ ] Verify entry is truly gone (scroll, refresh)

### 12.5 Unsaved Changes Protection
- [ ] Open edit screen for an entry
- [ ] Make changes but don't save
- [ ] Swipe down to dismiss (or tap back)
- [ ] Confirmation dialog should appear
- [ ] Tap "Keep Editing" → Stay on edit screen
- [ ] Make changes again, swipe down
- [ ] Tap "Discard" → Changes are lost, returns to Timeline

### 12.6 Scrolling Performance
- [ ] Log 50+ entries across different types
- [ ] Scroll through Timeline
- [ ] Verify smooth scrolling, no lag
- [ ] Verify entries load correctly when scrolling

---

## 13. Today Summary

### 13.1 Accurate Counts
- [ ] Log multiple feedings today → Verify count updates
- [ ] Log multiple sleep sessions → Verify total sleep time
- [ ] Log multiple diapers → Verify count updates
- [ ] Verify counts reset at midnight

### 13.2 After App Restart
- [ ] Log some entries
- [ ] Close and reopen app
- [ ] Verify Today Summary shows correct values

---

## 14. Data Persistence

### 14.1 App Restart
- [ ] Log entries for all activity types
- [ ] Close app completely
- [ ] Reopen app
- [ ] Verify all entries still exist in Timeline
- [ ] Verify dashboard shows correct "time since" values

### 14.2 Multiple Babies Data Separation
- [ ] Add Baby A and log some entries
- [ ] Add Baby B and log different entries
- [ ] Switch to Baby A → Verify only Baby A's entries show
- [ ] Switch to Baby B → Verify only Baby B's entries show

---

## 15. Edge Cases & Error Handling

### 15.1 Empty States
- [ ] New baby with no entries → Verify friendly empty state in Timeline
- [ ] Dashboard cards show appropriate default text

### 15.2 Validation Messages
- [ ] Try to save feeding with invalid duration → Error shown
- [ ] Try to save growth with out-of-range values → Error shown
- [ ] Try to save entry with future time → Error/prevented

### 15.3 Concurrent Timers (if applicable)
- [ ] Start breastfeeding timer
- [ ] Try to start sleep timer → Verify behavior (one timer at a time?)
- [ ] Or verify multiple timers can run simultaneously if supported

### 15.4 Long Duration Sessions
- [ ] Start a timer and leave it running for 30+ minutes
- [ ] Verify timer continues accurately
- [ ] Stop and save → Verify duration is correct

### 15.5 Timezone Handling
- [ ] Log entry at current time
- [ ] Change device timezone
- [ ] Verify entry still shows correct time (or handles gracefully)

---

## 16. End-to-End Scenarios

### Scenario A: Complete Day Workflow
1. [ ] Add a new baby (if none exists)
2. [ ] Log a breastfeeding session (timer)
3. [ ] Log a wet diaper
4. [ ] Start sleep timer
5. [ ] Background app, wait 5 minutes
6. [ ] Return and stop sleep timer
7. [ ] Log a bottle feeding (manual entry, past time)
8. [ ] Log tummy time (timer)
9. [ ] Log a growth measurement
10. [ ] Check Timeline → All 6 entries present in correct order
11. [ ] Check Today Summary → All counts accurate
12. [ ] Kill and reopen app → All data persisted

### Scenario B: Multiple Baby Workflow
1. [ ] Add Baby A
2. [ ] Log feeding for Baby A
3. [ ] Log diaper for Baby A
4. [ ] Add Baby B
5. [ ] Switch to Baby B
6. [ ] Log sleep for Baby B
7. [ ] Switch back to Baby A
8. [ ] Verify only Baby A's feeding and diaper show in Timeline
9. [ ] Switch to Baby B
10. [ ] Verify only Baby B's sleep shows in Timeline

### Scenario C: Timer Stress Test
1. [ ] Start breastfeeding timer
2. [ ] Background app for 2 minutes
3. [ ] Return, switch sides
4. [ ] Background for 2 more minutes
5. [ ] Return and stop timer
6. [ ] Verify total duration is ~4 minutes
7. [ ] Verify entry saved correctly

### Scenario D: Edit/Delete Workflow
1. [ ] Log a feeding
2. [ ] Edit the feeding - change duration
3. [ ] Verify change appears in Timeline
4. [ ] Delete the feeding
5. [ ] Verify it's removed from Timeline and Today Summary updates

### Scenario E: Night Feeding Simulation
1. [ ] Set device to dark mode
2. [ ] Log a breastfeeding (timer)
3. [ ] Log a diaper change
4. [ ] Log baby going to sleep
5. [ ] Verify all UI elements visible and usable in dark mode
6. [ ] Verify touch targets are large enough for one-handed use

---

## Testing Sign-Off

| Area | Tester | Date | Pass/Fail | Notes |
|------|--------|------|-----------|-------|
| Baby Profile Management | | | | |
| Navigation & UI | | | | |
| Breastfeeding | | | | |
| Bottle Feeding | | | | |
| Solid Food | | | | |
| Sleep Tracking | | | | |
| Diaper Tracking | | | | |
| Growth Tracking | | | | |
| Tummy Time | | | | |
| Pumping | | | | |
| Timeline | | | | |
| Data Persistence | | | | |
| Edge Cases | | | | |
| E2E Scenarios | | | | |

**Overall Status:** [ ] Ready for Release / [ ] Issues Found

**Critical Issues Found:**
1.
2.
3.

**Minor Issues Found:**
1.
2.
3.

---

## Notes

- Test both iOS and Android if possible
- Test in both light and dark mode
- Pay special attention to timer accuracy and persistence
- Verify all "time since" displays update correctly
- Check memory usage doesn't grow excessively during extended use
