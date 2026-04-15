import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const ADMIN_PIN = "1234";

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel = ({ onClose }: AdminPanelProps) => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("plai-admin") === "1");
  const [pin, setPin] = useState("");
  const [activeTab, setActiveTab] = useState<"taglines" | "picks">("taglines");

  const [taglines, setTaglines] = useState<any[]>([]);
  const [taglinesError, setTaglinesError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newTagline, setNewTagline] = useState({ text: "", category: "general", weight: 5 });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [picks, setPicks] = useState<any[]>([]);
  const [newPick, setNewPick] = useState({ spotify_track_id: "", title: "", artist: "", album: "", note: "" });
  const [showAddPick, setShowAddPick] = useState(false);

  useEffect(() => {
    if (authed) { loadTaglines(); loadPicks(); }
  }, [authed]);

  const loadTaglines = async () => {
    const { data, error } = await supabase.from("taglines").select("*").order("category").order("weight", { ascending: false });
    if (error && error.code === "42P01") { setTaglinesError(true); return; }
    setTaglines(data || []);
  };

  const loadPicks = async () => {
    const { data } = await supabase.from("plai_picks").select("*").order("position");
    setPicks(data || []);
  };

  const handlePinSubmit = () => {
    if (pin === ADMIN_PIN) { sessionStorage.setItem("plai-admin", "1"); setAuthed(true); }
    else toast.error("incorrect PIN");
  };

  // Tagline inline edit
  const saveTaglineText = async (id: string) => {
    if (!editText.trim()) return;
    await supabase.from("taglines").update({ text: editText } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, text: editText } : t));
    setEditingId(null);
  };

  const updateTaglineCategory = async (id: string, category: string) => {
    await supabase.from("taglines").update({ category } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, category } : t));
  };

  const updateTaglineWeight = async (id: string, weight: number) => {
    await supabase.from("taglines").update({ weight } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, weight } : t));
  };

  const toggleTaglineActive = async (id: string, active: boolean) => {
    await supabase.from("taglines").update({ active: !active } as any).eq("id", id);
    setTaglines(prev => prev.map(t => t.id === id ? { ...t, active: !active } : t));
  };

  const deleteTagline = async (id: string) => {
    await supabase.from("taglines").delete().eq("id", id);
    setTaglines(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
  };

  const addTagline = async () => {
    if (!newTagline.text.trim()) return;
    const { data } = await supabase.from("taglines").insert(newTagline as any).select().single();
    if (data) { setTaglines(prev => [...prev, data]); setNewTagline({ text: "", category: "general", weight: 5 }); }
  };

  // Picks
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

  const activeCount = taglines.filter(t => t.active).length;

  const inputStyle: React.CSSProperties = { background: "#080B12", border: "0.5px solid #1a2535", borderRadius: 6, color: "#F0EBE3" };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border-t border-border rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-sm font-medium text-foreground">PLAI Admin</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {!authed ? (
          <div className="p-6 text-center">
            <p className="text-xs text-muted-foreground mb-3">enter admin PIN</p>
            <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" className="bg-background border-border text-center tracking-[0.3em] w-24 mx-auto mb-3" />
            <button onClick={handlePinSubmit} disabled={pin.length !== 4} className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">enter</button>
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
              <div>
                {taglinesError ? (
                  <p className="text-xs text-muted-foreground text-center py-8">taglines table not found — run the SQL migration first</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">{taglines.length} taglines · {activeCount} active</p>

                    {/* Add row */}
                    <div className="flex gap-2 mb-4 items-center">
                      <input
                        value={newTagline.text}
                        onChange={(e) => setNewTagline(p => ({ ...p, text: e.target.value }))}
                        placeholder="new tagline..."
                        className="flex-1 px-3 py-1.5 text-xs"
                        style={inputStyle}
                      />
                      <select value={newTagline.category} onChange={(e) => setNewTagline(p => ({ ...p, category: e.target.value }))} className="px-2 py-1.5 text-[10px]" style={inputStyle}>
                        <option value="general">general</option>
                        <option value="landing">landing</option>
                        <option value="settings">settings</option>
                      </select>
                      <input type="number" min={1} max={10} value={newTagline.weight} onChange={(e) => setNewTagline(p => ({ ...p, weight: Number(e.target.value) }))} className="w-12 px-2 py-1.5 text-xs text-center" style={inputStyle} />
                      <button onClick={addTagline} className="rounded-full bg-primary px-3 py-1.5 text-[10px] text-primary-foreground font-medium flex-shrink-0">Add</button>
                    </div>

                    {/* Table */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      {taglines.map((t, idx) => (
                        <div key={t.id} className="flex items-center gap-2 px-3" style={{ height: 40, background: idx % 2 === 0 ? "#0F1520" : "#080B12" }}>
                          {/* Text - inline editable */}
                          {editingId === t.id ? (
                            <input
                              autoFocus
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={() => saveTaglineText(t.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveTaglineText(t.id); }}
                              className="flex-1 text-xs px-2 py-1"
                              style={inputStyle}
                            />
                          ) : (
                            <p
                              onClick={() => { setEditingId(t.id); setEditText(t.text); }}
                              className={`flex-1 text-xs min-w-0 truncate cursor-pointer ${t.active ? "" : "line-through"}`}
                              style={{ color: t.active ? "#F0EBE3" : "#4a6a8a" }}
                            >
                              {t.text}
                            </p>
                          )}

                          {/* Category */}
                          <select value={t.category} onChange={(e) => updateTaglineCategory(t.id, e.target.value)} className="px-1 py-0.5 text-[10px]" style={inputStyle}>
                            <option value="general">general</option>
                            <option value="landing">landing</option>
                            <option value="settings">settings</option>
                          </select>

                          {/* Weight */}
                          <input
                            type="number" min={1} max={10} value={t.weight}
                            onChange={(e) => updateTaglineWeight(t.id, Number(e.target.value))}
                            onBlur={(e) => updateTaglineWeight(t.id, Number(e.target.value))}
                            className="w-10 px-1 py-0.5 text-[10px] text-center"
                            style={inputStyle}
                          />

                          {/* Active toggle */}
                          <button
                            onClick={() => toggleTaglineActive(t.id, t.active)}
                            className="rounded-full w-8 h-4 relative flex-shrink-0"
                            style={{ background: t.active ? "#FF2D78" : "#2a3a4a" }}
                          >
                            <div className="absolute top-0.5 rounded-full w-3 h-3 bg-white transition-all" style={{ left: t.active ? 16 : 2 }} />
                          </button>

                          {/* Delete */}
                          {deleteConfirm === t.id ? (
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => deleteTagline(t.id)} className="text-[9px] text-red-400">yes</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-[9px] text-muted-foreground">no</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(t.id)} className="text-muted-foreground hover:text-red-400 flex-shrink-0">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
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