// GET /api/calendar/events?timeMin=...&timeMax=...&calendarId=primary -- lists actual
// events (not just busy blocks) so the dashboard's Launch Calendar / Travel tab can
// show real meetings alongside launch dates. Defaults to the next 30 days on the
// authorized account's primary calendar if no query params are given.
import { getCalendarClient } from "../_lib/googleAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const {
      timeMin = now.toISOString(),
      timeMax = in30.toISOString(),
      calendarId = "primary",
    } = req.query || {};

    const calendar = getCalendarClient();
    const result = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const events = (result.data.items || []).map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      allDay: !e.start?.dateTime,
      location: e.location || null,
      attendees: (e.attendees || []).map((a) => a.email),
    }));

    res.status(200).json({ events });
  } catch (err) {
    console.error("calendar events list failed", err);
    res.status(500).json({ error: err.message || "Calendar lookup failed" });
  }
}
