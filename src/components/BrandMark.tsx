import { Footprints } from "lucide-react";

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`brand${light ? " brand-light" : ""}`}
      href="/"
      aria-label="Stride home"
    >
      <span className="brand-icon">
        <Footprints size={19} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span>stride</span>
    </a>
  );
}
