// POST/GET /api/hubspot/sync -- manual trigger for the HubSpot -> Firestore sync.
// Protected by middleware.ts (requires the moxie_session cookie, like every other
// /api/* route except /api/auth/* and /api/cron/*).
import { runHubspotSync } from "../_lib/hubspotSync.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Use GET or POST" });
  }
  try {
    const result = await runHubspotSync();
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("HubSpot sync failed", err);
    res.status(500).json({ error: err.message || "HubSpot sync failed" });
  }
}
