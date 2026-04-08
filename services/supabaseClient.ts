import { createClient } from '@supabase/supabase-js';

// Environment Variables (Vite), fallback to hardcoded for local dev
// Using optional chaining to prevent crash if import.meta.env is undefined
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://gyjzhngedpwgzrzuimzv.supabase.co';
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_KEY || 'sb_publishable_FrhqAj1JEzE3rC05A_SH0Q_wdmFjijZ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);