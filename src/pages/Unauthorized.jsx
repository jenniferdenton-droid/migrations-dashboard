import { signOut } from "../lib/firebaseClient";

// In practice this page usually isn't reached: when the beforeSignIn blocking function
// (functions/index.js) rejects a sign-in, signInWithPopup's promise rejects and
// SignIn.jsx shows that error inline without ever navigating here, since no session
// was created to route "/" -> here off of. This route exists as a direct link/fallback
// in case that changes (e.g. a redirect-based sign-in flow instead of a popup).
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
