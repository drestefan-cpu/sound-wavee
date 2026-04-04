import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://sylwprldxdgbsncwyhfk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHdwcmxkeGRnYnNuY3d5aGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzEzOTgsImV4cCI6MjA5MDkwNzM5OH0.bnb0MzVpArZnu4Hte3cDhsJzkxAAYyyGOBL7pFapDnE";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
