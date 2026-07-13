// Deno port of the old lib/notionClient.js. Reads the "Known EMR Systems & Nuances For
// Migration" Notion database -- System / Confidence Level / Has Scraper columns -- used
// for the EMR-migrated and scraper-needed flags. See SETUP_LOVABLE.md Section 4 for how
// to get NOTION_API_KEY and NOTION_EMR_DATABASE_ID.

const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY") ?? "";
const NOTION_EMR_DATABASE_ID = Deno.env.get("NOTION_EMR_DATABASE_ID") ?? "";
const NOTION_VERSION = "2022-06-28";

function plainText(richTextArr: any[]): string | null {
  if (!Array.isArray(richTextArr) || richTextArr.length === 0) return null;
  return richTextArr.map((rt) => rt.plain_text).join("");
}

export async function fetchEmrTable() {
  if (!NOTION_API_KEY || !NOTION_EMR_DATABASE_ID) {
    throw new Error("NOTION_API_KEY and NOTION_EMR_DATABASE_ID must be set as Edge Function secrets");
  }
  const rows: { system: string; confidence: string | null; hasScraper: boolean }[] = [];
  let cursor: string | undefined;
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
      const system = systemProp?.title
        ? plainText(systemProp.title)
        : systemProp?.rich_text
        ? plainText(systemProp.rich_text)
        : null;
      const confidence = confidenceProp?.select
        ? confidenceProp.select.name
        : confidenceProp?.rich_text
        ? plainText(confidenceProp.rich_text)
        : null;
      const hasScraper =
        scraperProp?.checkbox !== undefined
          ? scraperProp.checkbox
          : scraperProp?.select
          ? scraperProp.select.name?.toLowerCase() === "yes"
          : false;
      if (system) rows.push({ system, confidence, hasScraper });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return rows;
}
