export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 40, maxWidth: 700 }}>
      <h1>Migrations Dashboard — skeleton deployed ✅</h1>
      <p>
        This confirms GitHub → Vercel → (Cloudflare Access, once configured) is wired up.
      </p>
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
