// GET /api/dashboard/data -- the one endpoint the dashboard frontend calls on load
// (and after "Refresh data") to get real HubSpot + Notion data out of Firestore,
// shaped to match public/dashboard.html's expected TICKETS/MANAGERS/NOTION_EMR_TABLE
// schema exactly, so the frontend needs minimal glue code.
//
// This does NOT call HubSpot/Notion directly -- it only reads whatever the last
// /api/hubspot/sync + /api/notion/sync (or the nightly cron) already wrote to
// Firestore. If those haven't run yet, this returns empty arrays (not an error) so
// the dashboard can show a clear "no data synced yet" state instead of crashing.
//
// Fields the dashboard UI has that HubSpot has no equivalent for are returned as
// null/false and left as manual/workflow fields for now: onHold, mic (meeting-in-
// charge), psmAttendee, travelDates. Launch-date change tracking (prevLaunch /
// changeLoggedDate) IS real -- it's captured by api/_lib/hubspotSync.js comparing
// each sync against the previously stored value.
import { db } from "../_lib/firebaseAdmin.js";

const LIFECYCLE_LABELS = {
  onboarding: "Onboarding",
  "pre-launch": "Pre-Launch",
  prelaunch: "Pre-Launch",
  pre_launch: "Pre-Launch",
};

function titleCase(s) {
  return s.replace(/(^|[\s_-])(\w)/g, (_, sep, c) => (sep ? " " : "") + c.toUpperCase());
}

function mapLifecycle(raw) {
  if (!raw) return "Onboarding";
  const key = String(raw).trim().toLowerCase();
  return LIFECYCLE_LABELS[key] || titleCase(key);
}

// Normalizes every HubSpot date shape (date-only "YYYY-MM-DD", datetime epoch-ms
// string, Firestore Timestamp) down to a plain "YYYY-MM-DD" string, so the frontend
// can run its existing parseYmd() on every date field the same way.
function toYmd(val) {
  if (!val) return null;
  if (typeof val === "object" && typeof val.toDate === "function") {
    return val.toDate().toISOString().slice(0, 10);
  }
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const num = Number(val);
  const d = !Number.isNaN(num) && String(val).trim() !== "" ? new Date(num) : new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Firestore Timestamps don't serialize to anything useful in plain JSON.stringify --
// convert the one field ("completedAt") that matters for the sync-status label.
function syncDocToJson(doc) {
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    ...data,
    completedAt:
      data.completedAt && typeof data.completedAt.toDate === "function"
        ? data.completedAt.toDate().toISOString()
        : null,
  };
}

function guessEmail(name) {
  if (!name) return null;
  const slug = name.trim().toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).join(".");
  return slug ? `${slug}@joinmoxie.com` : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  try {
    const [companiesSnap, ticketsSnap, emrTableDoc, hubspotSyncDoc, notionSyncDoc] = await Promise.all([
      db.collection("companies").get(),
      db.collection("tickets").get(),
      db.collection("settings").doc("emrTable").get(),
      db.collection("settings").doc("lastHubspotSync").get(),
      db.collection("settings").doc("lastNotionSync").get(),
    ]);

    const companiesByMedspaId = new Map();
    companiesSnap.forEach((doc) => {
      const c = doc.data();
      if (c.medspa_id) companiesByMedspaId.set(String(c.medspa_id), c);
    });

    const managerNames = new Set();
    const tickets = [];
    ticketsSnap.forEach((doc) => {
      const t = doc.data();
      const company = companiesByMedspaId.get(String(t.medspa_id)) || null;
      if (company?.migrations_manager) managerNames.add(company.migrations_manager);

      tickets.push({
        id: t.id || doc.id,
        hsId: t.id || doc.id,
        client: company?.medspa_name || "Unknown Practice",
        medspaId: t.medspa_id || company?.medspa_id || "",
        fullAddress: company?.full_address || "",
        segment: company?.provider_segment || "No Segment",
        emr: t.source_emr_system || "Unknown",
        gmv: Number(company?.avg_l3m_revenue || 0),
        complexity: t.migration_complexity_score ?? 0,
        manager: company?.migrations_manager || null,
        ticketOwner: t.ticket_owner_name || null,
        psm: company?.provider_success_manager || null,
        stage: t.stage_label || t.stage || "Unknown Stage",
        lifecycleStage: mapLifecycle(t.lifecycle_stage),
        onHold: false,
        launch: toYmd(t.target_launch_date),
        prevLaunch: toYmd(t.prev_launch_date),
        changeLoggedDate: toYmd(t.launch_date_changed_at),
        createDate: toYmd(t.create_date),
        scopingDate: toYmd(t.migration_scoping_date),
        serviceMenuDate: toYmd(t.service_menu_mapping_date),
        completeDate: toYmd(t.migration_complete_date || t.closed_date),
        migrationNotes: t.migration_notes || "",
        notes: t.notes_remarks ? [t.notes_remarks] : [],
        mic: null,
        psmAttendee: null,
        travelDates: null,
        emrMigratedBefore: !!t.emr_migrated_before,
      });
    });

    const managers = Array.from(managerNames).sort().map((name) => ({
      name,
      email: guessEmail(name),
      calStatus: "none", // real Calendar-connection status isn't tracked yet
    }));

    const emrTable = emrTableDoc.exists ? emrTableDoc.data().table || [] : [];

    res.status(200).json({
      tickets,
      managers,
      emrTable,
      counts: { companies: companiesSnap.size, tickets: ticketsSnap.size },
      lastHubspotSync: syncDocToJson(hubspotSyncDoc),
      lastNotionSync: syncDocToJson(notionSyncDoc),
    });
  } catch (err) {
    console.error("dashboard data fetch failed", err);
    res.status(500).json({ error: err.message || "Failed to load dashboard data" });
  }
}
