import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./providers/AuthProvider";
import { hasSupabaseConfig } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import AccountPage from "./pages/AccountPage";
import { BrandMark } from "./components/BrandMark";

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-label="Loading Stride">
      <BrandMark />
      <span className="loading-dot" />
    </main>
  );
}

function ConfigurationScreen() {
  return (
    <main className="config-screen">
      <BrandMark />
      <section className="config-card">
        <span className="eyebrow">One quick setup step</span>
        <h1>Connect your Stride project</h1>
        <p>
          Add <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> to this Replit&apos;s Secrets,
          then restart the app.
        </p>
      </section>
    </main>
  );
}

function ProtectedRoute() {
  const { session, ready } = useAuth();

  if (!ready) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <AccountPage />;
}

function EntryRoute() {
  const { session, ready } = useAuth();

  if (!ready) return <LoadingScreen />;
  return <Navigate to={session ? "/app" : "/login"} replace />;
}

export default function App() {
  if (!hasSupabaseConfig) return <ConfigurationScreen />;

  return (
    <Routes>
      <Route path="/" element={<EntryRoute />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/app" element={<ProtectedRoute />} />
      <Route path="*" element={<EntryRoute />} />
    </Routes>
  );
}
