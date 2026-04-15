import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";

const ADMIN_PIN = "1234";

const Admin = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("plai-admin") === "1");
  const [pin, setPin] = useState("");
  const navigate = useNavigate();

  // Taglines state
  const [taglines, setTaglines] = useState<any[]>([]);
  const [newTagline, setNewTagline] = useState({ text: "", category: "main", weight: 1 });
  const [showAddTagline, setShowAddTagline] = useState(false);

  // Picks state
  const [picks, setPicks] = useState<any[]>([]);
  const [newPick, setNewPick] = useState({ spotify_track_id: "", title: "", artist: "", album: "", note: "" });
  const [showAddPick, setShowAddPick] = useState(false);

  const [activeTab, setActiveTab] = useState<"taglines" | "picks" | "releases">("taglines");
  const [releasesMock, setReleasesMock] = useState(() => localStorage.getItem("plai-releases-mock") === "1");

  useEffect(() => {
    if (authed) { loadTaglines(); loadPicks(); }
  }, [authed]);

  const loadTaglines = async () => {
    const { data } = await supabase.from("taglines" as any).select("*").order("category").order("weight", { ascending: false });
    setTaglines(data || []);
  };

  const loadPicks = async () => {
    const { data } = await supabase.from("plai_picks" as any).select("*").order("position");
    setPicks(data || []);
  };

  const handlePinSubmit = () => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem("plai-admin", "1");
      setAuthed(true);
    } else {
      toast.error("incorrect PIN");
    }
  };

  const toggleTaglineActive = async (id: string, active: boolean) => {
    await supabase.from("taglines" as any).update({ active: !active } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, active: !active } : t));
  };

  const updateTaglineWeight = async (id: string, weight: number) => {
    await supabase.from("taglines" as any).update({ weight } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, weight } : t));
  };

  const deleteTagline = async (id: string) => {
    await supabase.from("taglines" as any).delete().eq("id", id);
    setTaglines(prev => prev.filter(t => t.id !== id));
  };

  const addTagline = async () => {
    if (!newTagline.text.trim()) return;
    const { data } = await supabase.from("taglines" as any).insert(newTagline as any).select().single();
    if (data) { setTaglines(prev => [...prev, data]); setNewTagline({ text: "", category: "main", weight: 1 }); setShowAddTagline(false); }
  };

  const togglePickActive = async (id: string, active: boolean) => {
    await supabase.from("plai_picks" as any).update({ active: !active } as any).eq("id", id);
    setPicks(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p));
  };

  const deletePick = async (id: string) => {
    await supabase.from("plai_picks" as any).delete().eq("id", id);
    setPicks(prev => prev.filter(p => p.id !== id));
  };

  const addPick = async () => {
    if (!newPick.title.trim()) return;
    const position = picks.length + 1;
    const { data } = await supabase.from("plai_picks" as any).insert({ ...newPick, position } as any).select().single();
    if (data) { setPicks(prev => [...prev, data]); setNewPick({ spotify_track_id: "", title: "", artist: "", album: "", note: "" }); setShowAddPick(false); }
  };

  const catColor = (cat: string) => {
    switch (cat) {
      case "core": return "#FF2D78";
      case "main": return "#4a6a8a";
      case "positive": return "#1a9e75";
      case "language": return "#9B59B6";
      default: return "#4a6a8a";
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-xs w-full mx-4 text-center">
          <h1 className="text-lg font-medium text-foreground mb-4">PLAI Admin</h1>
          <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="PIN" className="bg-background border-border text-center tracking-[0.3em] mb-4" />
          <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">enter</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-lg font-medium">PLAI Admin</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="flex gap-2 mb-6">
          {(["taglines", "picks", "releases"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${activeTab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {t === "taglines" ? "Taglines" : t === "picks" ? "PLAI Picks" : "Releases"}
            </button>
          ))}
        </div>

        {activeTab === "taglines" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{taglines.length} taglines</p>
              <button onClick={() => setShowAddTagline(!showAddTagline)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"><Plus className="h-3 w-3" /> add</button>
            </div>

            {showAddTagline && (
              <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 mb-4">
                <Input value={newTagline.text} onChange={(e) => setNewTagline(p => ({ ...p, text: e.target.value }))} placeholder="tagline text" className="bg-background border-border" />
                <div className="flex gap-2">
                  <select value={newTagline.category} onChange={(e) => setNewTagline(p => ({ ...p, category: e.target.value }))} className="rounded-lg bg-background border border-border px-3 py-1.5 text-sm text-foreground">
                    <option value="core">core</option>
                    <option value="main">main</option>
                    <option value="positive">positive</option>
                    <option value="language">language</option>
                  </select>
                  <select value={newTagline.weight} onChange={(e) => setNewTagline(p => ({ ...p, weight: Number(e.target.value) }))} className="rounded-lg bg-background border border-border px-3 py-1.5 text-sm text-foreground">
                    {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <button onClick={addTagline} className="rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground">save</button>
                </div>
              </div>
            )}

            {taglines.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: catColor(t.category) }}>{t.category}</span>
                <p className={`flex-1 text-sm ${t.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{t.text}</p>
                <select value={t.weight} onChange={(e) => updateTaglineWeight(t.id, Number(e.target.value))} className="rounded bg-background border border-border px-1.5 py-0.5 text-xs text-foreground w-12">
                  {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <button onClick={() => toggleTaglineActive(t.id, t.active)} className={`rounded-full px-2 py-0.5 text-[10px] ${t.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {t.active ? "on" : "off"}
                </button>
                <button onClick={() => deleteTagline(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{picks.length} picks</p>
              <button onClick={() => setShowAddPick(!showAddPick)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"><Plus className="h-3 w-3" /> add track</button>
            </div>

            {showAddPick && (
              <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2 mb-4">
                <Input value={newPick.spotify_track_id} onChange={(e) => setNewPick(p => ({ ...p, spotify_track_id: e.target.value }))} placeholder="spotify_track_id" className="bg-background border-border" />
                <Input value={newPick.title} onChange={(e) => setNewPick(p => ({ ...p, title: e.target.value }))} placeholder="title" className="bg-background border-border" />
                <Input value={newPick.artist} onChange={(e) => setNewPick(p => ({ ...p, artist: e.target.value }))} placeholder="artist" className="bg-background border-border" />
                <Input value={newPick.album} onChange={(e) => setNewPick(p => ({ ...p, album: e.target.value }))} placeholder="album" className="bg-background border-border" />
                <Input value={newPick.note} onChange={(e) => setNewPick(p => ({ ...p, note: e.target.value }))} placeholder="curator note" className="bg-background border-border" />
                <button onClick={addPick} className="rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground">save</button>
              </div>
            )}

            {picks.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <span className="text-xs font-medium text-primary w-6">#{p.position}</span>
                {p.album_art_url ? (
                  <img src={p.album_art_url} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded bg-card border border-border flex items-center justify-center text-xs text-muted-foreground">♪</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.artist}</p>
                  {p.note && <p className="text-[10px] text-muted-foreground italic truncate">"{p.note}"</p>}
                </div>
                <button onClick={() => togglePickActive(p.id, p.active)} className={`rounded-full px-2 py-0.5 text-[10px] ${p.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {p.active ? "on" : "off"}
                </button>
                <button onClick={() => deletePick(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Controls how the Releases tab renders. Use mock mode when demoing the app.</p>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Mock mode</p>
                <p className="text-xs text-muted-foreground mt-0.5">{releasesMock ? "showing demo tracks" : "showing real data"}</p>
              </div>
              <button
                onClick={() => {
                  const next = !releasesMock;
                  localStorage.setItem("plai-releases-mock", next ? "1" : "0");
                  setReleasesMock(next);
                  toast.success(next ? "mock mode on — reload releases to see demo tracks" : "mock mode off — reload releases to see real data");
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${releasesMock ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
              >
                {releasesMock ? "on" : "off"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
