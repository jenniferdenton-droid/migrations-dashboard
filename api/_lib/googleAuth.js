// Shared Google OAuth2 client for server-to-server Calendar + Gmail calls.
//
// This is a DIFFERENT Google OAuth flow than the one in api/auth/login.js and
// api/auth/callback/google.js -- those authenticate whoever is signing into the
// dashboard (any @joinmoxie.com user, short-lived, no offline access). This client
// authenticates as ONE specific Google account (whichever account you ran the
// one-time consent flow with -- see SETUP.md "Google Calendar + Gmail" section) using
// a long-lived refresh token, so the dashboard's server-side jobs can read that
// account's calendar and send mail as that account without a user being present.
//
// Reuses AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (the same OAuth client already
// registered for sign-in) plus GOOGLE_REFRESH_TOKEN (obtained once via the OAuth
// consent screen with access_type=offline, prompt=consent, and the calendar/gmail
// scopes below -- see SETUP.md for the exact one-time script).
import { google } from "googleapis";

export function getGoogleOAuthClient() {
  const { AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!AUTH_GOOGLE_ID || !AUTH_GOOGLE_SECRET) {
    throw new Error("AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are not set");
  }
  if (!GOOGLE_REFRESH_TOKEN) {
    throw new Error("GOOGLE_REFRESH_TOKEN is not set -- see SETUP.md to generate one");
  }
  const client = new google.auth.OAuth2(AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET);
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return client;
}

export function getCalendarClient() {
  return google.calendar({ version: "v3", auth: getGoogleOAuthClient() });
}

export function getGmailClient() {
  return google.gmail({ version: "v1", auth: getGoogleOAuthClient() });
}

// Gmail's API wants a base64url-encoded RFC 2822 message, not plain JSON -- this
// builds one from a small set of fields so callers don't have to think about MIME.
export function buildRawEmail({ to, from, subject, text, html }) {
  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : null,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    html ? 'Content-Type: text/html; charset="UTF-8"' : 'Content-Type: text/plain; charset="UTF-8"',
  ]
    .filter(Boolean)
    .join("\r\n");
  const body = html || text || "";
  const message = `${headers}\r\n\r\n${body}`;
  return Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
