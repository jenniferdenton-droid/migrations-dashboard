// Nightly refresh -- replaces the old pages/api/cron/refresh.js. Pulls tickets +
// companies from HubSpot and the EMR table from Notion, then upserts into Postgres so
// the dashboard reads from Supabase instead of hitting HubSpot/Notion live on every
// page load.
//
// Scheduling: Supabase Edge Functions don't have Vercel-style built-in cron config.
// Schedule this with pg_cron + pg_net (Database -> Cron in the Supabase dashboard),
// calling this function's URL on a schedule -- see SETUP_LOVABLE.md Section 6 for the
// exact SQL. "0 5 * * *" (5am UTC = 12am ET) is the equivalent of the old vercel.json
// cron entry.
//
// Auth: called with the service_role key (either by pg_cron's scheduled HTTP call, or
// manually via `supabase functions invoke nightly-refresh`), so it bypasses RLS and can
// write to every table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchAllTickets, fetchAllCompanies, fetchOwnerNameMap } from "../_shared/hubspotClient.ts";
import { fetchEmrTable } from "../_shared/notionClient.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const [companies, tickets, ownerNames, emrTable] = await Promise.all([
      fetchAllCompanies(),
      fetchAllTickets(),
      fetchOwnerNameMap().catch((err) => {
        console.error("owner lookup failed, continuing without names:", err.message);
        return new Map<string, string>();
      }),
      fetchEmrTable().catch((err) => {
        console.error("Notion fetch failed, continuing without EMR table:", err.message);
        return [];
      }),
    ]);

    const companyByMedspaId = new Map(companies.map((c) => [c.medspa_id, c]));

    const ticketRows = tickets.map((t) => {
      const company = companyByMedspaId.get(t.medspa_id);
      return {
        id: t.id,
        hs_ticket_id: t.hs_ticket_id,
        medspa_id: t.medspa_id,
        client_name: company?.medspa_name ?? null,
        pipeline: t.pipeline,
        stage: t.stage,
        lifecycle_stage: t.lifecycle_stage,
        priority: t.priority,
        source_emr_system: t.source_emr_system,
        scope_of_migration: t.scope_of_migration,
        years_using_emr: t.years_using_emr,
        ticket_owner_id: t.ticket_owner_id,
        ticket_owner_name: t.ticket_owner_id ? ownerNames.get(t.ticket_owner_id) ?? null : null,
        target_launch_date: t.target_launch_date,
        create_date: t.create_date,
        migration_scoping_date: t.migration_scoping_date,
        service_menu_mapping_date: t.service_menu_mapping_date,
        migration_complete_date: t.migration_complete_date,
        closed_date: t.closed_date,
        rework_date: t.rework_date,
        delayed_reason_details: t.delayed_reason_details,
        notes_remarks: t.notes_remarks,
        migration_notes: t.migration_notes,
        migration_complexity_score: t.migration_complexity_score,
        gmv: company?.avg_l3m_revenue ?? 0,
        raw: t.raw,
        synced_at: new Date().toISOString(),
      };
    });

    const companyRows = companies.map((c) => ({
      id: c.id,
      medspa_id: c.medspa_id,
      medspa_name: c.medspa_name,
      onboarding_manager: c.onboarding_manager,
      migrations_manager: c.migrations_manager,
      product_manager: c.product_manager,
      provider_success_manager: c.provider_success_manager,
      provider_segment: c.provider_segment,
      avg_l3m_revenue: c.avg_l3m_revenue,
      full_address: c.full_address,
      raw: c.raw,
      synced_at: new Date().toISOString(),
    }));

    const emrRows = emrTable.map((r) => ({
      system: r.system,
      confidence_level: r.confidence,
      has_scraper: r.hasScraper,
      synced_at: new Date().toISOString(),
    }));

    // Note: this overwrites target_launch_date-derived fields on every sync but does
    // NOT touch travel_start_date / travel_end_date / travel_note / on_hold, since
    // those are manually filled in on the dashboard and have no HubSpot source.
    if (companyRows.length) {
      const { error } = await supabase.from("companies").upsert(companyRows, { onConflict: "id" });
      if (error) throw error;
    }
    if (ticketRows.length) {
      const { error } = await supabase.from("tickets").upsert(ticketRows, { onConflict: "id" });
      if (error) throw error;
    }
    if (emrRows.length) {
      const { error } = await supabase.from("emr_table").upsert(emrRows, { onConflict: "system" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        companyCount: companyRows.length,
        ticketCount: ticketRows.length,
        emrRowCount: emrRows.length,
        syncedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
