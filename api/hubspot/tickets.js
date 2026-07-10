import { fetchTickets, fetchCompanies, joinTicketsToCompanies } from "../../../lib/hubspotClient";

// GET /api/hubspot/tickets
// Pulls tickets + companies from HubSpot and joins them on Medspa ID (Section 5 of the
// plan). In production this should be called by the scheduled Vercel Cron sync job
// (writing into Firestore), not directly by the browser on every page load — see
// lib/firebaseAdmin.js for why.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const [tickets, companies] = await Promise.all([fetchTickets(), fetchCompanies()]);
    const joined = joinTicketsToCompanies(tickets, companies);
    res.status(200).json({ count: joined.length, tickets: joined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
