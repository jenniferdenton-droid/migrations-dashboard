import crypto from "node:crypto";
import { SignJWT } from "jose";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  if (!process.env.AUTH_SECRET) return res.status(500).send("AUTH_SECRET is not configured");
  const state = await new SignJWT({ nonce: crypto.randomBytes(24).toString("hex"), purpose: "google-oauth-state" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const origin = (process.env.AUTH_URL || "").replace(/\/$/, "");
  if (!origin) return res.status(500).send("AUTH_URL is not configured");
  const redirectUri = `${origin}/api/auth/callback/google`;
  const query = new URLSearchParams({ client_id: process.env.AUTH_GOOGLE_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, hd: "joinmoxie.com", prompt: "select_account" });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
}
