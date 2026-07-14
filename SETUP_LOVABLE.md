# Migrations Dashboard — Lovable + Firebase Setup Runbook

This replaces the earlier Supabase version of this runbook. Per your call: keep Lovable
for the frontend (Vite + React), but keep Firebase for auth + data instead of moving to
Supabase. Google sign-in is domain-restricted to `@joinmoxie.com` via a Firebase Auth
**Blocking Function** — that's the actual security gate, not just UI. Firestore replaces
Supabase Postgres as the data store. HubSpot/Notion/Calendar/Slack integrations are
Firebase Cloud Functions (Node.js — same SDKs as the very first Next.js version, just
running on Firebase's Node runtime instead of Vercel's).

The dashboard UI itself (`public/dashboard.html`) is unchanged — still the same
interactive mock you've been reviewing, mounted inside the React shell via an iframe.
It's still running on sample data; wiring it to real Firestore data is a follow-up step
once the collections below are populated (see the note at the bottom).

---

## 1. Firebase project

**Who:** You, ~10 min.

1. console.firebase.google.com → Add project → name it `migrations-dashboard` (or
   reuse an existing Moxie Firebase project if you have one already).
2. Build → Firestore Database → Create database → production mode → pick a region.
3. Project settings (gear icon) → General → scroll to "Your apps" → Add app → Web (`</>`)
   → register it (no need for Firebase Hosting, Lovable serves the frontend) → copy the
   config object. You'll map these into env vars:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
4. Install the Firebase CLI locally (`npm install -g firebase-tools` — run this on your
   own machine; this sandbox can't reach the npm registry), then from this folder:
   ```bash
   firebase login
   firebase use --add          # pick your project, give it an alias like "default"
   firebase deploy --only firestore:rules,firestore:indexes
   ```

---

## 2. Lovable

**Who:** You, ~10 min.

1. lovable.dev → New project → **Import from GitHub** → point it at this repo (push
   everything in this folder to GitHub first).
2. Lovable auto-detects the Vite+React setup. Add the six frontend env vars from
   Section 1 under Project Settings → Environment Variables.
3. Publish. Lovable gives you a `*.lovable.app` URL (custom domain later under
   Settings → Domains).

---

## 3. Google sign-in, restricted to @joinmoxie.com — the real gate

**Who:** You, ~20 min. This is the step that actually enforces the security requirement
("only verified Google accounts on @joinmoxie.com"), so don't skip 3.2–3.3.

**3.1 — Enable Google as a sign-in provider**
1. Firebase console → Build → Authentication → Get started (if not already) → Sign-in
   method tab → Google → Enable → set a support email → Save.
2. Firebase auto-creates the OAuth client for you under the hood; no separate Google
   Cloud Console step is required for basic sign-in (only needed later in Section 4 for
   the Calendar service account, which is unrelated).

**3.2 — Upgrade to Identity Platform (required for Blocking Functions)**
Blocking Functions (`beforeSignIn`) are an Identity Platform feature, not "plain"
Firebase Auth. The upgrade is still free-tier eligible for normal usage.
1. Firebase console → Authentication → Settings tab → banner near the top offers
   "Upgrade to Identity Platform" → follow it. (If you don't see the banner, go to
   Google Cloud Console → Identity Platform → Enable — same effect.)
2. This does not change how users sign in; it just unlocks the blocking-function hook.

**3.3 — Deploy the blocking function**
`functions/index.js` (already written) exports `beforeSignIn`, which:
- Rejects the sign-in unless `event.data.emailVerified === true`
- Rejects the sign-in unless the email domain is exactly `joinmoxie.com`
- Throws an `HttpsError("permission-denied", ...)` otherwise, which `signInWithPopup()`
  on the frontend throws synchronously — caught and shown as an error in
  `src/pages/SignIn.jsx`.

Deploy it:
```bash
cd functions
npm install
cd ..
firebase deploy --only functions:beforeSignIn
```
Then wire it up as the actual trigger: Firebase console → Authentication → Settings →
Blocking functions → **Before sign-in** → select the deployed `beforeSignIn` function →
Save. (Some console versions call this "Before user signed in".)

**3.4 — Verify it**
- Sign in with a `@joinmoxie.com` Google account → should reach the dashboard.
- Sign in with a personal Gmail account → should be rejected before any Firebase user
  record is created (check Authentication → Users — no row should appear for the
  rejected attempt).

**3.5 — Frontend pieces already wired up**
- `src/lib/firebaseClient.js` — Firebase app/auth init + `signInWithGoogle()` /
  `signOut()` helpers.
- `src/pages/SignIn.jsx` — the "Continue with Google" screen, catches and displays the
  blocking-function rejection.
- `src/App.jsx` — redirects signed-out visitors to `/sign-in`, signed-in visitors to the
  dashboard, via `onAuthStateChanged`.
- `src/pages/Unauthorized.jsx` — defense-in-depth page, shouldn't normally be reachable
  since 3.3 stops disallowed accounts before sign-in completes.

---

## 4. Cloud Function secrets (HubSpot, Notion, Google Calendar, Slack)

**Who:** You, ~10 min once you have the actual credentials.

Cloud Functions secrets are separate from the frontend's `VITE_*` env vars — set them
with the CLI (stored in Google Secret Manager, not committed anywhere):

```bash
firebase functions:secrets:set HUBSPOT_PRIVATE_APP_TOKEN
firebase functions:secrets:set NOTION_API_KEY
firebase functions:secrets:set NOTION_EMR_DATABASE_ID
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
firebase functions:secrets:set SLACK_BOT_TOKEN
```
(Each command prompts you to paste the value — nothing to type inline, nothing logged.)

HubSpot private app scopes needed: `crm.objects.companies.read`,
`crm.objects.tickets.read`, `crm.schemas.tickets.read`, `crm.objects.owners.read`.

Notion: create an internal integration at notion.so/my-integrations, share the "Known
EMR Systems & Nuances For Migration" database with it, grab the database ID from the
URL.

Google Calendar: Google Cloud Console → Service Account → JSON key → base64-encode it →
Workspace Admin Console → Security → API Controls → Domain-wide Delegation → authorize
the `calendar.readonly` scope for that service account's Client ID.

Slack: api.slack.com/apps → bot scopes `chat:write` + `users:read.email` → install to
workspace → Bot User OAuth Token.

---

## 5. Deploy the Cloud Functions

```bash
firebase deploy --only functions
```

This deploys `beforeSignIn`, `nightlyRefresh`, `calendarFreebusy`, and `slackNotify`
together. Test the sync manually before waiting for the schedule:
```bash
firebase functions:shell
# then inside the shell:
nightlyRefresh()
```
Check the `companies` and `tickets` collections in the Firestore console afterward —
you should see documents appear, plus a `settings/lastSync` doc with a timestamp.

---

## 6. Nightly schedule

Already configured in code — `nightlyRefresh` in `functions/index.js` uses `onSchedule`
with cron `0 3 * * *` (3:00 AM, project default timezone). Firebase provisions the
Cloud Scheduler job automatically on `firebase deploy --only functions` — no separate
cron setup needed (unlike the Supabase `pg_cron` approach). To change the time, edit the
`schedule` string in `functions/index.js` and redeploy.

---

## 7. Manager roster + capacity settings

The `managerRoster` and `settings` Firestore collections hold the roster and the
editable capacity factors (complexity-score → hours, EMR-migrated-before → hours,
per-segment → hours, travel-required extra days). For now, add documents directly in
the Firestore console (Firestore Database → Start collection). Firestore rules already
restrict writes on `managerRoster` to Cloud Functions only (Admin SDK bypasses rules),
so console edits there need to go through the Admin SDK or a temporary rules relax — the
`settings` collection, by contrast, allows authenticated writes, so the in-app Settings
tab (once wired to Firestore) can write there directly.

---

## What's still the same as before (unaffected by the Supabase → Firebase move)

- The 15-stage pipeline, segment tiers (Enterprise/Gold/Silver/Experienced/Growth/
  Beginner/No Segment), EMR-migrated + scraper logic, and capacity formula are all
  still just JS logic inside `public/dashboard.html` — none of that needed to change
  for this swap.
- The open HubSpot question from the original plan is unchanged: confirm whether
  `closed_date` on the Ticket object is meant to replace `migration_complete_date` or
  is a distinct field (both are currently synced separately in
  `functions/_shared/hubspotClient.js`).

## Connecting the dashboard to real data (next step, not done yet)

`public/dashboard.html` still reads from its hardcoded `TICKETS` / `MANAGERS` /
`NOTION_EMR_TABLE` JS arrays. Once the collections above have real synced data, the
follow-up is swapping those arrays for the Firebase JS SDK's `getDocs`/`onSnapshot`
calls against the `tickets` and `companies` collections (same Firebase app instance
already initialized in `src/lib/firebaseClient.js`). Say the word when you're ready for
that pass.
