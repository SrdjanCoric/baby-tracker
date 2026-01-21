# Phase 2: Multi-Caregiver Sync Implementation Plan

## Overview

This plan implements 4 interconnected features as a single unit:
1. **Real-time Sync** - Sync between caregivers within 5 seconds
2. **Conflict Resolution** - Last-write-wins with field merging
3. **Caregiver Management** - Add/remove caregivers, show who logged entries
4. **Offline-First with Sync Queue** - Full functionality offline with visible sync status

**Branch:** `feature/multi-caregiver-sync`

**Approach:** TDD (Test-Driven Development) - Write tests first, then implement

---

## Pre-Implementation Setup

- [x] Create feature branch from main: `git checkout -b feature/multi-caregiver-sync`
- [x] Install PowerSync dependencies: `npm install @powersync/react-native @powersync/common react-native-quick-sqlite`
- [x] Install network monitoring: `npm install @react-native-community/netinfo`
- [x] Configure PowerSync service (requires PowerSync cloud account setup)
- [x] Add environment variables to `.env`:
  - [x] `EXPO_PUBLIC_POWERSYNC_URL`

---

## Phase 1: Test Infrastructure Setup

### 1.1 Mock Setup

- [x] Create `/src/__mocks__/powersync.ts` - PowerSync mock for tests
  - [x] Mock database operations (getAll, get, execute)
  - [x] Mock sync status events
  - [x] Mock connection/disconnection
  - [x] Add test helpers: `__simulateSync`, `__simulateConflict`

- [x] Create `/src/__mocks__/netinfo.ts` - Network info mock
  - [x] Mock `fetch()` for current status
  - [x] Mock `addEventListener` for status changes
  - [x] Add test helpers: `__setOnline`, `__setOffline`

- [x] Update `/src/__mocks__/async-storage.ts` - Extend existing mock
  - [x] Add `multiGet`, `multiSet`, `multiRemove` support
  - [x] Add `__getMockStorage`, `__clearMockStorage` helpers

### 1.2 Test File Structure Setup

- [x] Create directory: `/src/services/sync/`
- [x] Create directory: `/src/__tests__/security/`
- [x] Update `package.json` with new test scripts:
  ```json
  "test:security": "vitest run --testMatch='**/*.security.test.ts'",
  "test:sync": "vitest run src/services/sync/"
  ```

---

## Phase 2: Write Tests First (TDD)

### 2.1 Sync Queue Tests

**File:** `/src/services/sync/sync-queue.test.ts`

- [x] Test: should add operation to queue when offline
- [x] Test: should persist queue to AsyncStorage
- [x] Test: should restore queue from AsyncStorage on init
- [x] Test: should order queue by timestamp (FIFO)
- [x] Test: should assign unique operation IDs
- [x] Test: should queue CREATE operations with full entity data
- [x] Test: should queue UPDATE operations with only changed fields
- [x] Test: should queue DELETE operations
- [x] Test: should process queue when coming online
- [x] Test: should process operations in order
- [x] Test: should remove operation from queue on success
- [x] Test: should retry failed operations with exponential backoff
- [x] Test: should collapse multiple updates to same entity
- [x] Test: should remove create+delete pair for same entity
- [x] Test: should handle 100+ queued items in batches of 50
- [x] Test: should maintain queue integrity on crash/interruption
- [x] Test: should handle items older than 24 hours with warning

### 2.2 Conflict Resolution Tests

**File:** `/src/services/sync/conflict-resolver.test.ts`

- [x] Test: should detect conflict when local and remote have different updatedAt
- [x] Test: should not detect conflict when timestamps match
- [x] Test: should keep remote change when remote updatedAt is newer
- [x] Test: should keep local change when local updatedAt is newer
- [x] Test: should prefer remote on exact timestamp tie (deterministic)
- [x] Test: should merge when different fields were changed
- [x] Test: should use newer value when same field changed by both
- [x] Test: should preserve all fields from both versions in merge
- [x] Test: should handle local update vs remote delete (keep edit)
- [x] Test: should handle local delete vs remote update (keep edit)
- [x] Test: should keep both entries for simultaneous creates
- [x] Test: should log all conflicts for debugging
- [x] Test: should handle clock skew up to 5 minutes

### 2.3 Sync Engine Tests

**File:** `/src/services/sync/sync-engine.test.ts`

- [x] Test: should check network status on init
- [x] Test: should load pending queue from storage on init
- [x] Test: should establish realtime connection when online
- [x] Test: should remain in offline mode when no network
- [x] Test: should start sync on online transition
- [x] Test: should pause sync on offline transition
- [x] Test: should handle rapid online/offline toggles (debounce 300ms)
- [x] Test: should pull all remote changes since last sync
- [x] Test: should push all queued local changes
- [x] Test: should update last sync timestamp on success
- [x] Test: should emit sync complete event
- [x] Test: should retry sync on transient network error
- [x] Test: should handle app crash during push phase
- [x] Test: should handle app crash during pull phase
- [x] Test: should not duplicate data on resume
- [x] Test: should reject malformed entity data
- [x] Test: should quarantine invalid data for review

### 2.4 Real-time Sync Tests

**File:** `/src/services/sync/real-time-sync.test.ts`

- [x] Test: should subscribe to household changes on initialization
- [x] Test: should unsubscribe when household changes
- [x] Test: should handle subscription errors gracefully
- [x] Test: should reconnect after connection loss
- [x] Test: should apply remote INSERT to local storage
- [x] Test: should apply remote UPDATE to local storage
- [x] Test: should apply remote DELETE from local storage
- [x] Test: should ignore changes from same device (echo suppression)
- [x] Test: should emit connected state when subscription active
- [x] Test: should emit disconnected state on error

### 2.5 Caregiver Service Tests

**File:** `/src/services/caregiver-service.test.ts`

- [x] Test: should return all caregivers in household
- [x] Test: should include display name and email for each
- [x] Test: should indicate which member is the owner
- [x] Test: should return empty array for single-user household
- [x] Test: should allow owner to remove other caregivers
- [x] Test: should reject removal by non-owner
- [x] Test: should prevent owner from removing themselves
- [x] Test: should return activity count per caregiver
- [x] Test: should return last activity timestamp per caregiver

### 2.6 Sync Context Tests

**File:** `/src/contexts/sync-context.test.ts`

- [x] Test: should handle SET_STATUS action
- [x] Test: should handle SET_PENDING_COUNT action
- [x] Test: should handle INCREMENT_PENDING action
- [x] Test: should handle DECREMENT_PENDING action
- [x] Test: should handle SET_ONLINE action
- [x] Test: should handle SYNC_COMPLETE action
- [x] Test: should handle SYNC_ERROR action
- [x] Test: should throw when useSync used outside provider

### 2.7 Component Tests

**File:** `/src/components/SyncStatusIndicator.component.test.tsx`

- [x] Test: renders synced state with green indicator
- [x] Test: renders syncing state with spinner animation
- [x] Test: renders offline state with orange indicator
- [x] Test: renders pending state with count badge
- [x] Test: renders error state with red indicator
- [x] Test: shows label when showLabel is true
- [x] Test: has status accessibility role
- [x] Test: announces state changes to screen reader
- [x] Test: triggers retry on tap when in error state

**File:** `/src/components/OfflineBanner.component.test.tsx`

- [x] Test: renders offline message
- [x] Test: shows pending count with singular form (1 change)
- [x] Test: shows pending count with plural form (N changes)
- [x] Test: calls onDismiss when dismiss button pressed
- [x] Test: has alert accessibility role

**File:** `/src/components/CaregiverListItem.component.test.tsx`

- [x] Test: renders caregiver name
- [x] Test: truncates names longer than 20 characters
- [x] Test: shows "You" indicator for current user
- [x] Test: shows "Owner" badge for household owner
- [x] Test: shows entry count badge
- [x] Test: shows remove button for removable caregivers
- [x] Test: hides remove button for current user
- [x] Test: hides remove button for owner
- [x] Test: calls onRemove when remove button pressed

### 2.8 Security Tests

**File:** `/src/__tests__/security/household-isolation.security.test.ts`

- [x] Test: should NOT return babies from other households
- [x] Test: should NOT return feedings from other households
- [x] Test: should NOT return any activity data from other households
- [x] Test: should reject SELECT on foreign baby_id
- [x] Test: should reject UPDATE on foreign baby_id
- [x] Test: should reject DELETE on foreign baby_id
- [x] Test: should reject INSERT with foreign baby_id
- [x] Test: should clear all local data on sign out
- [x] Test: should only subscribe to own household changes

**File:** `/src/__tests__/security/invite-code-security.test.ts`

- [x] Test: should rate limit invite code attempts (max 5 per minute)
- [x] Test: should generate 8-character codes with sufficient entropy
- [x] Test: should invalidate old code immediately on regeneration
- [x] Test: should only allow household owner to regenerate code

**File:** `/src/__tests__/security/caregiver-authorization.security.test.ts`

- [x] Test: should identify household owner correctly
- [x] Test: should allow owner to remove any caregiver
- [x] Test: should prevent owner from removing themselves
- [x] Test: should prevent non-owner from removing caregivers

### 2.9 Integration Tests

**File:** `/src/__tests__/sync-flow.integration.test.tsx`

- [x] Test: should sync new entry within 5 seconds
- [x] Test: should sync edited entry within 5 seconds
- [x] Test: should sync deleted entry within 5 seconds
- [x] Test: should allow logging when offline
- [x] Test: should queue all operations while offline
- [x] Test: should sync all queued changes when online
- [x] Test: should handle offline for 7 days with 100+ changes
- [x] Test: should resolve concurrent edits to same entry
- [x] Test: should handle conflicting offline edits from two devices

**File:** `/src/__tests__/caregiver-flow.integration.test.tsx`

- [x] Test: should load and display caregiver list
- [x] Test: should show confirmation when removing caregiver
- [x] Test: should remove caregiver on confirmation
- [x] Test: should handle network error during removal

---

## Phase 3: Implementation

### 3.1 Types and Interfaces

**File:** `/src/services/sync/types.ts`

- [x] Define `SyncStatus` type: 'offline' | 'online' | 'syncing' | 'pending' | 'error'
- [x] Define `SyncState` interface with status, pendingCount, lastSyncedAt, error, isConnected
- [x] Define `SyncableEntry` interface with id, createdAt, updatedAt, loggedBy
- [x] Define `SyncableTable` type for all syncable tables
- [x] Define `QueuedOperation` interface
- [x] Define `ConflictScenario` interface
- [x] Define `ConflictResolution` interface

### 3.2 Sync Queue Implementation

**File:** `/src/services/sync/sync-queue.ts`

- [x] Implement `SyncQueue` class
- [x] Implement `enqueue(operation)` - add to queue with timestamp
- [x] Implement `dequeue()` - get next operation
- [x] Implement `peek()` - view next without removing
- [x] Implement `persist()` - save to AsyncStorage
- [x] Implement `restore()` - load from AsyncStorage
- [x] Implement `optimize()` - collapse duplicate updates, remove create+delete pairs
- [x] Implement `getCount()` - return pending count
- [x] Implement `clear()` - remove all items
- [x] Implement batch processing for large queues (50 items per batch)
- [x] Add operation deduplication by entity ID

### 3.3 Conflict Resolver Implementation

**File:** `/src/services/sync/conflict-resolver.ts`

- [x] Implement `ConflictResolver` class
- [x] Implement `detectConflict(local, remote, base)` - returns boolean
- [x] Implement `resolve(scenario)` - returns resolution decision
- [x] Implement `resolveUpdateUpdate(local, remote)` - last-write-wins or merge
- [x] Implement `resolveUpdateDelete(local, remote)` - keep edit
- [x] Implement `resolveCreateCreate(local, remote)` - keep both
- [x] Implement `mergeEntries(local, remote, base)` - field-level merge
- [x] Implement `getChangedFields(entry, base)` - detect which fields changed
- [x] Implement conflict logging for debugging

### 3.4 PowerSync Schema and Connector

**File:** `/src/services/sync/schema.ts`

- [x] Define PowerSync schema matching Supabase tables
- [x] Define `feedings` table columns
- [x] Define `sleep_sessions` table columns
- [x] Define `diapers` table columns
- [x] Define `pumping_sessions` table columns
- [x] Define `growth_measurements` table columns
- [x] Define `tummy_time_sessions` table columns
- [x] Define `babies` table columns

**File:** `/src/services/sync/powersync-connector.ts`

- [x] Implement `SupabaseConnector` class
- [x] Implement `fetchCredentials()` - get auth token from Supabase session
- [x] Implement `uploadData(database)` - push local changes to Supabase
- [x] Implement `applyOperation(op)` - execute Supabase upsert/update/delete
- [x] Handle auth token refresh
- [x] Handle upload errors with retry

### 3.5 Sync Engine Implementation

**File:** `/src/services/sync/sync-engine.ts`

- [x] Implement `SyncEngine` class
- [x] Implement `initialize()` - setup PowerSync, load queue, connect if online
- [x] Implement `connect()` - establish realtime connection
- [x] Implement `disconnect()` - gracefully close connection
- [x] Implement `sync()` - full sync cycle (pull, push, resolve conflicts)
- [x] Implement `handleNetworkChange(isOnline)` - with 300ms debounce
- [x] Implement `handleRemoteChange(change)` - process incoming changes
- [x] Implement `getStatus()` - return current sync state
- [x] Implement `subscribe(listener)` - for status updates
- [x] Implement echo suppression (ignore own changes from realtime)
- [x] Add exponential backoff for retries (1s, 2s, 4s, max 30s)

### 3.6 Sync Context

**File:** `/src/contexts/sync-context.tsx`

- [x] Define `SyncState` interface
- [x] Define `SyncAction` union type
- [x] Implement `syncReducer` function
- [x] Implement `SyncProvider` component
- [x] Initialize SyncEngine on mount
- [x] Subscribe to network changes via NetInfo
- [x] Subscribe to sync status changes
- [x] Expose `status`, `pendingCount`, `lastSyncedAt`, `error`, `isConnected`
- [x] Expose `forceSync()` method
- [x] Expose `retryFailedSync()` method
- [x] Clean up subscriptions on unmount

### 3.7 Storage Service Migration

**File:** `/src/services/sync/syncable-storage.ts`

- [x] Create base `SyncableStorageService<T>` abstract class
- [x] Implement `getAll(babyId)` using PowerSync SQL
- [x] Implement `getById(id)` using PowerSync SQL
- [x] Implement `create(data)` with loggedBy attribution
- [x] Implement `update(id, data)` preserving loggedBy
- [x] Implement `delete(id)`
- [x] Implement `watch(babyId, callback)` for reactive updates

**File:** `/src/services/feeding-storage-sync.ts`

- [x] Extend `SyncableStorageService<StoredFeedingEntry>`
- [x] Migrate `getAllFeedings` to PowerSync
- [x] Migrate `addFeeding` to PowerSync with loggedBy
- [x] Migrate `updateFeeding` to PowerSync
- [x] Migrate `deleteFeeding` to PowerSync
- [x] Keep active timer in AsyncStorage (local-only, not synced)
- [x] Add `loggedBy` field to `StoredFeedingEntry` interface

- [x] Repeat migration pattern for other storage services:
  - [x] `/src/services/sleep-storage-sync.ts`
  - [x] `/src/services/diaper-storage-sync.ts`
  - [x] `/src/services/pumping-storage-sync.ts`
  - [x] `/src/services/growth-storage-sync.ts`
  - [x] `/src/services/tummyTime-storage-sync.ts`

### 3.8 Caregiver Service

**File:** `/src/services/caregiver-service.ts`

- [x] Implement `getCurrentUserId()` - from Supabase auth
- [x] Implement `getCaregiverDisplayName(userId)` - lookup in users table
- [x] Implement `getHouseholdCaregivers()` - all members with stats
- [x] Implement `getCaregiverStats(userId)` - activity count and last activity
- [x] Implement `removeCaregiver(userId)` - with owner check
- [x] Implement `isHouseholdOwner(userId)` - check ownership
- [x] Add RPC function for safe caregiver removal in Supabase

### 3.9 UI Components

**File:** `/src/components/SyncStatusIndicator.tsx`

- [x] Implement component with status dot/icon
- [x] Add animated spinner for syncing state
- [x] Add pending count badge
- [x] Add tap handler for sync details/retry
- [x] Add accessibility role="status" and live region
- [x] Style with NativeWind classes

**File:** `/src/components/OfflineBanner.tsx`

- [x] Implement dismissable banner component
- [x] Show pending count with proper pluralization
- [x] Add slide-down animation on appear
- [x] Add accessibility role="alert"
- [x] Style with NativeWind classes

**File:** `/src/components/CaregiverListItem.tsx`

- [x] Implement list row with avatar (initials fallback)
- [x] Add name truncation with ellipsis (max 20 chars)
- [x] Add "You" indicator for current user
- [x] Add "Owner" badge for household owner
- [x] Add entry count badge
- [x] Add remove button (conditional visibility)
- [x] Add accessibility labels
- [x] Style with NativeWind classes

**File:** `/src/components/ConflictResolutionModal.tsx`

- [x] Implement modal for manual conflict resolution (rare cases)
- [x] Show local vs remote version comparison
- [x] Add "Keep mine" / "Keep theirs" / "Keep newer" options
- [x] Add batch resolution actions
- [x] Add accessibility for modal trap

### 3.10 Screen Updates

**File:** `/app/settings/caregivers.tsx`

- [x] Create new caregiver management screen
- [x] Load caregivers from CaregiverService
- [x] Display CaregiverListItem for each member
- [x] Add remove confirmation Alert
- [x] Handle removal with loading state
- [x] Handle errors with user-friendly messages
- [x] Add i18n translation keys

**File:** `/app/settings/household.tsx`

- [x] Add navigation link to caregivers screen
- [x] Add SyncStatusIndicator to header area

**File:** `/app/_layout.tsx`

- [x] Add SyncProvider to provider hierarchy (after HouseholdProvider)
- [x] Add OfflineBanner at app root level

**File:** Update activity timeline components to show "logged by"

- [x] Add loggedBy display to feeding timeline item
- [x] Add loggedBy display to sleep timeline item
- [x] Add loggedBy display to diaper timeline item
- [x] Add loggedBy display to pumping timeline item
- [x] Add loggedBy display to tummy time timeline item

### 3.11 Database Migrations

**File:** `/supabase/migrations/006_add_logged_by_attribution.sql`

- [x] Add trigger to auto-populate `logged_by` on INSERT if null
- [x] Update RLS policies to ensure logged_by matches auth.uid() on insert
- [x] Add index on `logged_by` for efficient caregiver stats queries

**File:** `/supabase/migrations/007_caregiver_removal_function.sql`

- [x] Create RPC function `remove_caregiver(caregiver_id, household_id)`
- [x] Add ownership validation in function
- [x] Create new solo household for removed caregiver
- [x] Handle edge case: removing last member deletes household

### 3.12 Translations

**File:** `/src/i18n/locales/en.json`

- [x] Add `sync.synced` - "Synced"
- [x] Add `sync.syncing` - "Syncing..."
- [x] Add `sync.offline` - "Offline"
- [x] Add `sync.error` - "Sync error"
- [x] Add `sync.pendingChanges` - "{{count}} pending change(s)"
- [x] Add `sync.lastSynced` - "Last synced {{time}}"
- [x] Add `sync.tapToRetry` - "Tap to retry"
- [x] Add `sync.changesWillSync` - "Changes will sync when connected"
- [x] Add `household.caregivers` - "Caregivers"
- [x] Add `household.owner` - "Owner"
- [x] Add `household.you` - "You"
- [x] Add `household.entriesLogged` - "{{count}} entries logged"
- [x] Add `household.removeCaregiver` - "Remove Caregiver"
- [x] Add `household.removeCaregiverConfirm` - "Remove {{name}} from household?"
- [x] Add `household.removeCaregiverDescription` - "They will lose access..."
- [x] Add `household.caregiverRemoved` - "Caregiver removed"
- [x] Add `household.cannotRemoveSelf` - "You cannot remove yourself..."
- [x] Add `timeline.loggedBy` - "Logged by {{name}}"

---

## Phase 4: Integration and Wiring

### 4.1 Context Integration

- [x] Update activity contexts to use sync-enabled storage services
- [x] Add sync status subscription to contexts for UI updates
- [x] Ensure contexts dispatch INCREMENT_PENDING on local changes
- [x] Wire up real-time updates to context state

### 4.2 Provider Hierarchy Update

- [x] Verify provider order in `_layout.tsx`:
  ```
  ThemeProvider > AuthProvider > HouseholdProvider > SyncProvider >
  BabyProvider > [Activity Providers] > UnitProvider
  ```

### 4.3 Header Integration

- [x] Add SyncStatusIndicator to main app header
- [x] Position indicator in top-right or status bar area
- [x] Ensure visibility on all main screens

---

## Phase 5: Security Validation

### 5.1 RLS Policy Audit

- [ ] Verify all activity tables have household-scoped RLS
- [ ] Test cross-household access is blocked (SELECT)
- [ ] Test cross-household access is blocked (INSERT)
- [ ] Test cross-household access is blocked (UPDATE)
- [ ] Test cross-household access is blocked (DELETE)
- [ ] Verify PowerSync sync rules mirror RLS policies

### 5.2 Auth Token Security

- [ ] Verify tokens are not logged or exposed
- [ ] Verify token refresh happens before expiration
- [ ] Verify data cleared on auth failure

### 5.3 Invite Code Security

- [ ] Test rate limiting on invalid attempts
- [ ] Verify old codes invalidated on regeneration
- [ ] Test case-insensitive lookup works correctly

### 5.4 Caregiver Removal Security

- [ ] Test only owner can remove caregivers
- [ ] Test owner cannot remove self
- [ ] Test removed caregiver loses access immediately

---

## Phase 6: Edge Case Verification

### 6.1 Network Edge Cases

- [ ] Test: Network interruption mid-sync (no data corruption)
- [ ] Test: Very slow network (>10 second response times)
- [ ] Test: Intermittent connectivity (flapping)
- [ ] Test: App backgrounding during sync
- [ ] Test: Device sleep during sync

### 6.2 Data Edge Cases

- [ ] Test: Empty sync response
- [ ] Test: Null/undefined field values
- [ ] Test: Unicode and emoji in text fields
- [ ] Test: Dates in different timezones
- [ ] Test: Maximum field lengths

### 6.3 Queue Edge Cases

- [ ] Test: 100+ items in queue syncs successfully
- [ ] Test: Queue with items older than 24 hours
- [ ] Test: App crash during queue processing (resume correctly)
- [ ] Test: Duplicate operations are collapsed

### 6.4 Caregiver Edge Cases

- [ ] Test: 10+ caregivers display correctly (virtualized list)
- [ ] Test: 50-character caregiver name (truncation)
- [ ] Test: Caregiver with no display name (fallback to email)
- [ ] Test: Remove caregiver while offline (queued)

---

## Phase 7: Final Verification

### 7.1 Run All Tests

- [ ] Run unit tests: `npm run test:unit` (all pass)
- [ ] Run component tests: `npm run test:component` (all pass)
- [ ] Run security tests: `npm run test:security` (all pass)
- [ ] Run integration tests: `npm run test:integration` (all pass)

### 7.2 Manual Testing Checklist

- [ ] Create feeding on Device A, verify appears on Device B within 5 seconds
- [ ] Edit entry on Device A, verify update syncs to Device B
- [ ] Delete entry on Device A, verify removed from Device B
- [ ] Enable airplane mode, create 5 entries, disable airplane mode, verify all sync
- [ ] Create entries on both devices while offline, reconnect, verify no data loss
- [ ] View caregiver list, verify all members shown with correct info
- [ ] Remove caregiver (as owner), verify removed and loses access
- [ ] Verify "Logged by" shows correct caregiver name on entries
- [ ] Verify sync status indicator reflects actual state
- [ ] Verify offline banner appears when disconnected

### 7.3 Performance Verification

- [ ] Sync 100 queued changes completes in under 10 seconds
- [ ] UI remains responsive (60fps) during sync
- [ ] Memory usage stays under 100MB during large sync

### 7.4 Definition of Done

- [ ] All tests pass (100%)
- [ ] Sync latency < 5 seconds between devices
- [ ] All features work completely offline
- [ ] Conflict resolution is automatic (no user prompts for normal cases)
- [ ] No data loss in any tested scenario
- [ ] Sync indicator visible and accurate
- [ ] Pending changes count displayed when offline
- [ ] "Logged by" attribution shows on all entries
- [ ] Caregiver management allows owner to remove members
- [ ] Security tests pass (no cross-household data leaks)
- [ ] Code review completed
- [ ] PR merged to main

---

## Critical Files Reference

| Purpose | File Path |
|---------|-----------|
| Storage pattern | `/src/services/feeding-storage.ts` |
| Context pattern | `/src/contexts/household-context.tsx` |
| Household UI | `/app/settings/household.tsx` |
| Join household | `/app/settings/join-household.tsx` |
| DB schema | `/supabase/migrations/001_initial_schema.sql` |
| Household service | `/src/services/household-service.ts` |
| Invite code utils | `/src/utils/inviteCode.ts` |
| App layout | `/app/_layout.tsx` |
| Translations | `/src/i18n/locales/en.json` |

---

## Rollback Plan

If critical issues discovered after deployment:
1. Disable PowerSync connection (feature flag)
2. Revert to AsyncStorage-only storage services
3. Hide sync UI components
4. All local functionality remains working

---

## Security Review Findings (Additional Items)

### SR-1: Data Migration Security

- [ ] Test: Existing AsyncStorage data migrates to PowerSync without loss
- [ ] Test: Migration happens only once per user (idempotent)
- [ ] Test: Failed migration doesn't corrupt existing data
- [ ] Test: Migration respects user-scoped storage prefixes
- [ ] Implement: Add migration version flag to prevent re-migration

### SR-2: loggedBy Spoofing Prevention

- [ ] Verify: Server-side trigger enforces `logged_by = auth.uid()` on INSERT
- [ ] Verify: UPDATE cannot modify `logged_by` field
- [ ] Test: Client attempting to set different loggedBy is rejected
- [ ] Test: Sync doesn't allow loggedBy override from client

### SR-3: PowerSync Credential Security

- [ ] Verify: PowerSync URL not exposed in client bundle (use env var)
- [ ] Verify: Auth tokens not logged in console or error reports
- [ ] Verify: Tokens cleared from memory on logout
- [ ] Test: Expired token triggers re-auth, not crash

### SR-4: Sync Channel Isolation

- [ ] Verify: PowerSync bucket filters by household_id
- [ ] Test: Cannot subscribe to another household's channel
- [ ] Test: Malformed bucket request is rejected
- [ ] Test: Changing household_id triggers resubscription to new bucket

### SR-5: Rate Limiting

- [ ] Implement: Rate limit on caregiver removal API (max 3 per hour)
- [ ] Implement: Rate limit on sync retries (exponential backoff)
- [ ] Test: Excessive API calls return 429 status

### SR-6: Audit Trail

- [ ] Implement: Log all caregiver removals with actor and timestamp
- [ ] Implement: Log conflict resolutions for debugging
- [ ] Verify: Logs don't contain PII or sensitive data

---

## Additional Edge Cases (Review Findings)

### EC-1: Active Timer + Sync Conflicts

- [ ] Test: Active feeding timer on Device A, entry saved on Device B (no conflict)
- [ ] Test: Active timer state is NOT synced (remains local-only)
- [ ] Test: Completing timer while offline, another device edited same baby
- [ ] Verify: Timer completion creates new entry, doesn't overwrite remote

### EC-2: Baby Deletion While Offline

- [ ] Test: Device A deletes baby, Device B has pending entries for that baby
- [ ] Implement: Orphaned entries handling (delete or archive)
- [ ] Test: Sync doesn't fail on orphaned baby_id reference
- [ ] Implement: User notification for orphaned entries

### EC-3: User Leaves and Rejoins Household

- [ ] Test: User removed from household, local data cleared
- [ ] Test: Same user rejoins via invite code, fresh data loaded
- [ ] Test: No stale data persists from previous membership
- [ ] Verify: Old queue items not replayed after rejoin

### EC-4: PowerSync Service Unavailability

- [ ] Implement: Graceful fallback when PowerSync endpoint unreachable
- [ ] Test: App functions in offline mode when service is down
- [ ] Implement: User notification "Sync service unavailable"
- [ ] Test: Automatic reconnection when service recovers

### EC-5: Clock Synchronization Issues

- [ ] Test: Device clock 1 hour ahead (entries with future timestamps)
- [ ] Test: Device clock 1 hour behind (conflict resolution affected)
- [ ] Implement: Server timestamp validation (reject >24hr skew)
- [ ] Implement: Warning if client clock significantly off

### EC-6: Very Large Entries

- [ ] Test: Notes field with 10,000 characters syncs correctly
- [ ] Test: Entry with maximum allowed values in all fields
- [ ] Verify: No truncation during sync
- [ ] Test: Large entry doesn't block other syncs

### EC-7: Concurrent Household Operations

- [ ] Test: Two users regenerate invite code simultaneously
- [ ] Test: Caregiver removal while that user is actively syncing
- [ ] Test: User joins household while owner is removing another user
- [ ] Verify: All operations are atomic and consistent

### EC-8: Storage Limits

- [ ] Test: Behavior when device storage is nearly full
- [ ] Implement: Graceful handling of SQLite write failures
- [ ] Implement: User warning when storage low
- [ ] Test: Queue persists critical operations even under storage pressure

---

## Pre-Merge Security Checklist

Before merging to main, verify:

- [ ] All RLS policies tested with actual Supabase queries
- [ ] No console.log statements with sensitive data
- [ ] No hardcoded credentials or tokens
- [ ] Error messages don't leak internal details
- [ ] All user input is validated before sync
- [ ] PowerSync bucket rules reviewed and tested
- [ ] Rate limiting configured on critical endpoints
- [ ] Audit logging enabled for sensitive operations
- [ ] Rollback tested and documented
