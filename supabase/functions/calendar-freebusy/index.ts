// POST /functions/v1/calendar-freebusy
// Body: { emails: string[], timeMin: ISOString, timeMax: ISOString }
// Replaces the old pages/api/calendar/freebusy.js. Uses a Google service account with
// domain-wide delegation to check manager availability -- same setup as before, just
// invoked from an Edge Function instead of a Next.js API route.
//
// GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 must be set as an Edge Function secret (base64 of
// the full service account JSON key). See SETUP_LOVABLE.md Section 4.

import { corsHeaders } from "../_shared/cors.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

async function getAccessToken(impersonateEmail: string) {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64") ?? "";
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not set");
  const creds = JSON.parse(atob(raw));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(creds.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: creds.client_email,
      sub: impersonateEmail, // domain-wide delegation: act as this manager
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(60 * 5),
      iat: getNumericDate(0),
    },
    key
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { emails, timeMin, timeMax } = await req.json();
    if (!Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: "emails[] is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown> = {};
    for (const email of emails) {
      const token = await getAccessToken(email);
      const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: timeMin || new Date().toISOString(),
          timeMax: timeMax || new Date(Date.now() + 7 * 86400000).toISOString(),
          items: [{ id: email }],
        }),
      });
      const data = await res.json();
      results[email] = data.calendars?.[email] ?? data;
    }

    return new Response(JSON.stringify({ busy: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
