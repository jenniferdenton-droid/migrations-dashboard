// HubSpot client for Vercel serverless functions. Same confirmed internal property
// names used across every earlier version of this project. Note the Vercel env var
// is named HUBSPOT_TOKEN (not HUBSPOT_PRIVATE_APP_TOKEN as in the earlier Firebase
// Cloud Functions draft) -- private app token either way, scopes needed:
// crm.objects.companies.read, crm.objects.tickets.read, crm.schemas.tickets.read,
// crm.objects.owners.read.
//
// Open question carried over from the original field-mapping pass: HubSpot's Ticket
// object has both closed_date and rework_date -- unclear whether closed_date should
// replace migration_complete_date or is a distinct field. Both are synced separately
// below until confirmed.
import { Client } from "@hubspot/api-client";

const COMPANY_PROPERTIES = [
  "medspa_id",
  "medspa_name",
  "onboarding_manager",
  "migrations_manager",
  "product_manager",
  "provider_success_manager",
  "provider_segment_pre_launch",
  "average_l3m_revenue",
  "full_address",
];

const TICKET_PROPERTIES = [
  "target_launch_date",
  "hs_ticket_priority",
  "source_emr_system",
  "scope_of_migration",
  "hubspot_owner_id",
  "hs_pipeline",
  "hs_pipeline_stage",
  "createdate",
  "closed_date",
  "rework_date",
  "years_using_emr_info_from_provider",
  "delayed_reason_details",
  "lifecycle_stage_company_sync",
  "notes_remarks",
  "medspa_id",
  "migration_notes",
  "migration_complexity_score",
  "migration_scoping_date",
  "service_menu_mapping_date",
  "migration_complete_date",
];

function getClient() {
  if (!process.env.HUBSPOT_TOKEN) throw new Error("HUBSPOT_TOKEN is not set");
  return new Client({ accessToken: process.env.HUBSPOT_TOKEN });
}

export async function fetchAllCompanies() {
  const hubspot = getClient();
  const results = [];
  let after;
  do {
    const page = await hubspot.crm.companies.basicApi.getPage(100, after, COMPANY_PROPERTIES);
    results.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  return results.map((c) => ({
    id: c.id,
    medspa_id: c.properties.medspa_id,
    medspa_name: c.properties.medspa_name,
    onboarding_manager: c.properties.onboarding_manager,
    migrations_manager: c.properties.migrations_manager,
    product_manager: c.properties.product_manager,
    provider_success_manager: c.properties.provider_success_manager,
    provider_segment: c.properties.provider_segment_pre_launch,
    avg_l3m_revenue: Number(c.properties.average_l3m_revenue || 0),
    full_address: c.properties.full_address || null,
    raw: c.properties,
  }));
}

export async function fetchAllTickets() {
  const hubspot = getClient();
  const results = [];
  let after;
  do {
    const page = await hubspot.crm.tickets.basicApi.getPage(100, after, TICKET_PROPERTIES);
    results.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  return results.map((t) => ({
    id: t.id,
    medspa_id: t.properties.medspa_id,
    pipeline: t.properties.hs_pipeline,
    stage: t.properties.hs_pipeline_stage,
    lifecycle_stage: t.properties.lifecycle_stage_company_sync,
    priority: t.properties.hs_ticket_priority,
    source_emr_system: t.properties.source_emr_system,
    scope_of_migration: t.properties.scope_of_migration,
    years_using_emr: t.properties.years_using_emr_info_from_provider,
    ticket_owner_id: t.properties.hubspot_owner_id,
    target_launch_date: t.properties.target_launch_date || null,
    create_date: t.properties.createdate || null,
    migration_scoping_date: t.properties.migration_scoping_date || null,
    service_menu_mapping_date: t.properties.service_menu_mapping_date || null,
    migration_complete_date: t.properties.migration_complete_date || null,
    closed_date: t.properties.closed_date || null,
    rework_date: t.properties.rework_date || null,
    delayed_reason_details: t.properties.delayed_reason_details,
    notes_remarks: t.properties.notes_remarks,
    migration_notes: t.properties.migration_notes,
    migration_complexity_score: t.properties.migration_complexity_score
      ? Number(t.properties.migration_complexity_score)
      : null,
    raw: t.properties,
  }));
}

export async function fetchOwnerNameMap() {
  const hubspot = getClient();
  const page = await hubspot.crm.owners.ownersApi.getPage();
  const map = new Map();
  for (const o of page.results || []) {
    const name = [o.firstName, o.lastName].filter(Boolean).join(" ");
    map.set(String(o.id), name || o.email);
  }
  return map;
}

// hs_pipeline_stage on a ticket is an internal stage ID (a short numeric string), not
// the human label shown in HubSpot's UI -- this fetches every pipeline's stage list
// once and builds an id -> label map so the dashboard can show real stage names
// instead of raw IDs. Keyed by pipeline id + stage id combined, since stage IDs are
// only unique within a pipeline.
export async function fetchTicketStageLabelMap() {
  const hubspot = getClient();
  const pipelines = await hubspot.crm.pipelines.pipelinesApi.getAll("tickets");
  const map = new Map();
  for (const pipeline of pipelines.results || []) {
    for (const stage of pipeline.stages || []) {
      map.set(`${pipeline.id}:${stage.id}`, stage.label);
      // Also key by stage id alone as a fallback, in case a ticket's pipeline id
      // doesn't line up cleanly (e.g. archived/renamed pipelines).
      if (!map.has(stage.id)) map.set(stage.id, stage.label);
    }
  }
  return map;
}
