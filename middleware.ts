import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// This is the Pages Router equivalent of the App Router's proxy.ts/middleware.ts split
// Clerk's docs describe — the Pages Router always uses middleware.ts at the project
// root, regardless of Next.js version.
//
// This layer only proves *authentication* (signed in with an approved Google account +
// MFA). The *authorization* check (is this specific person allowed into this specific
// internal tool) happens server-side in lib/authz.js, called from each protected page's
// getServerSideProps and from each API route — see pages/index.js and
// pages/api/hubspot/tickets.js for the pattern.

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/unauthorized",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, always run for api routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api|trpc)(.*)",
  ],
};
