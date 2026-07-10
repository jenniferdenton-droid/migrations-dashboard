import { Client } from "@hubspot/api-client";

// One shared client, reused across API routes (Vercel serverless functions are
// per-invocation, but this avoids re-instantiating within a single warm invocation).
export const hubspot = new Client({ accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN });

// ---------------------------------------------------------------------------
// TODO: replace these with the real internal property names once confirmed.
// HubSpot's *internal* name often differs from the display label shown in the UI —
// find it under Settings -> Properties -> [property] -> "internal name" at the bottom
// of the property editor. This is Open Input #1 / #8 in SETUP.md.
// ---------------------------------------------------------------------------
export const COMPANY_PROPERTIES = {
  medspaId: "medspa_id",            // TODO confirm internal name
  medspaName: "name",                // TODO confirm — may just be the standard "name" property
  migrationsManager: "migrations_manager", // TODO confirm — also confirm this lives on Company vs Ticket (Open Input #8)
  targetLaunchDate: "target_launch_date",  // TODO confirm
  lifecycleStage: "lifecyclestage",  // standard HubSpot property, filter to "onboarding"
  avgL3mRevenue: "average_l3m_revenue", // TODO confirm — feeds GMV/travel rule + capacity weighting
};

export const TICKET_PROPERTIES = {
  pipeline: "hs_pipeline",
  ticketStatus: "hs_pipeline_stage",
  providerSegment: "provider_segment_pre_launch", // TODO confirm — Enterprise/Silver/Growth/etc sort
  onboardingManagerSync: "onboarding_manager_sync", // TODO confirm
  practiceSuccessManager: "practice_success_manager", // TODO confirm
  ticketOwner: "hubspot_owner_id",   // standard property; resolve to a name via owners.read scope
  priority: "hs_ticket_priority",
  currentEmr: "current_emr",         // TODO confirm — complexity formula input
  scopeOfMigration: "scope_of_migration", // TODO confirm
  yearsUsingEmr: "years_using_emr",  // TODO confirm
  notesRemarks: "notes_remarks",     // TODO confirm — synced with dashboard notes
  nextMeetingDate: "next_meeting_date", // TODO confirm — surfaced in "Assigned to Me"
  medspaId: "medspa_id",             // TODO confirm — join key back to Company
};

// Placeholder complexity formula — swap in the real one from the Complexity Score
// Calculator workbook once confirmed (client risk + EMR risk*weight + segment*weight).
// EMR_RISK_TABLE below is copied from the dashboard mock; "Booker" is still unscored
// (Open Input #6) — falls back to a default weight until you send a real value.
export const EMR_RISK_TABLE = {
  "Boulevard (BLVD)": 2,
  "Vagaro": 3,
  "Aesthetic Record": 3,
  "Dr. Chrono": 6,
  "Nextech": 7,
  "PatientNow": 5,
  "Booker": null, // TODO: unscored — Open Input #6
  "Vivana": 9,
};
const DEFAULT_EMR_WEIGHT = 4;

export function complexityScore({ emr, gmv, isNewEmr }) {
  const emrWeight = EMR_RISK_TABLE[emr] ?? DEFAULT_EMR_WEIGHT;
  const clientRisk = gmv >= 100000 ? 3 : gmv >= 50000 ? 2 : 1; // placeholder banding
  const segmentWeight = isNewEmr ? 1.5 : 1;
  return Math.round((clientRisk + emrWeight * 4.5 * 0.1 + segmentWeight * 1.5) * 10) / 10;
}

export async function fetchTickets({ limit = 100, after } = {}) {
  const properties = Object.values(TICKET_PROPERTIES);
  const res = await hubspot.crm.tickets.basicApi.getPage(limit, after, properties);
  return res.results.map((t) => ({
    id: t.id,
    raw: t.properties,
    // Mapped to the field names the dashboard UI expects:
    pipeline: t.properties[TICKET_PROPERTIES.pipeline],
    stage: t.properties[TICKET_PROPERTIES.ticketStatus],
    segment: t.properties[TICKET_PROPERTIES.providerSegment],
    ticketOwnerId: t.properties[TICKET_PROPERTIES.ticketOwner],
    currentEmr: t.properties[TICKET_PROPERTIES.currentEmr],
    launchDate: t.properties[TICKET_PROPERTIES.targetLaunchDate] || null,
    medspaId: t.properties[TICKET_PROPERTIES.medspaId],
    notes: t.properties[TICKET_PROPERTIES.notesRemarks],
    nextMeetingDate: t.properties[TICKET_PROPERTIES.nextMeetingDate],
  }));
}

export async function fetchCompanies({ limit = 100, after } = {}) {
  const properties = Object.values(COMPANY_PROPERTIES);
  const res = await hubspot.crm.companies.basicApi.getPage(limit, after, properties);
  return res.results.map((c) => ({
    id: c.id,
    raw: c.properties,
    medspaId: c.properties[COMPANY_PROPERTIES.medspaId],
    medspaName: c.properties[COMPANY_PROPERTIES.medspaName],
    migrationsManager: c.properties[COMPANY_PROPERTIES.migrationsManager],
    targetLaunchDate: c.properties[COMPANY_PROPERTIES.targetLaunchDate],
    lifecycleStage: c.properties[COMPANY_PROPERTIES.lifecycleStage],
    avgL3mRevenue: Number(c.properties[COMPANY_PROPERTIES.avgL3mRevenue] || 0),
  }));
}

// Joins a ticket to its company on Medspa ID (Section 5 of the plan: "must exist on
// both the Company and Ticket objects and is the join key").
export function joinTicketsToCompanies(tickets, companies) {
  const byMedspaId = new Map(companies.map((c) => [c.medspaId, c]));
  return tickets.map((t) => ({ ...t, company: byMedspaId.get(t.medspaId) || null }));
}
