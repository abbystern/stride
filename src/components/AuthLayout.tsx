import { ArrowUpRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-main">
        <header className="auth-header">
          <BrandMark />
          <span className="header-note">
            Made for the long run <span className="header-dot" />
          </span>
        </header>
        <div className="auth-content">{children}</div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} Stride</span>
          <span className="footer-separator" />
          <span>Your training, your pace.</span>
        </footer>
      </section>

      <aside className="auth-aside">
        <div className="aside-topline">
          <span className="aside-index">01 / YOUR NEXT CHAPTER</span>
          <ArrowUpRight size={18} strokeWidth={1.7} aria-hidden="true" />
        </div>
        <div className="aside-copy">
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="orbit-center">
              <span className="orbit-center-dot" />
            </div>
            <span className="orbit-node node-one" />
            <span className="orbit-node node-two" />
            <span className="orbit-node node-three" />
          </div>
          <p className="aside-kicker">A little more in sync</p>
          <h2>
            Progress is
            <br />
            built <em>one day</em>
            <br />
            at a time.
          </h2>
          <p className="aside-description">
            Bring your training together, find your rhythm, and keep showing up
            for what matters.
          </p>
          <ul className="aside-benefits">
            <li>
              <Check size={15} aria-hidden="true" />
              A clearer picture of your training
            </li>
            <li>
              <Check size={15} aria-hidden="true" />
              Built around the way you move
            </li>
          </ul>
        </div>
        <div className="aside-bottom">
          <span>FIND YOUR STRIDE</span>
          <span className="aside-bottom-line" />
          <span>EST. 2026</span>
        </div>
      </aside>
    </main>
  );
}
