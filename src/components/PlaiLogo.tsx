const PlaiLogo = ({ className = "text-4xl" }: { className?: string }) => (
  <span className={`font-display tracking-tight ${className}`}>
    <span className="text-foreground">PL</span>
    <span className="text-primary">A</span>
    <span className="text-foreground">I</span>
  </span>
);

export default PlaiLogo;
