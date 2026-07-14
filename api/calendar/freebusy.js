// POST /api/calendar/freebusy -- checks Google Calendar availability for the
// authorized service account (see api/_lib/googleAuth.js) across one or more
// calendars, over a given time window. Used for scheduling travel around launches.
//
// Body: { timeMin: ISOString, timeMax: ISOString, calendarIds: string[] }
// calendarIds defaults to ["primary"] (the authorized account's own calendar) if
// omitted -- pass specific calendar IDs/emails for shared team calendars the
// authorized account has at least "See all event details" access to.
import { getCalendarClient } from "../_lib/googleAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const { timeMin, timeMax, calendarIds } = req.body || {};
    if (!timeMin || !timeMax) {
      return res.status(400).json({ error: "timeMin and timeMax (ISO strings) are required" });
    }
    const ids = Array.isArray(calendarIds) && calendarIds.length ? calendarIds : ["primary"];

    const calendar = getCalendarClient();
    const result = await calendar.freebusy.query({
      requestBody: { timeMin, timeMax, items: ids.map((id) => ({ id })) },
    });

    res.status(200).json(result.data);
  } catch (err) {
    console.error("calendarFreebusy failed", err);
    res.status(500).json({ error: err.message || "Calendar lookup failed" });
  }
}
