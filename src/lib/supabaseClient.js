import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud in dev, not a thrown error, so the app can still render a helpful message
  // instead of a blank white screen if env vars aren't set yet.
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Add them in Lovable's " +
      "Environment Variables (or .env.local for local dev) -- see SETUP_LOVABLE.md Section 2."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// Kicks off the Google OAuth flow. Domain restriction to @joinmoxie.com is enforced
// server-side by the "before user created" Postgres auth hook (see
// supabase/migrations/0002_domain_gate.sql) -- rejecting here would only be a UX nicety,
// the hook is what actually stops account creation for other domains.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
