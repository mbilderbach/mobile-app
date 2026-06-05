# Prayer app — build roadmap

Living backlog. We build **one iteration at a time** to avoid overload. Each item is grounded in the audit + product asks. Check items off as they ship.

---

## ✅ Iteration 1 — Organization & search (shipped)
- [x] Manage categories outside of creation — dedicated screen to **add / rename / change emoji / delete** categories (delete leaves prayers, just uncategorizes them).
- [x] Remove the category **color dot** from chips & Browse headers (each category keeps an auto-assigned color under the hood that drives the Pray-along glow; user never edits it).
- [x] **Persistent search** in Browse (always-visible input, not a button) that matches **title + contents (notes/scripture)**.

## 🔴 Core loop (the app's reason to exist — currently non-functional)
- [x] **Persist auth session** (AsyncStorage) so users aren't logged out every cold start. _(Iteration 2)_
- [x] **Native date/time pickers** (web kept; iOS/Android now use native controls). _(Iteration 3)_
- [x] **Local notifications** (`expo-notifications`) so reminders actually fire.
- [x] **Recurrence engine** — advance `schedule_date`/`next_fire` for daily/weekly/monthly + carry forward missed days (overdue), so a recurring prayer reappears.

## 🟣 Spiritual arc (the payoff)
- [x] **Mark a prayer "Answered"** + capture a short testimony/answer note + `answered_at`.
- [x] **Answered / Archive views** — retire & revisit resolved prayers; a journey/history you can look back on.
- [x] **Neglect resurfacing** — update `last_prayed_at` on every session (not just Pray-along) + surface "haven't prayed for this in a while."

## ⚪️ Robustness & trust (shipped)
- [x] Handle write failures — surfaced via a shared toast (`components/Toast.tsx`) across add/edit/session/onboarding/categories/answered; text is kept on failure.
- [x] Loading / error / offline states — `components/ScreenState.tsx` on Today, Browse, prayer detail (distinguishes loading / failed / offline / empty, with Retry).
- [x] Soft-delete + **undo** for prayers — `deleted_at` column; delete soft-deletes + cancels the reminder, sessions are preserved, and an Undo toast fully restores. _(requires the migration below)_
- [x] Wire **onboarding** (per-user flag in AuthContext routes new sign-ups through it), **password reset** (`resetPasswordForEmail` on the auth screen), and **Sign in with Apple** (`expo-apple-authentication`, iOS-only). _(needs the deploy steps below)_

## 🤝 Iteration 4 — Together (Circles & shared prayer) — built, awaiting deploy + verification
The social core: a private, invite-only group where members share requests and "carry" each other's by praying. Privacy + safety are enforced in the database ("safe by construction"), not the client.
- [x] **Circles** — create (you become leader) / join by invite code, with a cached per-circle display name; rename, leave, mute. No discovery — you reach a circle only by creating or joining one. (`lib/circles.ts`, `app/circle-create.tsx`, `app/circle-join.tsx`, `app/circle-settings.tsx`)
- [x] **Shared requests** — share a prayer into a circle (optionally **anonymous**, owner masked server-side), mark **answered** with a gratitude line (becomes a kept warm card), or **withdraw**. (`app/circle-share.tsx`, `app/circle-request.tsx`)
- [x] **The carry (presence, not metrics)** — one tap = "I'm praying for this"; the only message a carrier can send is the fixed "praying with you." Assurance is surfaced **by name** ("Mara & 2 others praying"), never a leaderboard or per-person score.
- [x] **Owner-only updates thread** — only the request's owner can post updates (enforced by the INSERT policy); the carry itself is the carrier's message.
- [x] **Time-bound convergence** — "remind me to pray at the moment" records shared intent so the circle converges, and schedules a gentle local notification.
- [x] **Together tab** — empty-state welcome (Create / Join) vs. in-circle masthead (name, avatars, live presence line) over the request stream. (`app/(tabs)/together.tsx`, `components/circle/CircleBits.tsx`)
- [ ] **Deploy the migration** (see step 4 below) — until applied, the Together tab errors.
- [ ] **End-to-end verification** against the live schema — built but not yet exercised in a running app.

## 🟡 Smaller polish (shipped)
- [x] Persist Settings toggles (`lib/preferences.ts`, AsyncStorage) + **haptics actually fire** (`lib/haptics.ts` on session save / Amen / answered; Reminders toggle now gates scheduling).
- [x] Accessibility — VoiceOver roles/labels on shared primitives + every icon-only control; Dynamic Type with capped scaling on display type.
- [x] Background-safe timer — session timer is now wall-clock based and re-syncs on foreground (no more undercounting in the background).
- [x] Clean orphaned scope — removed `expo-camera`, `PrayerRow`/`InboxCard`, and the unwired `for_subject` / `urgency` / `attachment_url` fields.

---

## 🚀 Deploy steps before this ships (need your action)
1. **Apply the soft-delete migration** to Supabase: `supabase/migrations/20260531000000_add_soft_delete_to_prayers.sql`. Until then, Today/Browse queries reference `deleted_at` and will error.
2. **Make a native build** (dev client or EAS) — `expo-haptics` and `expo-apple-authentication` are native modules and won't run in plain Expo Go.
3. **Enable the Apple provider** in Supabase Auth (Service ID + key) and add the *Sign in with Apple* capability under your Apple Developer account so `signInWithIdToken({ provider: 'apple' })` is accepted.
4. **Apply the Circles migration** to Supabase: `supabase/migrations/20260601000000_add_circles_shared_prayers.sql` (tables, RLS, the `*_cards` views, and the `create_circle` / `join_circle_by_code` SECURITY DEFINER RPCs). Until applied, the Together tab and every `lib/circles.ts` call will error. Then verify the flow end-to-end: create a circle, join from a second account by code, share a request, carry it, and confirm the named assurance line + anonymity masking behave as specified.
