// Reads the "Known EMR Systems & Nuances For Migration" Notion database, which drives
// two pieces of dashboard logic:
//   1. Travel required / EMR-migrated flag — match HubSpot's Current EMR to this table's
//      "System" column, then check "Confidence Level":
//        - Found + Confidence Level != "Not Yet Migrated"  -> already migrated, no travel flag
//        - Found + Confidence Level == "Not Yet Migrated"  -> not yet migrated, travel flag
//        - NOT found in this table at all                  -> ALSO treated as not yet migrated
//   2. Scraper-needed flag — this table's "Has Scraper" column.
//
// Setup (see SETUP.md Section 8 for the full walkthrough):
//   1. notion.so/my-integrations -> New integration -> internal, name it "Migrations Dashboard"
//      -> copy the "Internal Integration Token" -> NOTION_API_KEY
//   2. Open the Notion page/database in the browser -> "..." menu -> Connections -> add the
//      integration you just created (without this step the API returns 404, not 403)
//   3. Copy the database ID out of the database's URL:
//      notion.so/workspace/<DATABASE_ID>?v=<view_id> -- the 32-char id before the "?"
//      -> NOTION_EMR_DATABASE_ID
//
// No SDK dependency yet (kept the skeleton's package list minimal) — this uses fetch()
// directly against the Notion REST API. Swap in @notionhq/client if you'd rather have
// typed helpers.

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_EMR_DATABASE_ID = process.env.NOTION_EMR_DATABASE_ID;
const NOTION_VERSION = "2022-06-28";

function plainText(richTextArr) {
  if (!Array.isArray(richTextArr) || richTextArr.length === 0) return null;
  return richTextArr.map((rt) => rt.plain_text).join("");
}

// Reads every row of the EMR tracker database. Notion property types can vary depending
// on how the columns were built (title vs. rich_text vs. select) — this handles the
// common shapes; adjust the property-name strings below if yours differ.
export async function fetchEmrTable() {
  if (!NOTION_API_KEY || !NOTION_EMR_DATABASE_ID) {
    throw new Error("NOTION_API_KEY and NOTION_EMR_DATABASE_ID must be set — see SETUP.md Section 8");
  }
  const rows = [];
  let cursor = undefined;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_EMR_DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor } : {}),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion API error ${res.status}: ${body}`);
    }
    const data = await res.json();
    for (const page of data.results) {
      const props = page.properties;
      const systemProp = props["System"];
      const confidenceProp = props["Confidence Level"];
      const scraperProp = props["Has Scraper"];
      const system =
        systemProp?.title ? plainText(systemProp.title) :
        systemProp?.rich_text ? plainText(systemProp.rich_text) : null;
      const confidence =
        confidenceProp?.select ? confidenceProp.select.name :
        confidenceProp?.rich_text ? plainText(confidenceProp.rich_text) : null;
      const hasScraper =
        scraperProp?.checkbox !== undefined ? scraperProp.checkbox :
        scraperProp?.select ? scraperProp.select.name?.toLowerCase() === "yes" : false;
      if (system) rows.push({ system, confidence, hasScraper });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// Applies the two-part "already migrated" rule described above.
export function isEmrMigrated(emrName, emrTable) {
  const row = emrTable.find((r) => r.system?.toLowerCase() === emrName?.toLowerCase());
  if (!row) return false; // not on the list at all -> treated as not yet migrated
  return row.confidence !== "Not Yet Migrated";
}

export function emrNeedsScraper(emrName, emrTable) {
  const row = emrTable.find((r) => r.system?.toLowerCase() === emrName?.toLowerCase());
  return row ? !!row.hasScraper : false;
}
