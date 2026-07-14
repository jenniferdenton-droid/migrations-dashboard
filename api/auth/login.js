import crypto from "node:crypto";
export default function handler(req, res) {
  const state = crypto.randomBytes(24).toString("hex");
  res.setHeader("Set-Cookie", `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  const origin = (process.env.AUTH_URL || "").replace(/\/$/, "");
  if (!origin) return res.status(500).send("AUTH_URL is not configured");
  const redirectUri = `${origin}/api/auth/callback/google`;
  const query = new URLSearchParams({ client_id: process.env.AUTH_GOOGLE_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, hd: "joinmoxie.com", prompt: "select_account" });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
}
