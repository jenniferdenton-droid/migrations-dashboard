import { useState } from "react";
import { signInWithGoogle } from "../lib/firebaseClient";

export default function SignIn() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On success, App.jsx's onAuthStateChanged fires automatically and routes to "/".
      // On rejection -- wrong domain or an unverified email -- the beforeSignIn
      // blocking function (functions/index.js) throws, and Firebase surfaces that as a
      // rejected promise here with the function's custom message.
    } catch (err) {
      setError(err.message || "Something went wrong starting sign-in.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo-mark">M</div>
        <h1 className="auth-title">Moxie Migrations Dashboard</h1>
        <p className="auth-sub">Sign in with your Moxie Google account to continue.</p>
        <button className="btn-google" onClick={handleClick} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.71H.9v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.72A5.4 5.4 0 0 1 3.66 9c0-.6.1-1.18.29-1.72V4.95H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.05z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.95l3.05 2.33C4.66 5.16 6.65 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>
        {error && <div className="auth-error">{error}</div>}
        <p className="auth-note">
          Access is restricted to @joinmoxie.com Google accounts.
        </p>
      </div>
    </div>
  );
}
