import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PlaiLogo from "./PlaiLogo";
import { Input } from "@/components/ui/input";

const ADMIN_PIN = "1234";

const MiniStarfield = () => {
  const stars = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    opacity: 0.05 + Math.random() * 0.15,
    size: 0.6 + Math.random() * 1,
  }));

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

const DeveloperNotes = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("plai-admin") === "1");
  const [editMode, setEditMode] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pin, setPin] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase
        .from("developer_notes" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle() as any);

      const content = data?.content || "";
      setNotes(content);
      setDraft(content);
      setUpdatedAt(data?.updated_at || null);
      setLoading(false);
    };

    load();
  }, []);

  const handlePinSubmit = () => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem("plai-admin", "1");
      setAuthed(true);
      setEditMode(true);
      setShowPinPrompt(false);
      setPin("");
      return;
    }
    toast.error("incorrect PIN");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke("save-developer-notes", {
      body: { pin: ADMIN_PIN, content: draft, user_id: user.id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    setSaving(false);

    if (error) {
      toast.error("couldn't save notes — try again");
      return;
    }

    const nextContent = data?.note?.content ?? draft;
    setNotes(nextContent);
    setDraft(nextContent);
    setUpdatedAt(data?.note?.updated_at ?? new Date().toISOString());
    toast.success("developer notes saved");
  };

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

      <button
        onClick={() => {
          if (authed) {
            setEditMode((prev) => !prev);
            return;
          }
          setShowPinPrompt(true);
        }}
        className="fixed z-50 text-muted-foreground hover:text-foreground transition-colors"
        style={{
          top: "max(env(safe-area-inset-top, 16px), 16px)",
          right: 16,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          padding: 8,
        }}
      >
        <Pencil className="h-5 w-5" />
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
        <div className="mb-3 text-center">
          <PlaiLogo className="text-5xl" glow />
        </div>
        <p className="text-[10px] tracking-[0.2em] uppercase mb-8 text-center" style={{ color: "#FF2D78" }}>
          developer notes
        </p>

        {showPinPrompt && (
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-4 mb-6 text-center">
            <p className="text-xs text-muted-foreground mb-3">enter admin PIN</p>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="bg-background border-border text-center tracking-[0.3em] w-24 mx-auto mb-3"
            />
            <button
              onClick={handlePinSubmit}
              disabled={pin.length !== 4}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              enter
            </button>
          </div>
        )}

        {updatedAt && (
          <p className="text-[10px] text-muted-foreground mb-4 text-center">
            updated {new Date(updatedAt).toLocaleString()}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-center text-muted-foreground">loading notes…</p>
        ) : editMode ? (
          <div className="space-y-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full min-h-[55vh] rounded-2xl border border-border bg-card/80 p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="add developer notes, known bugs, tester notes…"
              style={{ resize: "vertical" }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "saving..." : "save notes"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {notes.trim() || "No developer notes yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeveloperNotes;
