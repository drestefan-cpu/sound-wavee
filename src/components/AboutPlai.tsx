import { X } from "lucide-react";
import { useMemo } from "react";
import PlaiLogo from "./PlaiLogo";

const MiniStarfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        opacity: 0.05 + Math.random() * 0.15,
        size: 0.6 + Math.random() * 1,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            backgroundColor: "#F0EBE3",
          }}
        />
      ))}
    </div>
  );
};

const Divider = () => (
  <div className="flex justify-center py-8">
    <div className="w-10 h-px" style={{ backgroundColor: "#FF2D78" }} />
  </div>
);

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm tracking-[0.15em] uppercase mb-4" style={{ color: "#FF2D78" }}>
    {children}
  </p>
);

const AboutPlai = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: "#080B12" }}>
      <MiniStarfield />

      <button
        onClick={onClose}
        className="fixed top-4 left-4 z-50 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative z-10 max-w-md mx-auto px-6 py-16 text-center"
        style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300, lineHeight: 1.8, color: "#F0EBE3" }}
      >
        <div className="mb-3">
          <PlaiLogo className="text-5xl" glow />
        </div>
        <p className="text-[10px] tracking-[0.2em] uppercase mb-16" style={{ color: "#FF2D78" }}>
          from old provençal — it pleases me
        </p>

        <p className="text-sm leading-relaxed mb-2">music is more interesting</p>
        <p className="text-sm leading-relaxed >when you can check in on your friends </p>

        <Divider />
        <SectionHeader>your feed</SectionHeader>
        
        <p className="text-sm leading-relaxed mb-2">your feed shows the songs </p>
        <p className="text-sm leading-relaxed mb-2">your friends are liking —</p>

        <div className="h-10" />

        <p className="text-sm leading-relaxed mb-2">react to what resonates.</p>
        <p className="text-sm leading-relaxed mb-2">save what you love.</p>
        <p className="text-sm leading-relaxed mb-2">follow the people whose taste</p>
        <p className="text-sm leading-relaxed">you actually trust.</p>

        <Divider />

        <SectionHeader>your library</SectionHeader>

        <p className="text-sm leading-relaxed mb-2">your collection is everything</p>
        <p className="text-sm leading-relaxed mb-2">you've liked on your streaming platform.</p>
        <p className="text-sm leading-relaxed mb-2">your finds are songs you've saved</p>
        <p className="text-sm leading-relaxed">from your friends' feeds on PLAI.</p>

        <div className="h-8" />

        <p className="text-sm leading-relaxed mb-2">think of your collection as your history.</p>
        <p className="text-sm leading-relaxed">your finds as your discoveries.</p>

        <Divider />

        <SectionHeader>trending</SectionHeader>

        <p className="text-sm leading-relaxed mb-2">a live look at what's moving</p>
        <p className="text-sm leading-relaxed mb-2">in the charts right now.</p>
        <p className="text-sm leading-relaxed">react, save, or open directly in Spotify.</p>

        <Divider />

        <SectionHeader>settings</SectionHeader>

        <p className="text-sm leading-relaxed mb-2">connect your Spotify, set your status,</p>
        <p className="text-sm leading-relaxed mb-2">pick your profile colour,</p>
        <p className="text-sm leading-relaxed mb-2">and set up a quick-access PIN</p>
        <p className="text-sm leading-relaxed">so you never have to log in twice.</p>

        <Divider />

        <div className="space-y-3">
          <p className="text-sm" style={{ color: "#2a3a4a" }}>
            <span style={{ color: "#FF2D78" }}>✦</span>{" "}
            <span className="tracking-[0.1em]" style={{ color: "#FF2D78" }}>
              plai·lists
            </span>{" "}
            <span className="italic text-xs">coming soon</span>
          </p>
          <p className="text-sm" style={{ color: "#2a3a4a" }}>
            <span style={{ color: "#FF2D78" }}>✦</span> recommendations{" "}
            <span className="italic text-xs">coming soon</span>
          </p>
          <p className="text-sm" style={{ color: "#2a3a4a" }}>
            <span style={{ color: "#FF2D78" }}>✦</span> Apple Music <span className="italic text-xs">coming soon</span>
          </p>
        </div>

        <Divider />

        <p className="text-base italic mt-4" style={{ color: "#F0EBE3" }}>
          that's it.
          <br />
          enjoy what you find.
        </p>

        <div className="h-16" />
      </div>
    </div>
  );
};

export default AboutPlai;
