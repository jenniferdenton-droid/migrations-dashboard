# Migrations Dashboard

Next.js skeleton for the Moxie Migrations Dashboard (Migration Launch Calendar +
Manager Capacity + Pipeline). Deploys to Vercel, gated by Clerk (Google sign-in +
required authenticator MFA), pulls from HubSpot + Google Calendar, syncs into Firestore,
and posts Slack alerts on note tagging.

**Start here:** `SETUP.md` — full step-by-step for GitHub, Vercel, Clerk auth, HubSpot,
Google Calendar, Slack, and Firebase, plus the exact list of open inputs still needed
before this can go live with real data.

## Structure

```
middleware.ts                    Clerk route protection (auth) for every page + API route
pages/_app.js                    Wraps the app in ClerkProvider
pages/sign-in/[[...index]].js    Clerk sign-in page (no public sign-up)
pages/unauthorized.js            Shown to authenticated users not on the roster
pages/api/hubspot/tickets.js     GET tickets from HubSpot, mapped to dashboard fields
pages/api/hubspot/companies.js   GET companies from HubSpot, joined on Medspa ID
pages/api/calendar/freebusy.js   POST manager emails -> Google Calendar free/busy
pages/api/slack/notify.js        POST a tag event -> Slack DM to the tagged person
lib/authz.js                     Roster-based authorization check (used by every protected route)
lib/hubspotClient.js             HubSpot API client + field-name mapping table
lib/googleCalendarClient.js      Google Calendar API client (domain-wide delegation)
lib/slackClient.js               Slack Web API client
lib/firebaseAdmin.js             Firestore Admin SDK init
```

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

## What's a stub vs. what's real

These API routes make real calls to the real HubSpot/Calendar/Slack APIs — they are not
mocked. What's still a placeholder:

- HubSpot property internal names in `lib/hubspotClient.js` (marked `TODO`) — swap in
  the actual internal names once confirmed (Open Input #1 in SETUP.md)
- The complexity formula in `lib/hubspotClient.js` uses placeholder weights — replace
  with the real formula from your Complexity Score Calculator
- No UI yet beyond a placeholder homepage — the dashboard UI itself (calendar, capacity
  timeline, pipeline board) is the artifact already reviewed; porting that into React
  components here is the next build step once the data layer is confirmed working
