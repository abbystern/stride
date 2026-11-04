import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./providers/AuthProvider";
import {
  hasSupabaseConfig,
  supabaseConfigurationError,
} from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import AccountPage from "./pages/AccountPage";
import { BrandMark } from "./components/BrandMark";
import WorkoutHistoryPage from "./pages/workouts/WorkoutHistoryPage";
import NewWorkoutPage from "./pages/workouts/NewWorkoutPage";
import WorkoutDetailPage from "./pages/workouts/WorkoutDetailPage";
import EditWorkoutPage from "./pages/workouts/EditWorkoutPage";
import StarredWorkoutsPage from "./pages/workouts/StarredWorkoutsPage";
import { StarsProvider } from "./providers/StarsProvider";
import "./workouts.css";

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
        <p role="alert">{supabaseConfigurationError}</p>
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
  return <StarsProvider><Outlet /></StarsProvider>;
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
      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<AccountPage />} />
        <Route path="stars" element={<StarredWorkoutsPage />} />
        <Route path="workouts" element={<WorkoutHistoryPage />} />
        <Route path="workouts/new" element={<NewWorkoutPage />} />
        <Route path="workouts/:id" element={<WorkoutDetailPage />} />
        <Route path="workouts/:id/edit" element={<EditWorkoutPage />} />
      </Route>
      <Route path="*" element={<EntryRoute />} />
    </Routes>
  );
}
