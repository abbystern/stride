import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BrandMark } from "../BrandMark";

export function WorkoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="workout-shell">
      <header className="workout-header">
        <BrandMark />
        <nav aria-label="Workout navigation">
          <NavLink to="/app">Home</NavLink>
          <NavLink to="/app/workouts" end>History</NavLink>
          <NavLink to="/app/workouts/new">New workout</NavLink>
        </nav>
      </header>
      {children}
    </div>
  );
}
