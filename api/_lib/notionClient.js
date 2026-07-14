// Notion client for Vercel serverless functions -- reads the "Known EMR Systems &
// Nuances For Migration" database (System / Confidence Level / Has Scraper columns,
// matching the dashboard's original mock table exactly) and returns the full table,
// used both to stamp emr_migrated_before onto tickets and to drive the dashboard's
// EMR confidence/scraper display.
//
// NOTE: NOTION_API_KEY and NOTION_EMR_DATABASE_ID are NOT currently set in Vercel
// (checked against the env var list on 2026-07-13) -- add both before calling
// /api/notion/sync or the nightly cron, or this will throw.
//
// Property names below are a best guess matching the dashboard mock's column
// headers ("Confidence Level", "Has Scraper") -- if your actual Notion database uses
// different property names, adjust CONFIDENCE_PROP / SCRAPER_PROP.
import { Client } from "@notionhq/client";

const CONFIDENCE_PROP = "Confidence Level";
const SCRAPER_PROP = "Has Scraper";
const NOT_MIGRATED_VALUE = "Not Yet Migrated";

function getTitle(page) {
  return (
    page.properties?.Name?.title?.[0]?.plain_text ||
    page.properties?.["EMR System"]?.title?.[0]?.plain_text ||
    null
  );
}

function getConfidence(page) {
  const prop = page.properties?.[CONFIDENCE_PROP];
  if (!prop) return NOT_MIGRATED_VALUE;
  return prop.select?.name || prop.status?.name || NOT_MIGRATED_VALUE;
}

function getScraper(page) {
  const prop = page.properties?.[SCRAPER_PROP];
  if (!prop) return false;
  if (typeof prop.checkbox === "boolean") return prop.checkbox;
  const selectName = (prop.select?.name || "").toLowerCase();
  return selectName === "yes" || selectName === "true";
}

// Full table: [{ system, confidence, scraper }], mirrors the dashboard's
// NOTION_EMR_TABLE shape directly so the frontend needs no extra mapping.
export async function fetchEmrTable() {
  if (!process.env.NOTION_API_KEY) throw new Error("NOTION_API_KEY is not set");
  if (!process.env.NOTION_EMR_DATABASE_ID) throw new Error("NOTION_EMR_DATABASE_ID is not set");

  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const databaseId = process.env.NOTION_EMR_DATABASE_ID;
  const table = [];
  let cursor;
  do {
    const resp = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of resp.results) {
      const system = getTitle(page);
      if (!system) continue;
      table.push({
        system: system.trim(),
        confidence: getConfidence(page),
        scraper: getScraper(page),
      });
    }
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return table;
}

// Convenience helper for callers that only need the migrated/not-migrated boolean
// (e.g. stamping tickets) rather than the full confidence/scraper detail.
export function migratedSetFromTable(table) {
  const set = new Set();
  for (const row of table) {
    if (row.confidence !== NOT_MIGRATED_VALUE) set.add(row.system.trim().toLowerCase());
  }
  return set;
}
