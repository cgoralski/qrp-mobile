/**
 * Supabase browser client — cloud DB / Edge only.
 * Import from here in Map, Contacts, Settings (or other cloud features), not from radio/KV4P code.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = "https://oonaetktfrwnfppgpccj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbmFldGt0ZnJ3bmZwcGdwY2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzODEzNTAsImV4cCI6MjA4Njk1NzM1MH0.0RDUipcs6slSfNCyFw358-yKLhEp21WotJ8VwsavRxY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
