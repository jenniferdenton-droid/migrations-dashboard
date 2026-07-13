# Migrations Dashboard (Lovable + Firebase)

Vite + React shell with Firebase Google-SSO auth (restricted to @joinmoxie.com via a
Blocking Function — the real access gate, not just UI), wrapping the same interactive
dashboard mock (`public/dashboard.html`) used in every earlier version of this project.
See `SETUP_LOVABLE.md` for the full setup runbook — start there.

## File structure

```
src/
  App.jsx                  Route guard: signed-out -> /sign-in, signed-in -> dashboard
  main.jsx                 React entry point
  lib/firebaseClient.js    Firebase app/auth init + signInWithGoogle()/signOut()
  pages/SignIn.jsx         "Continue with Google" screen
  pages/Unauthorized.jsx   Defense-in-depth page (shouldn't normally be reachable)
  pages/Dashboard.jsx      Mounts public/dashboard.html in an iframe
public/
  dashboard.html           The dashboard itself — unchanged vanilla JS/Chart.js file
firebase.json              Firestore + Functions config
firestore.rules            Security rules (signed-in required on every collection)
firestore.indexes.json     Placeholder — add composite indexes here if queries need them
functions/
  index.js                 beforeSignIn (the real auth gate), nightlyRefresh,
                           calendarFreebusy, slackNotify
  _shared/
    hubspotClient.js       HubSpot company/ticket/owner fetchers (Node SDK)
    notionClient.js        Notion "EMR migrated before" lookup
```

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in the six VITE_FIREBASE_* values
npm run dev
```

## What's a stub vs. what's real

- **Real:** Firebase Auth wiring, the `beforeSignIn` domain+verified-email gate, the
  Firestore rules, and all Cloud Functions make live API calls once their secrets are
  set (see `SETUP_LOVABLE.md` Section 4) and `beforeSignIn` is wired as the Blocking
  Function (Section 3.3).
- **Still a mock:** `public/dashboard.html` reads from hardcoded sample data (`TICKETS`,
  `MANAGERS`, `NOTION_EMR_TABLE` arrays at the top of its `<script>`), same as every
  earlier version. Connecting it to the real Firestore collections is the next build
  step — see the last section of `SETUP_LOVABLE.md`.
