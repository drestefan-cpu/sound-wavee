import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import UserCard from "@/components/UserCard";
import BottomNav from "@/components/BottomNav";
import PlaiLogo from "@/components/PlaiLogo";

const Discover = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async (q?: string) => {
    setLoading(true);
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
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, [user]);

  const handleSearch = (val: string) => {
    setQuery(val);
    loadUsers(val);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-feed px-4 py-3">
          <h1 className="font-display text-xl text-foreground">Discover</h1>
        </div>
      </header>

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

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <UserCard key={u.id} profile={u} showFollow />
            ))}
            {users.length === 0 && (
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
