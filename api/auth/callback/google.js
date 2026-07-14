import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, private, max-age=0");
    if (!req.query.code || !req.query.state || !process.env.AUTH_SECRET) throw new Error("Missing OAuth callback data");
    const { payload: statePayload } = await jwtVerify(req.query.state, new TextEncoder().encode(process.env.AUTH_SECRET));
    if (statePayload.purpose !== "google-oauth-state") throw new Error("Invalid OAuth state");
    const origin = (process.env.AUTH_URL || "").replace(/\/$/, "");
    const redirectUri = `${origin}/api/auth/callback/google`;
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: req.query.code, client_id: process.env.AUTH_GOOGLE_ID, client_secret: process.env.AUTH_GOOGLE_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    const tokens = await response.json();
    if (!tokens.id_token) throw new Error(tokens.error_description || "Google token exchange failed");
    const { payload } = await jwtVerify(tokens.id_token, jwks, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: process.env.AUTH_GOOGLE_ID });
    if (payload.hd !== "joinmoxie.com" || !payload.email_verified || !String(payload.email).toLowerCase().endsWith("@joinmoxie.com")) return res.status(403).send("Access is limited to verified @joinmoxie.com accounts.");
    const session = await new SignJWT({ email: payload.email, name: payload.name }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    res.setHeader("Set-Cookie", `moxie_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`);
    res.redirect("/");
  } catch (error) { res.status(401).send(`Authentication failed: ${error.message}`); }
}
