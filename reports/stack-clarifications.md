# Stack Clarifications Report

## Questions Addressed

1. Do you need Expo for React Native?
2. Do you need Zustand/Jotai for state management?
3. Supabase vs Firebase cost comparison at scale

---

## 1. Do You Need Expo for React Native?

**No, Expo is optional.** You have two paths:

| Approach | What it means |
|----------|---------------|
| **React Native CLI (bare)** | Just React Native, no Expo. You manage native code directly. |
| **Expo** | A framework ON TOP of React Native that adds conveniences |

### What Expo Gives You

- Cloud builds (no local Xcode/Android Studio needed)
- Over-the-air updates (push JS changes without app store review)
- Pre-configured APIs (notifications, camera, etc.)
- Expo Go app for quick testing on your phone
- Managed native dependencies

### Without Expo (Bare React Native)

- More control over native code
- Easier to add Apple Watch, widgets from the start
- Smaller app bundle size
- You need Xcode + Android Studio installed locally
- More manual configuration for native features

### Recommendation

Since the requirements include Apple Watch and widgets, **bare React Native (no Expo framework)** is the cleaner path. This avoids the complexity of "ejecting" from Expo later when you need native features.

**Note:** You can still use **Expo EAS** just for cloud builds even without using the Expo framework itself. EAS Build works with any React Native project.

---

## 2. Do You Need Zustand/Jotai?

**No, you don't need them.** React's built-in state management is sufficient for most apps.

### State Management Options

| Tool | Best For |
|------|----------|
| **useState** | Local component state (form inputs, toggles) |
| **useReducer** | Complex local state with multiple actions |
| **Context API** | Shared state across component tree |
| **Zustand/Jotai** | When Context becomes a performance problem |

### For a Baby Tracker App

The state requirements are relatively simple:

- **Database state:** Lives in Supabase/PowerSync (not React state)
- **UI state:** Current screen, active timer, form inputs
- **User state:** Logged in user, selected baby profile

This is easily handled by **React Context + useReducer**.

### When You'd Need Zustand

Zustand/Jotai become valuable when:
- You have many Context consumers re-rendering on every update
- You need fine-grained subscriptions (component only re-renders for specific state changes)
- State updates are very frequent (real-time data)

### Recommendation

**Start with React Context + useReducer.** It's built-in, no extra dependency, and sufficient for this app's needs.

Zustand is only ~3KB and trivial to add later if you hit performance issues. Don't add complexity before you need it.

### Example Structure

```typescript
// contexts/AppContext.tsx
type AppState = {
  currentBaby: Baby | null;
  activeTimer: Timer | null;
  user: User | null;
};

type AppAction =
  | { type: 'SET_BABY'; payload: Baby }
  | { type: 'START_TIMER'; payload: Timer }
  | { type: 'STOP_TIMER' }
  | { type: 'SET_USER'; payload: User };

const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
} | null>(null);
```

---

## 3. Supabase vs Firebase: Cost at Scale

### Pricing Models

**Supabase** charges by:
- Database storage (GB)
- Bandwidth (GB transferred)
- Monthly active users for auth

**Firebase** charges by:
- Number of read operations
- Number of write operations
- Storage (GB)
- Bandwidth

### Supabase Pricing Tiers

| Tier | Monthly Cost | Includes |
|------|--------------|----------|
| Free | $0 | 500MB DB, 2GB bandwidth, 50k MAU auth |
| Pro | $25 | 8GB DB, 250GB bandwidth, daily backups |
| Team | $599 | SOC2 compliance, priority support, SSO |

### Firebase Pricing (Firestore)

| Operation | Cost |
|-----------|------|
| Document reads | $0.036 per 100,000 |
| Document writes | $0.108 per 100,000 |
| Document deletes | $0.013 per 100,000 |
| Storage | $0.026 per GB |
| Network egress | $0.12 per GB |

### Usage Assumptions for Baby Tracker

Typical user behavior:
- 20 write operations per day (log feeding, diaper, sleep, etc.)
- 50 read operations per day (view history, stats, dashboard)
- Active for 30 days per month
- Per user per month: **600 writes, 1,500 reads**

### Cost Comparison by User Count

| Active Users | Firebase Estimated | Supabase |
|--------------|-------------------|----------|
| 1,000 | $2-5/mo | $0 (free tier) |
| 5,000 | $12-25/mo | $0 (free tier) |
| 10,000 | $25-50/mo | $25/mo (Pro) |
| 25,000 | $60-125/mo | $25-50/mo |
| 50,000 | $125-250/mo | $25-75/mo |
| 100,000 | $250-500/mo | $75-150/mo |

**Note:** Firebase costs can spike unexpectedly if:
- Users refresh frequently (more reads)
- You have real-time listeners (continuous reads)
- App has bugs causing excessive operations

### Cost Analysis

**Supabase Advantages:**
1. **Predictable costs** - flat tiers, not per-operation
2. **Cheaper at scale** - especially for read-heavy apps
3. **No surprise bills** - Firebase per-operation can spike
4. **Self-host option** - reduce costs to just server hosting (~$20-50/mo)

**Firebase Advantages:**
1. **Better offline sync** - built-in, battle-tested
2. **Slightly cheaper at very small scale** - generous free reads/writes
3. **Integrated push notifications** - Firebase Cloud Messaging is excellent
4. **More mature** - longer track record

### Recommendation

**Supabase is the better choice** for this project because:

1. **PostgreSQL** - You already know SQL, no learning NoSQL
2. **Predictable pricing** - No per-operation surprises
3. **Real-time included** - Built-in subscriptions for caregiver sync
4. **Privacy story** - Can self-host for true "privacy-first" claim
5. **Row-level security** - Fine-grained access control for multi-caregiver

**Offline sync** (Firebase's main advantage) is handled by **PowerSync**, which syncs SQLite ↔ PostgreSQL.

---

## Scaling Path: No Architecture Changes Required

The recommended stack scales without rewrites:

### User Growth Tiers

```
1,000 users   → Supabase Free + PowerSync Free     → $0/mo
5,000 users   → Supabase Free + PowerSync Free     → $0/mo
10,000 users  → Supabase Pro + PowerSync Pro       → $74/mo ($25 + $49)
25,000 users  → Supabase Pro + PowerSync Pro       → $74-100/mo
50,000 users  → Supabase Pro + PowerSync Pro       → $100-150/mo
100,000 users → Supabase Team OR self-host         → $599/mo or ~$100/mo
```

### What Changes at Each Tier

| Tier | Change Required |
|------|-----------------|
| Free → 10k | Upgrade Supabase plan (one click) |
| 10k → 50k | Possibly add compute add-on to Supabase |
| 50k → 100k | Consider self-hosting for cost savings |
| 100k+ | Enterprise plans or dedicated infrastructure |

**Key point:** The code doesn't change. You just upgrade service tiers.

---

## Final Recommended Stack

Based on this analysis:

```
Frontend:     React Native CLI (bare) + TypeScript + NativeWind
State:        React Context + useReducer (upgrade to Zustand if needed)
Backend:      Supabase (PostgreSQL + Auth + Real-time)
Sync:         PowerSync (SQLite on device ↔ PostgreSQL)
Native:       Swift (Apple Watch, iOS widgets), Kotlin (Android widgets)
Build:        Expo EAS Build (works with bare React Native)
Notifications: Expo Notifications or Firebase Cloud Messaging
```

### Why This Stack

| Requirement | Solution |
|-------------|----------|
| iOS + Android | React Native (single codebase) |
| Apple Watch | Swift (native, required) |
| Widgets | Swift/Kotlin (native, required) |
| Real-time sync | Supabase real-time subscriptions |
| Offline-first | PowerSync (SQLite ↔ PostgreSQL) |
| Multi-caregiver | Supabase row-level security |
| Privacy-first | Can self-host Supabase |
| Familiar tech | React, TypeScript, SQL |
| Cost effective | $0 to start, ~$75/mo at 10k users |

### Estimated Costs

| Phase | Users | Monthly Cost |
|-------|-------|--------------|
| Launch | 0-1,000 | $0 + $10.33/mo (App Store fees amortized) |
| Growth | 1,000-10,000 | $25-75/mo |
| Scale | 10,000-50,000 | $75-150/mo |
| Mature | 50,000+ | $150-600/mo (or self-host for less) |

---

*Report created: January 2026*
