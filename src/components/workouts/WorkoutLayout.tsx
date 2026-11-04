import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BrandMark } from "../BrandMark";
import { useStars } from "../../providers/StarsProvider";

export function WorkoutLayout({ children, hideStarsError = false }: { children: ReactNode; hideStarsError?: boolean }) {
  const { error: starsError, reload } = useStars();
  return (
    <div className="workout-shell">
      <header className="workout-header">
        <BrandMark />
        <nav aria-label="Workout navigation">
          <NavLink to="/app">Home</NavLink>
          <NavLink to="/app/workouts" end>History</NavLink>
          <NavLink to="/app/stars">Starred</NavLink>
          <NavLink to="/app/workouts/new">New workout</NavLink>
        </nav>
      </header>
      {starsError && !hideStarsError && (
        <aside className="stars-load-banner" role="alert">
          <p>{starsError} Your workout journal is still available.</p>
          <button type="button" onClick={reload}>Retry</button>
        </aside>
      )}
      {children}
    </div>
  );
}
