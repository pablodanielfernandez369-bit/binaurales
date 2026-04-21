import { createClient } from '@supabase/supabase-js';

// SECURE SERVER-ONLY CLIENT
// This uses the Service Role Key to bypass RLS.
// ONLY to be used in API routes or Server Components.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceRoleKey) {
  console.warn('[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
