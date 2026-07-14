// POST /api/gmail/notify -- sends an email notification via Gmail (launch date
// changes, travel reminders, etc.), authenticated as the same Google account used
// for Calendar (api/_lib/googleAuth.js), not the signed-in dashboard user.
//
// Body: { to: string | string[], subject: string, text?: string, html?: string }
// At least one of text/html is required.
import { getGmailClient, buildRawEmail } from "../_lib/googleAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const { to, subject, text, html } = req.body || {};
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ error: "to, subject, and text or html are required" });
    }
    const recipients = Array.isArray(to) ? to.join(", ") : to;

    const gmail = getGmailClient();
    const raw = buildRawEmail({ to: recipients, subject, text, html });
    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    res.status(200).json({ ok: true, id: result.data.id });
  } catch (err) {
    console.error("gmail notify failed", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
}
