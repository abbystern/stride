import { useState } from "react";
import { LogOut, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export default function AccountPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (!supabase) return;
    setPending(true);
    setSignOutError("");
    const { error } = await supabase.auth.signOut();
    setPending(false);

    if (error) {
      setSignOutError("We couldn’t sign you out. Please try again.");
      return;
    }

    navigate("/login", { replace: true });
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <BrandMark />
        <button
          className="signout-button"
          type="button"
          onClick={handleSignOut}
          disabled={pending}
        >
          <LogOut size={16} aria-hidden="true" />
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </header>

      <section className="account-content">
        <span className="eyebrow">YOUR STRIDE STARTS HERE</span>
        <div className="account-emblem" aria-hidden="true">
          <span className="emblem-ring ring-a" />
          <span className="emblem-ring ring-b" />
          <span className="emblem-dot" />
        </div>
        <h1>You’re in.</h1>
        <p className="account-welcome">
          Signed in as <strong>{session?.user.email}</strong>
        </p>
        <div className="account-divider" />
        <p className="account-next">
          A little space to keep track of the ways you move.
        </p>
        <div className="home-nav-block">
          <p>Your training journal</p>
          <div className="home-nav-actions">
            <Link to="/app/workouts"><BookOpen size={15} aria-hidden="true" /> Workout history</Link>
            <Link to="/app/stars"><Star size={15} aria-hidden="true" /> Starred workouts</Link>
            <Link to="/app/workouts/new"><Plus size={15} aria-hidden="true" /> Log a workout</Link>
          </div>
        </div>
        {signOutError && (
          <p className="form-error account-error" role="alert">
            {signOutError}
          </p>
        )}
      </section>
      <footer className="account-footer">
        <span>© {new Date().getFullYear()} Stride</span>
        <span>Your training, your pace.</span>
      </footer>
    </main>
  );
}
