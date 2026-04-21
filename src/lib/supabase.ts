import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * @deprecated Use supabase.auth.getUser() instead of FIXED_USER_ID.
 * This is kept for backward compatibility during the transition to real Auth.
 */
export const FIXED_USER_ID = '00000000-0000-0000-0000-000000000001';
