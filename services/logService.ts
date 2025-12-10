import { supabase } from './supabaseClient';
import { User, ActivityLog } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const logActivity = async (
  user: User | null,
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'OTHER',
  entityType: string,
  details: string,
  entityId: string = '-'
) => {
  if (!user) return;

  const newLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      username: user.username || 'Unknown',
      role: user.role || 'Unknown',
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      details
  };

  try {
      await supabase.from('avt_activity_logs').insert(newLog);
  } catch (error) {
      console.error("Failed to log activity to Supabase:", error);
  }
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
  try {
      const { data, error } = await supabase
        .from('avt_activity_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) {
          console.error("Error fetching logs:", error);
          return [];
      }
      
      return data.map((log: any) => ({
          id: log.id,
          timestamp: log.timestamp,
          username: log.username,
          role: log.role,
          actionType: log.action_type,
          entityType: log.entity_type,
          entityId: log.entity_id,
          details: log.details
      }));
  } catch (error) {
      console.error("Log fetch error:", error);
      return [];
  }
};