const PlaiLogo = ({ className = "text-4xl", glow = true }: { className?: string; glow?: boolean }) => (
  <span className={`font-display tracking-tight ${className}`}>
    <span className="text-foreground">PL</span>
    <span className={`text-primary ${glow ? "animate-logo-glow" : ""}`}>A</span>
    <span className="text-foreground">I</span>
  </span>
);

export default PlaiLogo;
