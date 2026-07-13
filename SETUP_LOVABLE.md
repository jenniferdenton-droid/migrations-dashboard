# Migrations Dashboard — Lovable + Supabase Setup Runbook

This replaces the earlier Vercel + Next.js + Clerk + Firebase runbook. Architecture
change, per your call: Vite + React (Lovable-native) instead of Next.js, Supabase Auth
(Google SSO, domain-restricted to @joinmoxie.com) instead of Clerk, and Supabase
Postgres instead of Firebase/Firestore for the data store. HubSpot/Notion/Calendar/Slack
integrations move from Next.js API routes to Supabase Edge Functions.

The dashboard UI itself (`public/dashboard.html`) is unchanged — still the same
interactive mock you've been reviewing, now mounted inside the React shell via an
iframe. It's still running on sample data; wiring it to real Supabase data is a
follow-up step once the tables below are populated (see the note at the bottom).

---

## 1. Supabase project

**Who:** You, ~10 min.

1. supabase.com → New project → name it `migrations-dashboard` → pick a region close to
   your users → set a strong database password (save it somewhere; you'll need it for
   the CLI).
2. Project Settings → API → copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (used by Edge Functions only —
     never put this in the frontend/`VITE_*` vars, it bypasses all row security)
3. Install the Supabase CLI locally (`npm install -g supabase`, or `brew install
   supabase/tap/supabase`), then from this folder:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>   # the ref is in your project URL
   supabase db push                                  # applies supabase/migrations/*.sql
   ```
   This creates the `companies`, `tickets`, `manager_roster`, `ticket_notes`,
   `emr_table`, and `capacity_settings` tables plus their RLS policies.

---

## 2. Lovable

**Who:** You, ~10 min.

1. lovable.dev → New project → **Import from GitHub** → point it at this repo
   (push everything in this folder to GitHub first, same drag-and-drop-if-terminal-
   doesn't-work approach as before).
2. Lovable auto-detects the Vite+React setup. Add the two frontend env vars under
   Project Settings → Environment Variables:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
3. Publish. Lovable gives you a `*.lovable.app` URL (and lets you attach a custom
   domain later under Settings → Domains).

---

## 3. Google sign-in, restricted to @joinmoxie.com

**Who:** You, ~15 min.

**3.1 — Enable Google as a provider**
1. Supabase dashboard → Authentication → Providers → Google → enable it.
2. You need a Google OAuth Client ID/Secret: Google Cloud Console → APIs & Services →
   Credentials → Create OAuth client ID → Web application → add Supabase's callback URL
   (shown right on that same Providers page in Supabase, looks like
   `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Paste the Client ID and Secret into Supabase's Google provider settings → Save.

**3.2 — Restrict to your domain (the real gate)**
1. `supabase/migrations/0002_domain_gate.sql` (already applied via `supabase db push`
   in Section 1) creates a Postgres function, `restrict_signup_to_moxie_domain`, that
   raises an error — blocking account creation — for any email outside
   `joinmoxie.com`.
2. Wire it up: Supabase dashboard → Authentication → Hooks → **Before User Created** →
   select `restrict_signup_to_moxie_domain` → Save.
3. That's it — anyone outside the domain who tries "Continue with Google" gets bounced
   with an error before an account is ever created. No invite list to maintain, no
   per-person approval step.
4. If you ever need a second domain, edit the `allowed_domains` array inside the SQL
   function (`supabase/migrations/0002_domain_gate.sql`) and re-run `supabase db push`.

**3.3 — Frontend pieces already wired up**
- `src/lib/supabaseClient.js` — the Supabase client + `signInWithGoogle()` /
  `signOut()` helpers.
- `src/pages/SignIn.jsx` — the "Continue with Google" screen.
- `src/App.jsx` — redirects signed-out visitors to `/sign-in`, signed-in visitors to
  the dashboard.
- `src/pages/Unauthorized.jsx` — a defense-in-depth page that shouldn't normally be
  reachable, since the hook in 3.2 stops disallowed accounts before they exist.

---

## 4. Edge Function secrets (HubSpot, Notion, Google Calendar, Slack)

**Who:** You, ~10 min once you have the actual credentials.

Edge Function secrets are separate from the frontend's `VITE_*` env vars — set them
with the CLI, not in Lovable's environment variables UI (Lovable's env vars only reach
the browser bundle):

```bash
supabase secrets set HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-xxxx
supabase secrets set NOTION_API_KEY=secret_xxxx
supabase secrets set NOTION_EMR_DATABASE_ID=xxxx
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=xxxx
supabase secrets set SLACK_BOT_TOKEN=xoxb-xxxx
supabase secrets set CRON_SECRET=change-me
```

`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are already available to every Edge
Function automatically — no need to set those yourself.

HubSpot private app scopes needed (same as before): `crm.objects.companies.read`,
`crm.objects.tickets.read`, `crm.schemas.tickets.read`, `crm.objects.owners.read`.

Notion: create an internal integration at notion.so/my-integrations, share the "Known
EMR Systems & Nuances For Migration" database with it, grab the database ID from the
URL.

Google Calendar: same domain-wide-delegation service account approach as before —
Google Cloud Console → Service Account → JSON key → base64-encode it → Workspace Admin
Console → Security → API Controls → Domain-wide Delegation → authorize the
`calendar.readonly` scope for that service account's Client ID.

Slack: api.slack.com/apps → bot scopes `chat:write` + `users:read.email` → install to
workspace → Bot User OAuth Token.

---

## 5. Deploy the Edge Functions

```bash
supabase functions deploy nightly-refresh
supabase functions deploy calendar-freebusy
supabase functions deploy slack-notify
```

Test the sync manually before scheduling it:
```bash
supabase functions invoke nightly-refresh
```
Check the `companies` and `tickets` tables in the Supabase Table Editor afterward —
you should see rows appear.

---

## 6. Nightly schedule (12:00 AM ET)

**Who:** You, ~5 min, once Section 4/5 are working.

Supabase schedules Edge Functions via `pg_cron` + `pg_net`, run as SQL in the Supabase
dashboard's SQL Editor (Database → Cron is a UI wrapper over the same thing):

```sql
select cron.schedule(
  'nightly-refresh',
  '0 5 * * *', -- 5am UTC = 12am ET (adjust to 0 4 * * * during EST months if you want it pinned exactly)
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/nightly-refresh',
    headers := jsonb_build_object('Authorization', 'Bearer <your CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
```

`pg_cron` and `pg_net` need to be enabled once first: Database → Extensions → enable
both.

---

## 7. Manager roster + capacity settings

The `manager_roster` and `capacity_settings` tables replace the old Firestore
`managerRoster` and `settings/capacityRules` collections. For now, add rows directly in
the Supabase Table Editor (Table Editor → `manager_roster` → Insert row). A settings UI
for editing these in-app (mirroring the dashboard mock's Settings tab) is the natural
next build step once the rest of this is live.

---

## What's still the same as before (unaffected by the Vercel → Lovable move)

- The 15-stage pipeline, segment tiers (Enterprise/Gold/Silver/Experienced/Growth/
  Beginner/No Segment), EMR-migrated + scraper logic, and capacity formula are all
  still just JS logic inside `public/dashboard.html` — none of that needed to change
  for the platform swap.
- The open HubSpot questions from the original plan are unchanged: confirm whether
  `closed_date` on the Ticket object is meant to replace `migration_complete_date` or
  is a distinct field, and the "Booker" EMR complexity score is still unscored.

## Connecting the dashboard to real data (next step, not done yet)

`public/dashboard.html` still reads from its hardcoded `TICKETS` / `MANAGERS` /
`NOTION_EMR_TABLE` JS arrays — same as it did on Vercel. Once the tables above have real
synced data, the follow-up is swapping those arrays for `fetch()` calls against
Supabase's REST API (`https://<project-ref>.supabase.co/rest/v1/tickets` with the anon
key, filtered by RLS) or the `@supabase/supabase-js` client loaded directly into that
HTML file. Say the word when you're ready for that pass.
