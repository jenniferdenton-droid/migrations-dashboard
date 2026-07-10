import { getDb } from "./firebaseAdmin";

// Server-side "are you actually allowed in" check — a Clerk sign-in only proves someone
// authenticated with an approved Google account; it doesn't by itself mean they should
// see this specific internal tool. This checks their email against the same People
// Roster being built in Section 6a (Firestore collection `managerRoster`), so there's
// one source of truth for "who's allowed" instead of a second hardcoded list.
//
// Until the roster is populated, falls back to the ALLOWED_EMAILS env var so you can
// start testing sign-in immediately without waiting on Section 6a.

function getBootstrapAllowlist() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAllowedEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase();

  // Bootstrap path — always checked first since it's cheap and covers local dev.
  if (getBootstrapAllowlist().includes(normalized)) return true;

  // Roster path — once Section 6a's Firestore collection exists.
  try {
    const db = getDb();
    const doc = await db.collection("managerRoster").doc(normalized).get();
    return doc.exists;
  } catch (err) {
    // Firestore not configured yet (e.g. very first deploy) — don't hard-fail auth,
    // just fall back to bootstrap-only behavior.
    console.warn("authz: roster lookup failed, falling back to bootstrap list", err.message);
    return false;
  }
}
