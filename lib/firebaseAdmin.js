import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Why Firestore instead of live-only HubSpot/Calendar calls (per Section 1 of the
// project plan): API rate limits on both HubSpot and Google Calendar make on-demand
// pulls risky at refresh scale. A scheduled sync (Vercel Cron, every 15-30 min) writes
// into Firestore; the dashboard reads from Firestore for speed, plus a manual
// "Refresh now" button for on-demand pulls when someone needs the latest immediately.

function getServiceAccount() {
  return JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8")
  );
}

export function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(getServiceAccount()),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

// Collections used by the dashboard:
//   tickets/{ticketId}        - synced HubSpot tickets, joined to company data
//   companies/{companyId}     - synced HubSpot companies
//   managerRoster/{email}     - Section 6a people roster (name, email, calendar status)
//   ticketNotes/{ticketId}/notes/{noteId} - dashboard notes, mirrored back to HubSpot
//   settings/capacityRules    - Section 3 configurable capacity scoring inputs
