import { supabase } from './supabaseClient';
import { User } from '../types';

export const login = async (username: string, password: string): Promise<User | null> => {
  // 1. Emergency / Hardcoded Super Admin
  if (username === 'superadmin' && password === 'superadmin') {
      return {
          id: 'super-admin-root',
          username: 'superadmin',
          role: 'SUPER_ADMIN'
      };
  }

  // Fallback admin (legacy)
  if (username === 'admin' && password === 'admin') {
      return {
          id: 'emergency-admin-id',
          username: 'admin',
          role: 'ADMIN'
      };
  }

  // 2. Check Supabase
  try {
      const { data, error } = await supabase
          .from('avt_users')
          .select('*')
          .eq('username', username)
          .single();
      
      if (error || !data) return null;

      // Simple password check (In prod, use bcrypt)
      if (data.password === password) {
          return {
              id: data.id,
              username: data.username,
              role: data.role || 'ADMIN'
          };
      }
  } catch (err) {
      console.error("Auth Error:", err);
  }

  return null;
};

export const verifyPassword = async (username: string, password: string): Promise<boolean> => {
    // Check Hardcoded
    if (username === 'superadmin') return password === 'superadmin';
    if (username === 'admin') return password === 'admin';

    // Check Supabase
    try {
        const { data } = await supabase
          .from('avt_users')
          .select('password')
          .eq('username', username)
          .single();
        
        if (data && data.password === password) return true;
    } catch (e) {
        console.error("Verify Password Error:", e);
    }

    return false;
};