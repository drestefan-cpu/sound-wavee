interface PlaiLogoProps {
  className?: string;
  glow?: boolean;
  /** What the logo sits on — Dawn's outlined logo fills its letters with this colour */
  surface?: "background" | "card";
}

/**
 * PLAI wordmark. At Night: cream letters with a pink A.
 * At Dawn: a clean navy outline with a pink A. The outline is drawn as a thick stroke
 * underneath, then the letters are filled with the surface colour on top, so only the
 * outer edge shows and letters that touch don't produce overlap lines (see index.css).
 */
const PlaiLogo = ({ className = "text-4xl", glow = true, surface = "background" }: PlaiLogoProps) => (
  <span
    className={`plai-logo font-display tracking-tight ${className}`}
    style={{ "--logo-knockout": `hsl(var(--${surface}))` } as React.CSSProperties}
  >
    <span className="plai-logo-outline" aria-hidden="true">
      PL<span className="plai-logo-a">A</span>I
    </span>
    <span className="plai-logo-fill">
      <span className="plai-logo-letters">PL</span>
      <span className={`text-primary ${glow ? "animate-logo-glow" : ""}`}>A</span>
      <span className="plai-logo-letters">I</span>
    </span>
  </span>
);

export default PlaiLogo;
