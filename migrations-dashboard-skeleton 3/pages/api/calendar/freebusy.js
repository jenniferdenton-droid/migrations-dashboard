import { getFreeBusy } from "../../../lib/googleCalendarClient";

// POST /api/calendar/freebusy
// Body: { emails: string[], timeMin: ISOString, timeMax: ISOString }
// Powers the Availability Calendar tab — who's open before assigning a new migration.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { emails, timeMin, timeMax } = req.body || {};
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "emails[] is required" });
  }
  try {
    const busy = await getFreeBusy({
      emails,
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    res.status(200).json({ busy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
