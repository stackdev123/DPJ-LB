import { createClient } from '@supabase/supabase-js';

// Initialize the second database connection
// Ganti fallback URL & KEY dengan kredensial database kedua yang sebenarnya
const SECONDARY_SUPABASE_URL = (import.meta as any).env?.VITE_SECOND_SUPABASE_URL || 'https://second-database-placeholder.supabase.co';
const SECONDARY_SUPABASE_KEY = (import.meta as any).env?.VITE_SECOND_SUPABASE_KEY || 'placeholder-key';

export const secondaryDb = createClient(SECONDARY_SUPABASE_URL, SECONDARY_SUPABASE_KEY);

// Fungsi sederhana untuk insert data tanpa read ("tidak menarik")
export const insertToSecondaryDb = async (tableName: string, data: any) => {
  try {
    // Hanya melakukan insert data (Write-only)
    const { error } = await secondaryDb.from(tableName).insert(data);
    if (error) {
      console.warn(`[Secondary DB] Gagal input ke ${tableName}:`, error.message);
    } else {
      console.log(`[Secondary DB] Berhasil input ke ${tableName}`);
    }
  } catch (error) {
    console.error(`[Secondary DB] Error:`, error);
  }
};
