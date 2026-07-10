import { SignOutButton } from "@clerk/nextjs";

// Reached when someone signs in successfully with Clerk (approved Google account + MFA)
// but their email isn't on the People Roster (lib/authz.js) — i.e. authenticated, but
// not authorized for this specific tool.
export default function Unauthorized() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 40, maxWidth: 600 }}>
      <h1>Not authorized</h1>
      <p>
        You&apos;re signed in, but this email isn&apos;t on the Migrations Dashboard
        roster yet. Ask whoever manages Settings → People Roster to add you.
      </p>
      <SignOutButton>
        <button>Sign out</button>
      </SignOutButton>
    </main>
  );
}
