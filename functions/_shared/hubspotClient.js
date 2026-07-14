// Node/Cloud Functions port of the HubSpot client -- same confirmed internal property
// names used across every earlier version of this project. A few fields confirmed in an
// earlier pass (migration_notes, migration_complexity_score, migration_scoping_date,
// service_menu_mapping_date, migration_complete_date) weren't in Jennifer's latest
// field list, so they're kept here rather than dropped. Worth double-checking: the
// newest list has both closed_date and rework_date on the Ticket object -- confirm
// whether closed_date should replace migration_complete_date or is a distinct field.
const { Client } = require("@hubspot/api-client");

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
  return new Client({ accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN });
}

async function fetchAllCompanies() {
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

async function fetchAllTickets() {
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

async function fetchOwnerNameMap() {
  const hubspot = getClient();
  const page = await hubspot.crm.owners.ownersApi.getPage();
  const map = new Map();
  for (const o of page.results || []) {
    const name = [o.firstName, o.lastName].filter(Boolean).join(" ");
    map.set(String(o.id), name || o.email);
  }
  return map;
}

module.exports = { fetchAllCompanies, fetchAllTickets, fetchOwnerNameMap };
