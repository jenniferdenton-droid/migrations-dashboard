# Migrations Dashboard (Lovable + Supabase)

Vite + React shell with Supabase Google-SSO auth (restricted to @joinmoxie.com),
wrapping the same interactive dashboard mock (`public/dashboard.html`) used in the
earlier Vercel/Next.js/Clerk/Firebase version. See `SETUP_LOVABLE.md` for the full
setup runbook — start there.

## File structure

```
src/
  App.jsx                  Route guard: signed-out -> /sign-in, signed-in -> dashboard
  main.jsx                 React entry point
  lib/supabaseClient.js    Supabase client + signInWithGoogle()/signOut()
  pages/SignIn.jsx         "Continue with Google" screen
  pages/Unauthorized.jsx   Defense-in-depth page (shouldn't normally be reachable)
  pages/Dashboard.jsx      Mounts public/dashboard.html in an iframe
public/
  dashboard.html           The dashboard itself — unchanged vanilla JS/Chart.js file
supabase/
  migrations/
    0001_init.sql          Postgres schema (companies, tickets, manager_roster, etc.)
    0002_domain_gate.sql   "Before user created" hook restricting signup to your domain
  functions/
    nightly-refresh/       HubSpot + Notion -> Postgres sync (replaces Vercel Cron)
    calendar-freebusy/     Google Calendar free/busy lookup
    slack-notify/          @mention -> Slack DM
    _shared/                Deno HubSpot/Notion clients + CORS headers
```

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## What's a stub vs. what's real

- **Real:** Supabase Auth wiring, the domain-restriction hook, the Postgres schema, and
  all three Edge Functions make live API calls once their secrets are set (see
  `SETUP_LOVABLE.md` Section 4).
- **Still a mock:** `public/dashboard.html` reads from hardcoded sample data (`TICKETS`,
  `MANAGERS`, `NOTION_EMR_TABLE` arrays at the top of its `<script>`), same as it did on
  Vercel. Connecting it to the new Postgres tables is the next build step — see the
  last section of `SETUP_LOVABLE.md`.
