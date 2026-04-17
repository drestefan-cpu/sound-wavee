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
  <p
    className="tracking-[0.35em] uppercase mb-4"
    style={{ color: "#FF2D78", fontSize: 9 }}
  >
    {children}
  </p>
);

const PullQuote = ({ children }: { children: React.ReactNode }) => (
  <div
    className="my-8 pl-7"
    style={{ borderLeft: "2px solid #FF2D78" }}
  >
    <p
      style={{
        fontFamily: "'Unbounded', sans-serif",
        fontWeight: 300,
        fontSize: "clamp(18px, 5vw, 26px)",
        lineHeight: 1.3,
        letterSpacing: "-0.01em",
        color: "#F0EBE3",
      }}
    >
      {children}
    </p>
  </div>
);

const AboutPlai = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: "#080B12" }}>
      <MiniStarfield />

      <button
        onClick={onClose}
        className="fixed z-50 text-muted-foreground hover:text-foreground transition-colors"
        style={{
          top: "max(env(safe-area-inset-top, 16px), 16px)",
          left: 16,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          padding: 8,
        }}
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative z-10 max-w-md mx-auto px-6"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 300,
          lineHeight: 1.8,
          color: "#F0EBE3",
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 64px), 80px)",
          paddingBottom: 64,
        }}
      >
        {/* Header — centered */}
        <div className="text-center mb-3">
          <PlaiLogo className="text-5xl" glow />
        </div>
        <p className="text-center text-[10px] tracking-[0.2em] uppercase mb-10" style={{ color: "#FF2D78" }}>
          from old provençal — it pleases me
        </p>

        <PullQuote>come listen to this.</PullQuote>

        <p className="text-sm leading-relaxed mb-16 text-left" style={{ color: "#4a6a8a" }}>
          the troubadours had a word for it. a song. a feeling. something you had to share. PLAI is the home for that impulse.
        </p>

        <Divider />

        <SectionHeader>what it is</SectionHeader>

        <p className="text-sm leading-relaxed mb-4 text-left" style={{ color: "#4a6a8a" }}>
          a feed of songs your friends actually liked. not posts. not picks. their real listening history — yours too — visible to the people who trust your taste.
        </p>

        <p className="text-sm leading-relaxed text-left" style={{ color: "#4a6a8a" }}>
          react to what moves you. save what you love. send something to a friend.
        </p>

        <Divider />

        <SectionHeader>your library</SectionHeader>

        <p className="text-sm leading-relaxed mb-4 text-left" style={{ color: "#4a6a8a" }}>
          your collection is everything you've liked on your streaming platform. your finds are what you've saved from other people's feeds. your for you is what someone sent just to you.
        </p>

        <p className="text-sm leading-relaxed text-left" style={{ color: "#4a6a8a" }}>
          your history. your discoveries. your deliveries.
        </p>

        <Divider />

        <SectionHeader>not an algorithm</SectionHeader>

        <p className="text-sm leading-relaxed mb-4 text-left" style={{ color: "#4a6a8a" }}>
          PLAI doesn't suggest songs. it doesn't know what you might like. it shows you what your friends actually liked — which is better.
        </p>

        <p className="text-sm leading-relaxed text-left" style={{ color: "#4a6a8a" }}>
          no daily posts. no performance. no pressure to share anything curated. it's ambient. it's there when you want it.
        </p>

        <Divider />

        <div className="space-y-3 text-left">
          <p className="text-sm" style={{ color: "#2a3a4a" }}>
            <span style={{ color: "#FF2D78" }}>✦</span>{" "}
            <span className="tracking-[0.1em]" style={{ color: "#FF2D78" }}>
              plai·lists
            </span>{" "}
            <span className="italic text-xs">coming soon</span>
          </p>
          <p className="text-sm" style={{ color: "#2a3a4a" }}>
            <span style={{ color: "#FF2D78" }}>✦</span> tidal collection{" "}
            <span className="italic text-xs">coming soon</span>
          </p>
          <p className="text-sm" style={{ color: "#2a3a4a" }}>
            <span style={{ color: "#FF2D78" }}>✦</span> apple music{" "}
            <span className="italic text-xs">coming soon</span>
          </p>
        </div>

        <Divider />

        <p className="text-base italic text-left mt-4" style={{ color: "#F0EBE3" }}>
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
