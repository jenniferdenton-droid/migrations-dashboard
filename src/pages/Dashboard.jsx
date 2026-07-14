// The interactive dashboard (public/dashboard.html) is still the same self-contained
// vanilla-JS file used in every earlier version -- rebuilding ~2,000 lines of working
// charts/tables/modals into React components would be a lot of risk for no functional
// gain right now, since it's still running on sample data either way. It's mounted in
// an iframe so its own script/global scope stays isolated from React's.
//
// Once the Cloud Functions in functions/ are live and Firestore has real synced data,
// the natural next step is to have dashboard.html read from Firestore (the Firebase JS
// SDK's onSnapshot/getDocs) instead of the hardcoded TICKETS array -- at that point it
// could stay exactly where it is, iframe and all.
export default function Dashboard() {
  function signOut() {
    window.location.assign("/api/auth/logout");
  }
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
