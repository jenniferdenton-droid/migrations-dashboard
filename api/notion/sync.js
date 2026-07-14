// POST/GET /api/notion/sync -- manual trigger for the Notion EMR-list sync. Run
// /api/hubspot/sync at least once first so there are tickets to stamp against.
//
// Requires NOTION_API_KEY and NOTION_EMR_DATABASE_ID, which are NOT yet set in
// Vercel as of this build -- add them under Project Settings -> Environment
// Variables before calling this endpoint (see SETUP.md).
import { runNotionSync } from "../_lib/notionSync.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Use GET or POST" });
  }
  try {
    const result = await runNotionSync();
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("Notion sync failed", err);
    res.status(500).json({ error: err.message || "Notion sync failed" });
  }
}
