import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_PROFILE_COLUMNS } from "@/lib/profileColumns";
import { Input } from "@/components/ui/input";
import UserCard from "@/components/UserCard";

/**
 * Discover → people.
 * With no search: suggestions from the suggest_people database function — people you don't follow
 * yet, ranked by songs and artists you both like and by friends you have in common.
 * With a search: matching usernames and display names.
 */

interface PersonRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  reason?: string | null;
}

/** Keep letters, numbers, spaces, dots, dashes and underscores (search text goes into a filter). */
const cleanQuery = (q: string) => q.replace(/[^\p{L}\p{N}._ -]/gu, "").trim().slice(0, 40);

const logSearchQuery = async (userId: string, query: string, resultsCount: number) => {
  try {
    await (supabase.from("search_queries" as any).insert({
      user_id: userId,
      query: query.trim(),
      results_count: resultsCount,
    }) as any);
  } catch {}
};

let suggestionsCache: PersonRow[] | null = null;

const PeopleSection = ({ userId }: { userId: string }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PersonRow[]>(suggestionsCache || []);
  const [results, setResults] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(!suggestionsCache);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;
    (supabase.rpc as any)("suggest_people", { p_limit: 25 }).then(({ data }: { data: PersonRow[] | null }) => {
      if (cancelled) return;
      suggestionsCache = data || [];
      setSuggestions(suggestionsCache);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const search = useCallback(
    async (raw: string) => {
      const q = cleanQuery(raw);
      if (!q) {
        setResults([]);
        setSearching(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .neq("id", userId)
        .not("username", "is", null)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(30);
      const rows = ((data || []) as unknown) as PersonRow[];
      setResults(rows);
      setSearching(false);
      logSearchQuery(userId, q, rows.length);
    },
    [userId],
  );

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(!!cleanQuery(val));
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const isSearch = !!cleanQuery(query);
  const list = isSearch ? results : suggestions;
  const busy = isSearch ? searching : loading;

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="search people..."
          className="bg-card border-border pl-10"
        />
      </div>

      {!isSearch && (
        <div className="mb-3">
          <h3 className="font-display text-lg text-foreground">people you might like</h3>
          <p className="text-xs text-muted-foreground">based on the songs and artists you both love, and friends in common</p>
        </div>
      )}

      {busy ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : list.length > 0 ? (
        <div className="space-y-2">
          {list.map((u) => (
            <UserCard key={u.id} profile={u} showFollow reason={isSearch ? null : u.reason} />
          ))}
        </div>
      ) : isSearch ? (
        <p className="py-12 text-center text-sm text-muted-foreground">no one found for "{cleanQuery(query)}"</p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <h4 className="text-sm font-medium text-foreground">You're following everyone so far</h4>
          <p className="mt-1 text-xs text-muted-foreground">Invite friends to PLAI and they'll show up here.</p>
        </div>
      )}
    </div>
  );
};

export default PeopleSection;
