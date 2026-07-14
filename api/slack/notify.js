// POST /api/slack/notify -- posts a message via the Slack Incoming Webhook already
// configured in Vercel (SLACK_WEBHOOK_URL). Simple webhook POST, no Slack SDK needed
// since a webhook always posts to its one pre-configured channel (no channel param).
//
// Body: { text: string }
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "text is required" });
    if (!process.env.SLACK_WEBHOOK_URL) {
      return res.status(500).json({ error: "SLACK_WEBHOOK_URL is not set" });
    }

    const resp = await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Slack webhook returned ${resp.status}: ${body}`);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("slack notify failed", err);
    res.status(500).json({ error: err.message || "Failed to post to Slack" });
  }
}
