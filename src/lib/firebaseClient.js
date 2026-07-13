import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn(
    "VITE_FIREBASE_* env vars are not set. Add them in Lovable's Environment " +
      "Variables (or .env.local for local dev) -- see SETUP_LOVABLE.md Section 2."
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
// Nudges Google to show the account picker every time rather than silently reusing
// whichever Google account is currently active in the browser -- useful since this is
// a work tool people may open on a personal profile by habit.
googleProvider.setCustomParameters({ prompt: "select_account" });

// The REAL access gate is server-side: a "beforeSignIn" Auth Blocking Function
// (functions/index.js, deployed separately -- see SETUP_LOVABLE.md Section 3) rejects
// the sign-in outright for any email that isn't Google-verified and on
// @joinmoxie.com, before Firebase ever issues a session for it. If that function
// rejects, signInWithPopup here throws, which the caller (SignIn.jsx) catches and
// displays.
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}
