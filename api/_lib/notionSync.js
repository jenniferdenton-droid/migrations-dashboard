// Core Notion EMR-table -> Firestore sync logic, shared by api/notion/sync.js
// (manual trigger) and api/cron/nightly-refresh.js (scheduled).
import { db, FieldValue } from "./firebaseAdmin.js";
import { fetchEmrTable, migratedSetFromTable } from "./notionClient.js";

export async function runNotionSync() {
  const emrTable = await fetchEmrTable();
  const migratedEmrSet = migratedSetFromTable(emrTable);

  await db.collection("settings").doc("emrTable").set({
    table: emrTable,
    syncedAt: FieldValue.serverTimestamp(),
  });

  const ticketsSnap = await db.collection("tickets").get();
  const batches = [];
  let batch = db.batch();
  let ops = 0;
  ticketsSnap.forEach((doc) => {
    const emrKey = (doc.data().source_emr_system || "").trim().toLowerCase();
    batch.update(doc.ref, { emr_migrated_before: migratedEmrSet.has(emrKey) });
    ops += 1;
    if (ops >= 450) {
      batches.push(batch);
      batch = db.batch();
      ops = 0;
    }
  });
  if (ops > 0) batches.push(batch);
  await Promise.all(batches.map((b) => b.commit()));

  await db.collection("settings").doc("lastNotionSync").set({
    completedAt: FieldValue.serverTimestamp(),
    emrSystemsKnown: emrTable.length,
  });

  return { emrSystemsKnown: emrTable.length, ticketsStamped: ticketsSnap.size };
}
