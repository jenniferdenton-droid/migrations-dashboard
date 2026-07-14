// Node/Cloud Functions port of the Notion EMR-migrated-before lookup.
// Reads the EMR database (NOTION_EMR_DATABASE_ID) and returns a Set of EMR system
// names Moxie has migrated before, used by the dashboard's "EMR migrated before? Y/N"
// capacity-hours logic.
const { Client } = require("@notionhq/client");

async function fetchMigratedEmrSet() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const databaseId = process.env.NOTION_EMR_DATABASE_ID;
  const names = new Set();
  let cursor;
  do {
    const resp = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of resp.results) {
      const title =
        page.properties?.Name?.title?.[0]?.plain_text ||
        page.properties?.["EMR System"]?.title?.[0]?.plain_text;
      if (title) names.add(title.trim().toLowerCase());
    }
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return names;
}

module.exports = { fetchMigratedEmrSet };
