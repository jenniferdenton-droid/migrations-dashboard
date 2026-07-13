import { signOut } from "../lib/supabaseClient";

// Defense-in-depth: the "before user created" Postgres hook (see
// supabase/migrations/0002_domain_gate.sql) should already prevent a non-@joinmoxie.com
// account from ever being created, so in practice this page shouldn't be reachable. It
// exists in case that hook is ever misconfigured or disabled, and as a page to link to
// from any other manual roster check you add later.
export default function Unauthorized() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo-mark">M</div>
        <h1 className="auth-title">Not authorized</h1>
        <p className="auth-sub">
          This account isn't approved for the Migrations Dashboard. If you think this is
          a mistake, contact Jennifer Denton.
        </p>
        <button className="btn-google" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
