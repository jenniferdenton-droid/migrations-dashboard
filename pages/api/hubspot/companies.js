import { fetchCompanies } from "../../../lib/hubspotClient";

// GET /api/hubspot/companies
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const companies = await fetchCompanies();
    res.status(200).json({ count: companies.length, companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
