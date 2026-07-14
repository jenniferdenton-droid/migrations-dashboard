// GET /api/cron/nightly-refresh -- Vercel Cron target (see vercel.json), runs the
// HubSpot sync then the Notion sync every night. This has no user session (Cron
// calls it server-to-server), so middleware.ts explicitly excludes /api/cron/* from
// the login redirect -- this handler protects itself instead by checking the
// Authorization header Vercel automatically attaches when CRON_SECRET is set:
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
//
// NOTE: CRON_SECRET is NOT yet set in Vercel as of this build -- add it (any random
// string) under Project Settings -> Environment Variables, or this endpoint stays
// open to anyone who finds the URL. Also requires NOTION_API_KEY /
// NOTION_EMR_DATABASE_ID (see api/notion/sync.js) -- the Notion step is skipped with
// a warning (not a hard failure) if those aren't set yet, so HubSpot data still syncs.
import { runHubspotSync } from "../_lib/hubspotSync.js";
import { runNotionSync } from "../_lib/notionSync.js";

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const result = { hubspot: null, notion: null, notionSkipped: false };
  try {
    result.hubspot = await runHubspotSync();
  } catch (err) {
    console.error("nightly-refresh: HubSpot sync failed", err);
    return res.status(500).json({ error: `HubSpot sync failed: ${err.message}`, ...result });
  }

  try {
    result.notion = await runNotionSync();
  } catch (err) {
    console.warn("nightly-refresh: Notion sync skipped/failed", err.message);
    result.notionSkipped = true;
    result.notionError = err.message;
  }

  res.status(200).json({ ok: true, ...result });
}
