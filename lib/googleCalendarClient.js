import { google } from "googleapis";

// Uses domain-wide delegation (SETUP.md Section 5, Option A): the service account
// impersonates each manager via `subject` so it can read their calendar without them
// individually sharing it. If you go with Option B (individual sharing) instead, drop
// the `subject` line below — the service account will use whatever access it was
// directly granted on each manager's calendar.
function getAuthClient(impersonateEmail) {
  const json = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8")
  );
  return new google.auth.JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    subject: impersonateEmail, // domain-wide delegation — remove for Option B
  });
}

// Returns busy blocks for a list of manager emails over a date range — this is what
// powers the "Availability Calendar" tab (see who's open before assigning a new
// migration to a manager).
export async function getFreeBusy({ emails, timeMin, timeMax }) {
  const results = {};
  for (const email of emails) {
    const auth = getAuthClient(email);
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: email }],
      },
    });
    results[email] = res.data.calendars?.[email]?.busy || [];
  }
  return results;
}
