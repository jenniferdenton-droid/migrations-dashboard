import { fetchTickets, fetchCompanies, joinTicketsToCompanies } from "../../../lib/hubspotClient";
import { fetchEmrTable } from "../../../lib/notionClient";
import { getDb } from "../../../lib/firebaseAdmin";

// GET/POST /api/cron/refresh
// Nightly refresh job — wire this up to Vercel Cron so the dashboard's underlying data
// is pre-fetched instead of hitting HubSpot/Notion live on every page load.
//
// vercel.json (create at the project root):
//   {
//     "crons": [
//       { "path": "/api/cron/refresh", "schedule": "0 5 * * *" }
//     ]
//   }
// "0 5 * * *" = 5:00 AM UTC = 12:00 AM ET (adjust for daylight saving if you want it
// pinned exactly at midnight ET year-round; cron schedules in Vercel run in UTC).
//
// Vercel Cron calls this with a GET request and (in production) an
// Authorization: Bearer $CRON_SECRET header — verify that here once you set a
// CRON_SECRET env var, so this route can't be triggered by anyone who finds the URL.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const [tickets, companies, emrTable] = await Promise.all([
      fetchTickets(),
      fetchCompanies(),
      fetchEmrTable().catch((err) => {
        console.error("Notion fetch failed, continuing without EMR table:", err.message);
        return [];
      }),
    ]);
    const joined = joinTicketsToCompanies(tickets, companies);

    const db = getDb();
    const batch = db.batch();
    const ticketsCol = db.collection("tickets");
    joined.forEach((t) => batch.set(ticketsCol.doc(t.id), t));
    batch.set(db.collection("settings").doc("emrTable"), {
      rows: emrTable,
      updatedAt: new Date().toISOString(),
    });
    await batch.commit();

    res.status(200).json({
      ok: true,
      ticketCount: joined.length,
      emrRowCount: emrTable.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
