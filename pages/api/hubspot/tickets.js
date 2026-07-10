import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { fetchTickets, fetchCompanies, joinTicketsToCompanies } from "../../../lib/hubspotClient";
import { isAllowedEmail } from "../../../lib/authz";

// GET /api/hubspot/tickets
// Pulls tickets + companies from HubSpot and joins them on Medspa ID (Section 5 of the
// plan). In production this should be called by the scheduled Vercel Cron sync job
// (writing into Firestore), not directly by the browser on every page load — see
// lib/firebaseAdmin.js for why.
//
// middleware.ts already blocks unauthenticated requests from reaching here; this route
// additionally re-checks the roster since API routes carry client data and shouldn't
// rely solely on the UI having hidden a button. Same pattern in every other API route —
// copy it forward as new routes get added.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const user = await clerkClient.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase() || null;
  if (!(await isAllowedEmail(email))) {
    return res.status(403).json({ error: "Not authorized" });
  }
  try {
    const [tickets, companies] = await Promise.all([fetchTickets(), fetchCompanies()]);
    const joined = joinTicketsToCompanies(tickets, companies);
    res.status(200).json({ count: joined.length, tickets: joined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
