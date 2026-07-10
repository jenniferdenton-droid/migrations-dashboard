import { notifyTaggedUser } from "../../../lib/slackClient";

// POST /api/slack/notify
// Body: { email, ticketClient, ticketId, note, taggedBy }
// Called when a dashboard note contains an @mention (Section 6 of the plan — "tagging
// triggers both an email and a Slack DM/mention to that person"). The email half of
// that pair is a separate call (e.g. via SendGrid, already on the vendor list) — not
// wired up in this skeleton yet.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { email, ticketClient, ticketId, note, taggedBy } = req.body || {};
  if (!email || !ticketId || !note) {
    return res.status(400).json({ error: "email, ticketId, and note are required" });
  }
  try {
    const result = await notifyTaggedUser({ email, ticketClient, ticketId, note, taggedBy });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
