// POST /functions/v1/slack-notify
// Body: { email, ticketClient, ticketId, note, taggedBy }
// Replaces the old pages/api/slack/notify.js. Called when a dashboard note contains an
// @mention -- looks up the Slack user by email, then DMs them.
//
// SLACK_BOT_TOKEN must be set as an Edge Function secret. Requires the chat:write and
// users:read.email bot scopes (same as before) -- see SETUP_LOVABLE.md Section 4.

import { corsHeaders } from "../_shared/cors.ts";

const SLACK_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, ticketClient, ticketId, note, taggedBy } = await req.json();
    if (!email || !ticketId || !note) {
      return new Response(JSON.stringify({ error: "email, ticketId, and note are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lookupRes = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } }
    );
    const lookup = await lookupRes.json();
    if (!lookup.ok) throw new Error(`Slack lookup failed: ${lookup.error}`);

    const text = `${taggedBy ?? "Someone"} tagged you on *${ticketClient ?? ticketId}* (${ticketId}):\n>${note}`;
    const msgRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: lookup.user.id, text }),
    });
    const msg = await msgRes.json();
    if (!msg.ok) throw new Error(`Slack post failed: ${msg.error}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
