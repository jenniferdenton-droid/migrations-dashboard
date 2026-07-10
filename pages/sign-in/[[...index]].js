import { SignIn } from "@clerk/nextjs";

// No public sign-up (per SETUP.md Section 3.4) — this only renders sign-in, not
// sign-up. Invite-only accounts are created from the Clerk dashboard.
export default function SignInPage() {
  return (
    <main style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <SignIn path="/sign-in" routing="path" signUpUrl={undefined} />
    </main>
  );
}
