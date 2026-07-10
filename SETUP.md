# Migrations Dashboard — Setup Runbook

This is the "stand up the skeleton" half of Immediate Next Steps from the project plan
(GitHub + Vercel + Cloudflare SSO can start now with no data dependency). HubSpot field
mapping and the complexity formula get wired in once your inputs land (see the checklist
at the bottom).

Do these in order. Each step says who does it and exactly what to click/run.

---

## 1. GitHub — version control

**Who:** You or an engineer, ~10 min.

1. Create a new repo: github.com/new → name it `migrations-dashboard` → private → do not
   initialize with a README (this skeleton already has one).
2. From this folder on your machine:
   ```bash
   cd migrations-dashboard-skeleton
   git init
   git add .
   git commit -m "Initial skeleton: Next.js + HubSpot/Calendar/Slack API stubs"
   git branch -M main
   git remote add origin https://github.com/<your-org>/migrations-dashboard.git
   git push -u origin main
   ```
3. Add teammates under repo Settings → Collaborators, or connect it to your existing
   Moxie GitHub org if this should live there instead of a personal account.

---

## 2. Vercel — hosting

**Who:** You or an engineer, ~10 min.

1. vercel.com → Add New Project → Import the `migrations-dashboard` GitHub repo.
2. Framework preset: Next.js (auto-detected). Leave build settings default.
3. Before first deploy, add the environment variables from `.env.example` (Project →
   Settings → Environment Variables). You won't have real values for all of them yet —
   see the blockers list at the bottom — placeholders are fine to get the skeleton
   deploying.
4. Deploy. You'll get a `*.vercel.app` URL to confirm it's live before pointing a real
   domain at it.

---

## 3. Cloudflare Access — SSO gate

**Who:** Whoever administers your Cloudflare account (likely you, per the vendor list).

1. In Cloudflare dashboard → Zero Trust → Access → Applications → Add an application →
   "Self-hosted".
2. Application domain: the Vercel URL or custom domain you're using for the dashboard.
3. Policy: Allow → Include → Emails ending in `@joinmoxie.com` (or an explicit list of
   migration managers + leadership, if you want it tighter than company-wide).
4. Session duration: 24h is reasonable for an internal tool.
5. Save. Cloudflare now sits in front of the app — anyone hitting the URL has to
   authenticate with their Moxie Google account first, before Next.js ever loads.

This handles the *main dashboard* SSO. The Settings/roster page (Section 6a) gets its
own separate password on top of this, per the plan — that's a simple shared-secret check
inside the app itself, not a second Cloudflare app.

---

## 4. HubSpot — private app + API scopes

**Who:** You (needs HubSpot admin access).

1. HubSpot → Settings → Integrations → Private Apps → Create a private app, name it
   "Migrations Dashboard".
2. Scopes needed (read-only is enough for V1):
   - `crm.objects.companies.read`
   - `crm.objects.tickets.read`
   - `crm.schemas.tickets.read` (to resolve custom property internal names)
   - `crm.objects.owners.read` (to resolve Ticket owner / Migrations Manager if stored
     as HubSpot owner IDs rather than free text)
3. Copy the generated access token → this becomes `HUBSPOT_PRIVATE_APP_TOKEN` in Vercel's
   env vars. Treat it like a password — it's the one credential in this whole stack that
   isn't behind SSO, so don't paste it anywhere outside Vercel's env var UI.
4. Confirm the internal property names for everything in Section 5 of the plan
   (Medspa ID, Migrations Manager, Target Launch Date, Provider Segment (Pre-Launch),
   etc.) — internal names often differ from the display labels. Settings → Properties →
   search each label → copy the "internal name" shown at the bottom of the property
   editor. Drop them into `lib/hubspotClient.js` where marked.

`pages/api/hubspot/tickets.js` and `companies.js` in this skeleton show the exact API
calls and expect those internal names as a lookup map.

---

## 5. Google Calendar API — manager availability

**Who:** You, in coordination with whoever administers Google Workspace for Moxie.

Two ways to do this — pick one before building further (this is Open Input #4 in the
plan):

**Option A — Domain-wide delegation (recommended):** a Workspace admin authorizes a
service account once; after that it can read any manager's calendar with no per-person
action. One-time setup:

1. Google Cloud Console → new project (or reuse an existing Moxie one) → enable the
   "Google Calendar API".
2. Create a Service Account → generate a JSON key → this becomes
   `GOOGLE_SERVICE_ACCOUNT_JSON` in Vercel (base64-encode it, since Vercel env vars are
   single-line strings — see `.env.example` for the exact format expected).
3. Copy the service account's Client ID.
4. Workspace Admin Console → Security → API Controls → Domain-wide Delegation → Add new
   → paste the Client ID → Scopes: `https://www.googleapis.com/auth/calendar.readonly`.
5. Done — no further action needed as managers are added; the roster's "Confirm Added"
   step in Settings becomes closer to a formality than a recurring manual task.

**Option B — Individual sharing:** each manager shares their calendar with the service
account's email individually (Settings → Share with specific people → paste service
account address → "See all event details"). This is the flow the plan describes for the
"please add this person" email — works with zero admin involvement, but it's a recurring
manual step every time someone joins the roster.

`pages/api/calendar/freebusy.js` in this skeleton queries free/busy for a list of
manager emails — works the same either way once the service account has access.

---

## 6. Slack API — tagging alerts

**Who:** You (needs permission to create Slack apps in the Moxie workspace, or someone
who does).

1. api.slack.com/apps → Create New App → From scratch → name it "Migrations Dashboard" →
   pick the Moxie workspace.
2. OAuth & Permissions → Bot Token Scopes, add:
   - `chat:write` (send DMs/channel messages when someone is @ tagged)
   - `users:read.email` (match a roster email to a Slack user ID)
3. Install the app to the workspace → copy the "Bot User OAuth Token"
   (`xoxb-...`) → this becomes `SLACK_BOT_TOKEN` in Vercel.
4. `pages/api/slack/notify.js` shows the lookup-by-email → DM flow used when a note in
   the dashboard tags a teammate.

---

## 7. Firebase / Firestore — data store

**Who:** You or an engineer, ~10 min.

1. console.firebase.google.com → Add project (or reuse one if Moxie already has a
   Firebase org).
2. Build → Firestore Database → Create database → production mode → pick a region close
   to your users.
3. Project settings → Service accounts → Generate new private key → same
   base64-into-env-var treatment as the Google Calendar service account
   (`FIREBASE_SERVICE_ACCOUNT_JSON`).
4. This is where the scheduled HubSpot/Calendar/Notion sync writes to, and what the
   dashboard reads from for speed (per the plan's "why Firestore instead of live-only
   calls" note — HubSpot and Calendar API rate limits make on-demand-only pulls risky at
   refresh scale).

---

## What's still blocking a full build

Straight from Section 9 of the plan — nothing below needs GitHub/Vercel/Cloudflare, so
steps 1–3 above can proceed in parallel while these land:

1. HubSpot field/API scopes — confirmed in Section 5, still need the actual internal
   property names (see step 4 above)
2. A sample, well-populated HubSpot ticket (Ayla Aesthetics + intake summary — already
   received per the doc)
3. Manager list — full names + emails for every migrations manager
4. Calendar access method — domain-wide delegation vs. individual sharing (Section 5
   above; changes how much ongoing manual work Settings requires)
5. Capacity rule defaults — hours-per-segment table + launch-proximity multiplier bands
6. EMR risk score for "Booker" — currently unscored in your complexity workbook
7. Full task checklist per pipeline phase — only kick-off/discovery/service-menu are
   defined so far
8. Where "Migrations Manager" actually lives in HubSpot — Company object, Ticket object,
   or both
9. Scraping field source — pending confirmation between Amira and Marianne

Send these over and the HubSpot field mapping + complexity formula get wired into the
skeleton's API routes next.
