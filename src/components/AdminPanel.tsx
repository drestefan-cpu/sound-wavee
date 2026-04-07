import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const ADMIN_PIN = "1234";

const catColor = (cat: string) => {
  switch (cat) {
    case "core": return "#FF2D78";
    case "main": return "#4a6a8a";
    case "positive": return "#1a9e75";
    case "language": return "#9B59B6";
    default: return "#4a6a8a";
  }
};

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel = ({ onClose }: AdminPanelProps) => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("plai-admin") === "1");
  const [pin, setPin] = useState("");
  const [activeTab, setActiveTab] = useState<"taglines" | "picks">("taglines");

  const [taglines, setTaglines] = useState<any[]>([]);
  const [newTagline, setNewTagline] = useState({ text: "", category: "main", weight: 1 });
  const [showAddTagline, setShowAddTagline] = useState(false);

  const [picks, setPicks] = useState<any[]>([]);
  const [newPick, setNewPick] = useState({ spotify_track_id: "", title: "", artist: "", album: "", note: "" });
  const [showAddPick, setShowAddPick] = useState(false);

  useEffect(() => {
    if (authed) { loadTaglines(); loadPicks(); }
  }, [authed]);

  const loadTaglines = async () => {
    const { data } = await supabase.from("taglines").select("*").order("category").order("weight", { ascending: false });
    setTaglines(data || []);
  };

  const loadPicks = async () => {
    const { data } = await supabase.from("plai_picks").select("*").order("position");
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
    await supabase.from("taglines").update({ active: !active } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, active: !active } : t));
  };

  const updateTaglineWeight = async (id: string, weight: number) => {
    await supabase.from("taglines").update({ weight } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, weight } : t));
  };

  const deleteTagline = async (id: string) => {
    await supabase.from("taglines").delete().eq("id", id);
    setTaglines(prev => prev.filter(t => t.id !== id));
  };

  const addTagline = async () => {
    if (!newTagline.text.trim()) return;
    const { data } = await supabase.from("taglines").insert(newTagline as any).select().single();
    if (data) { setTaglines(prev => [...prev, data]); setNewTagline({ text: "", category: "main", weight: 1 }); setShowAddTagline(false); }
  };

  const togglePickActive = async (id: string, active: boolean) => {
    await supabase.from("plai_picks").update({ active: !active } as any).eq("id", id);
    setPicks(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p));
  };

  const deletePick = async (id: string) => {
    await supabase.from("plai_picks").delete().eq("id", id);
    setPicks(prev => prev.filter(p => p.id !== id));
  };

  const addPick = async () => {
    if (!newPick.title.trim()) return;
    const position = picks.length + 1;
    const { data } = await supabase.from("plai_picks").insert({ ...newPick, position } as any).select().single();
    if (data) { setPicks(prev => [...prev, data]); setNewPick({ spotify_track_id: "", title: "", artist: "", album: "", note: "" }); setShowAddPick(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border-t border-border rounded-t-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-sm font-medium text-foreground">PLAI Admin</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {!authed ? (
          <div className="p-6 text-center">
            <p className="text-xs text-muted-foreground mb-3">enter admin PIN</p>
            <Input
              type="password" inputMode="numeric" maxLength={4}
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="bg-background border-border text-center tracking-[0.3em] w-24 mx-auto mb-3"
            />
            <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              enter
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex gap-2 mb-4">
              {(["taglines", "picks"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${activeTab === t ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"}`}>
                  {t === "taglines" ? "Taglines" : "PLAI Picks"}
                </button>
              ))}
            </div>

            {activeTab === "taglines" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{taglines.length} taglines</p>
                  <button onClick={() => setShowAddTagline(!showAddTagline)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"><Plus className="h-3 w-3" /> add</button>
                </div>

                {showAddTagline && (
                  <div className="rounded-xl border border-primary/30 bg-background p-3 space-y-2 mb-3">
                    <Input value={newTagline.text} onChange={(e) => setNewTagline(p => ({ ...p, text: e.target.value }))} placeholder="tagline text" className="bg-card border-border text-sm" />
                    <div className="flex gap-2">
                      <select value={newTagline.category} onChange={(e) => setNewTagline(p => ({ ...p, category: e.target.value }))} className="rounded-lg bg-card border border-border px-2 py-1 text-xs text-foreground">
                        <option value="core">core</option><option value="main">main</option><option value="positive">positive</option><option value="language">language</option>
                      </select>
                      <select value={newTagline.weight} onChange={(e) => setNewTagline(p => ({ ...p, weight: Number(e.target.value) }))} className="rounded-lg bg-card border border-border px-2 py-1 text-xs text-foreground">
                        {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                      <button onClick={addTagline} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">save</button>
                    </div>
                  </div>
                )}

                {taglines.map(t => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white flex-shrink-0" style={{ backgroundColor: catColor(t.category) }}>{t.category}</span>
                    <p className={`flex-1 text-xs min-w-0 truncate ${t.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{t.text}</p>
                    <select value={t.weight} onChange={(e) => updateTaglineWeight(t.id, Number(e.target.value))} className="rounded bg-card border border-border px-1 py-0.5 text-[10px] text-foreground w-10">
                      {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <button onClick={() => toggleTaglineActive(t.id, t.active)} className={`rounded-full px-1.5 py-0.5 text-[9px] ${t.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {t.active ? "on" : "off"}
                    </button>
                    <button onClick={() => deleteTagline(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{picks.length} picks</p>
                  <button onClick={() => setShowAddPick(!showAddPick)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"><Plus className="h-3 w-3" /> add</button>
                </div>

                {showAddPick && (
                  <div className="rounded-xl border border-primary/30 bg-background p-3 space-y-2 mb-3">
                    <Input value={newPick.spotify_track_id} onChange={(e) => setNewPick(p => ({ ...p, spotify_track_id: e.target.value }))} placeholder="spotify_track_id" className="bg-card border-border text-sm" />
                    <Input value={newPick.title} onChange={(e) => setNewPick(p => ({ ...p, title: e.target.value }))} placeholder="title" className="bg-card border-border text-sm" />
                    <Input value={newPick.artist} onChange={(e) => setNewPick(p => ({ ...p, artist: e.target.value }))} placeholder="artist" className="bg-card border-border text-sm" />
                    <Input value={newPick.album} onChange={(e) => setNewPick(p => ({ ...p, album: e.target.value }))} placeholder="album" className="bg-card border-border text-sm" />
                    <Input value={newPick.note} onChange={(e) => setNewPick(p => ({ ...p, note: e.target.value }))} placeholder="note" className="bg-card border-border text-sm" />
                    <button onClick={addPick} className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">save</button>
                  </div>
                )}

                {picks.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-medium text-primary w-5">#{p.position}</span>
                    {p.album_art_url ? (
                      <img src={p.album_art_url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-card border border-border flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">♪</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.artist}</p>
                    </div>
                    <button onClick={() => togglePickActive(p.id, p.active)} className={`rounded-full px-1.5 py-0.5 text-[9px] ${p.active ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {p.active ? "on" : "off"}
                    </button>
                    <button onClick={() => deletePick(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
