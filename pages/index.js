import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { isAllowedEmail } from "../lib/authz";

// Server-side authorization pattern used on every protected page: middleware.ts already
// guarantees the request is authenticated (signed in + MFA'd); this getServerSideProps
// additionally confirms the person is on the roster before rendering anything.
export async function getServerSideProps(ctx) {
  const { userId } = getAuth(ctx.req);
  if (!userId) {
    return { redirect: { destination: "/sign-in", permanent: false } };
  }
  const user = await clerkClient.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase() || null;
  if (!(await isAllowedEmail(email))) {
    return { redirect: { destination: "/unauthorized", permanent: false } };
  }
  return { props: { email } };
}

export default function Home({ email }) {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 40, maxWidth: 700 }}>
      <h1>Migrations Dashboard — skeleton deployed ✅</h1>
      <p>Signed in as {email}. GitHub → Vercel → Clerk auth is wired up end to end.</p>
      <p>Live API routes to test once your env vars are set:</p>
      <ul>
        <li><code>GET /api/hubspot/tickets</code></li>
        <li><code>GET /api/hubspot/companies</code></li>
        <li><code>POST /api/calendar/freebusy</code></li>
        <li><code>POST /api/slack/notify</code></li>
      </ul>
      <p>
        The full dashboard UI (Launch Calendar, Manager Capacity, Pipeline board) lives
        in the reviewed prototype artifact — porting it into React components here is
        the next step once the data layer above is confirmed working end to end.
      </p>
    </main>
  );
}
