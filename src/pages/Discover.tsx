import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import UserCard from "@/components/UserCard";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { demoUsers } from "@/lib/demoData";

const Discover = () => {
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const loadUsers = async (q?: string) => {
    setPageLoading(true);
    let request = supabase
      .from("profiles")
      .select("*")
      .neq("id", user?.id || "")
      .limit(30);

    if (q) {
      request = request.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }

    const { data } = await request;
    setUsers(data || []);
    setPageLoading(false);
  };

  useEffect(() => {
    if (user) loadUsers();
  }, [user]);

  const handleSearch = (val: string) => {
    setQuery(val);
    loadUsers(val);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  // Pad with demo users if fewer than 4 real users
  const needsPadding = users.length < 4 && !query;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Discover" />

      <main className="mx-auto max-w-feed px-4 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="search users..."
            className="bg-card border-border pl-10"
          />
        </div>

        {pageLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <UserCard key={u.id} profile={u} showFollow />
            ))}
            {needsPadding && demoUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 relative">
                <span className="absolute top-2 right-2 rounded-full bg-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-primary">
                  example
                </span>
                <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/20">
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                    {u.display_name[0].toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username} · {u.genre} · {u.follower_count} followers</p>
                </div>
              </div>
            ))}
            {users.length === 0 && !needsPadding && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                no users found
              </p>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Discover;
