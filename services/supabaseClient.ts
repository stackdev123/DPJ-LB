import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkzwehnbscbioujjfxom.supabase.co';
const SUPABASE_KEY = 'sb_publishable_stK_RPP-R2zuW2qfDRiIDw_DqfbOKxv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);