// Firebase Cloud Functions -- Migrations Dashboard backend.
//
// This file has ONE job that matters most: `beforeSignIn` is the real access-control
// gate for the whole app. Everything client-side (App.jsx, SignIn.jsx) is UX only --
// this function is what actually rejects a sign-in. It requires:
//   1. Google reports the email as verified (event.data.emailVerified === true)
//   2. The email domain is exactly joinmoxie.com
// Both conditions must hold or the sign-in is blocked with an HttpsError, which
// Firebase surfaces to the client as an auth/internal-error style rejection that
// signInWithPopup() throws synchronously (handled in src/pages/SignIn.jsx).
//
// NOTE: Blocking Functions require the Google Cloud Identity Platform upgrade
// (still on the no-cost tier, but a distinct product from "plain" Firebase Auth).
// See SETUP_LOVABLE.md Section 3 for the exact console steps and CLI deploy command.

const { beforeUserSignedIn } = require("firebase-functions/v2/identity");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const { WebClient } = require("@slack/web-api");

admin.initializeApp();
const db = admin.firestore();

const ALLOWED_DOMAIN = "joinmoxie.com";

function isAllowedSignIn(email, emailVerified) {
  if (!email) return false;
  if (emailVerified !== true) return false;
  const domain = email.toLowerCase().split("@")[1];
  return domain === ALLOWED_DOMAIN;
}

// --- 1. The access gate -----------------------------------------------------
exports.beforeSignIn = beforeUserSignedIn((event) => {
  const email = event.data?.email || null;
  const emailVerified = event.data?.emailVerified === true;

  if (!isAllowedSignIn(email, emailVerified)) {
    logger.warn("Blocked sign-in", { email, emailVerified });
    throw new HttpsError(
      "permission-denied",
      "Access is limited to verified @joinmoxie.com Google accounts."
    );
  }

  logger.info("Allowed sign-in", { email });
  // No return value needed -- returning nothing lets sign-in proceed unmodified.
});

// --- 2. Nightly HubSpot + Notion -> Firestore sync --------------------------
// Cloud Scheduler-backed (configured automatically by onSchedule at deploy time).
// Replaces the old Supabase pg_cron + Edge Function pairing.
exports.nightlyRefresh = onSchedule(
  {
    schedule: "0 3 * * *", // 3:00 AM daily, project default timezone (set in SETUP_LOVABLE.md)
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: ["HUBSPOT_PRIVATE_APP_TOKEN", "NOTION_API_KEY", "NOTION_EMR_DATABASE_ID"],
  },
  async () => {
    const { fetchAllCompanies, fetchAllTickets, fetchOwnerNameMap } = require("./_shared/hubspotClient");
    const { fetchMigratedEmrSet } = require("./_shared/notionClient");

    logger.info("nightlyRefresh: starting HubSpot + Notion sync");

    const [companies, tickets, ownerNames, migratedEmrSet] = await Promise.all([
      fetchAllCompanies(),
      fetchAllTickets(),
      fetchOwnerNameMap(),
      fetchMigratedEmrSet().catch((err) => {
        logger.error("Notion EMR lookup failed, continuing without it", err);
        return new Set();
      }),
    ]);

    const batchArray = [];
    let batch = db.batch();
    let opsInBatch = 0;

    function stage(ref, data) {
      batch.set(ref, data, { merge: true });
      opsInBatch += 1;
      if (opsInBatch >= 450) {
        batchArray.push(batch);
        batch = db.batch();
        opsInBatch = 0;
      }
    }

    for (const c of companies) {
      stage(db.collection("companies").doc(c.id), { ...c, syncedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    for (const t of tickets) {
      const emrKey = (t.source_emr_system || "").trim().toLowerCase();
      stage(db.collection("tickets").doc(t.id), {
        ...t,
        ticket_owner_name: ownerNames.get(String(t.ticket_owner_id)) || null,
        emr_migrated_before: migratedEmrSet.has(emrKey),
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (opsInBatch > 0) batchArray.push(batch);
    await Promise.all(batchArray.map((b) => b.commit()));

    await db.collection("settings").doc("lastSync").set({
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      companiesCount: companies.length,
      ticketsCount: tickets.length,
    });

    logger.info(`nightlyRefresh: synced ${companies.length} companies, ${tickets.length} tickets`);
  }
);

// --- 3. Calendar free/busy lookup (for scheduling travel around launches) ---
// Called from the dashboard client via a signed-in fetch (Firebase ID token in
// the Authorization header) -- checked manually here since onRequest doesn't
// auto-verify tokens the way onCall does.
exports.calendarFreebusy = onRequest(
  { secrets: ["GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"], cors: true },
  async (req, res) => {
    try {
      const authHeader = req.get("Authorization") || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        res.status(401).json({ error: "Missing Authorization bearer token" });
        return;
      }
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (!isAllowedSignIn(decoded.email, decoded.email_verified)) {
        res.status(403).json({ error: "Not an authorized @joinmoxie.com account" });
        return;
      }

      const { timeMin, timeMax, calendarIds } = req.body || {};
      if (!timeMin || !timeMax || !Array.isArray(calendarIds)) {
        res.status(400).json({ error: "timeMin, timeMax, and calendarIds[] are required" });
        return;
      }

      const saJson = JSON.parse(
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8")
      );
      const auth = new google.auth.GoogleAuth({
        credentials: saJson,
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      });
      const calendar = google.calendar({ version: "v3", auth });

      const result = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items: calendarIds.map((id) => ({ id })),
        },
      });

      res.status(200).json(result.data);
    } catch (err) {
      logger.error("calendarFreebusy failed", err);
      res.status(500).json({ error: "Internal error checking calendar availability" });
    }
  }
);

// --- 4. Slack notifications (launch date changes, unassigned enterprise, etc.) --
exports.slackNotify = onRequest(
  { secrets: ["SLACK_BOT_TOKEN"], cors: true },
  async (req, res) => {
    try {
      const authHeader = req.get("Authorization") || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        res.status(401).json({ error: "Missing Authorization bearer token" });
        return;
      }
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (!isAllowedSignIn(decoded.email, decoded.email_verified)) {
        res.status(403).json({ error: "Not an authorized @joinmoxie.com account" });
        return;
      }

      const { channel, text } = req.body || {};
      if (!channel || !text) {
        res.status(400).json({ error: "channel and text are required" });
        return;
      }

      const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
      const result = await slack.chat.postMessage({ channel, text });
      res.status(200).json({ ok: true, ts: result.ts });
    } catch (err) {
      logger.error("slackNotify failed", err);
      res.status(500).json({ error: "Internal error sending Slack message" });
    }
  }
);
