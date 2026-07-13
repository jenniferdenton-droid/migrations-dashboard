import { next } from "@vercel/functions";
import { jwtVerify } from "jose";
export default async function middleware(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/api/auth/")) return next();
  const token = (request.headers.get("cookie") || "").match(/(?:^|;\s*)moxie_session=([^;]+)/)?.[1];
  if (token && process.env.AUTH_SECRET) {
    try { await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET)); return next(); } catch {}
  }
  if (pathname.startsWith("/api/")) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.redirect(new URL("/api/auth/login", request.url), 302);
}
export const config = { matcher: ["/((?!favicon.ico).*)"] };
