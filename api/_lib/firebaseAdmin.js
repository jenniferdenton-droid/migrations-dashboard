// Shared Firebase Admin SDK init for Vercel serverless functions.
// Files under api/_lib/ start with an underscore so Vercel does NOT deploy them as
// routes -- they're plain shared modules imported by the real route handlers.
//
// Uses the same three env vars already set in Vercel: FIREBASE_PROJECT_ID,
// FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (a standard Firebase service-account
// credential, split into three vars since a JSON blob doesn't paste cleanly into
// Vercel's env var UI). Vercel stores multi-line values as literal "\n" sequences,
// so the private key needs unescaping before jwt signing will accept it.
import admin from "firebase-admin";

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY || "";
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export default admin;
