
import { createClient } from '@supabase/supabase-js';

// Prioritize Environment Variables (Vercel), fallback to hardcoded for local dev
// Using optional chaining (?.) to prevent crashes if import.meta.env is undefined
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://tkzwehnbscbioujjfxom.supabase.co';
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_KEY || 'sb_publishable_stK_RPP-R2zuW2qfDRiIDw_DqfbOKxv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
