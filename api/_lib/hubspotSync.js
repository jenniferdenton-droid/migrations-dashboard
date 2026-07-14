// Core HubSpot -> Firestore sync logic, shared by api/hubspot/sync.js (manual
// trigger, requires a signed-in session) and api/cron/nightly-refresh.js (scheduled,
// protected by CRON_SECRET instead).
import { db, FieldValue } from "./firebaseAdmin.js";
import {
  fetchAllCompanies,
  fetchAllTickets,
  fetchOwnerNameMap,
  fetchTicketStageLabelMap,
} from "./hubspotClient.js";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runHubspotSync() {
  const [companies, tickets, ownerNames, stageLabels] = await Promise.all([
    fetchAllCompanies(),
    fetchAllTickets(),
    fetchOwnerNameMap(),
    fetchTicketStageLabelMap().catch((err) => {
      console.warn("Could not fetch pipeline stage labels, falling back to raw stage IDs", err.message);
      return new Map();
    }),
  ]);

  // Read whatever's already in Firestore for these tickets BEFORE overwriting them,
  // so a change in target_launch_date can be detected and logged (powers the
  // dashboard's launch-date-change table). This is the only place that history is
  // captured -- HubSpot itself doesn't give us a change log via this API.
  const ticketRefs = tickets.map((t) => db.collection("tickets").doc(t.id));
  const existingByIdRef = new Map();
  for (const refsChunk of chunk(ticketRefs, 300)) {
    const docs = await db.getAll(...refsChunk);
    for (const doc of docs) {
      if (doc.exists) existingByIdRef.set(doc.id, doc.data());
    }
  }

  const batches = [];
  let batch = db.batch();
  let ops = 0;
  const stage = (ref, data) => {
    batch.set(ref, data, { merge: true });
    ops += 1;
    if (ops >= 450) {
      batches.push(batch);
      batch = db.batch();
      ops = 0;
    }
  };

  for (const c of companies) {
    stage(db.collection("companies").doc(c.id), { ...c, syncedAt: FieldValue.serverTimestamp() });
  }

  for (const t of tickets) {
    const prev = existingByIdRef.get(t.id);
    const launchDateChanged =
      prev && prev.target_launch_date && prev.target_launch_date !== t.target_launch_date;
    const stageLabel =
      stageLabels.get(`${t.pipeline}:${t.stage}`) || stageLabels.get(t.stage) || null;

    stage(db.collection("tickets").doc(t.id), {
      ...t,
      stage_label: stageLabel,
      ticket_owner_name: ownerNames.get(String(t.ticket_owner_id)) || null,
      ...(launchDateChanged
        ? {
            prev_launch_date: prev.target_launch_date,
            launch_date_changed_at: FieldValue.serverTimestamp(),
          }
        : {}),
      syncedAt: FieldValue.serverTimestamp(),
    });
  }

  if (ops > 0) batches.push(batch);
  await Promise.all(batches.map((b) => b.commit()));

  await db.collection("settings").doc("lastHubspotSync").set({
    completedAt: FieldValue.serverTimestamp(),
    companiesCount: companies.length,
    ticketsCount: tickets.length,
  });

  return { companies: companies.length, tickets: tickets.length };
}
