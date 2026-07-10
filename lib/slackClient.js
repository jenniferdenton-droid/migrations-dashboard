import { WebClient } from "@slack/web-api";

export const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Looks up a Slack user by the email on file in the People Roster (Settings ->
// Section 6a), then sends them a DM. Used whenever someone is @ tagged in a dashboard
// note, per Section 6 of the plan ("tagging triggers both an email and a Slack
// DM/mention to that person").
export async function notifyTaggedUser({ email, ticketClient, ticketId, note, taggedBy }) {
  const lookup = await slack.users.lookupByEmail({ email });
  if (!lookup.ok || !lookup.user) {
    return { ok: false, reason: "no_slack_user_for_email" };
  }
  const res = await slack.chat.postMessage({
    channel: lookup.user.id, // DM the user directly
    text:
      `*${taggedBy}* tagged you on *${ticketClient}* (${ticketId}):\n` +
      `> ${note}\n` +
      `View in the dashboard: ${process.env.NEXT_PUBLIC_APP_URL || ""}/pipeline?ticket=${ticketId}`,
  });
  return { ok: res.ok };
}
