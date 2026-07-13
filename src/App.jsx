import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import SignIn from "./pages/SignIn";
import Unauthorized from "./pages/Unauthorized";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="loading-shell">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/sign-in" element={session ? <Navigate to="/" replace /> : <SignIn />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route
        path="/"
        element={session ? <Dashboard /> : <Navigate to="/sign-in" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
