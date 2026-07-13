import { signOut } from "../lib/supabaseClient";

// The interactive dashboard (public/dashboard.html) is still the same self-contained
// vanilla-JS file used in the Vercel/Next.js version -- rebuilding ~2,000 lines of
// working charts/tables/modals into React components would be a lot of risk for no
// functional gain right now, since it's still running on sample data either way. It's
// mounted in an iframe so its own script/global scope stays isolated from React's.
//
// Once the Supabase Edge Functions in supabase/functions/ are live and Postgres has
// real synced data, the natural next step is to have dashboard.html fetch from Supabase
// (supabase.from('tickets').select() etc.) instead of reading the hardcoded TICKETS
// array -- at that point it could stay exactly where it is, iframe and all.
export default function Dashboard() {
  return (
    <div>
      <div className="topbar">
        <span>Signed in</span>
        <button onClick={signOut}>Sign out</button>
      </div>
      <iframe className="dash-frame" src="/dashboard.html" title="Migrations Dashboard" />
    </div>
  );
}
