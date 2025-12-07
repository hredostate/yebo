import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import type { UserProfile } from '../../types';

export const useUsers = (enabled = true) => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<UserProfile[]> => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};

export const useUser = (userId: string, enabled = true) => {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: async (): Promise<UserProfile | null> => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: enabled && !!userId && userId.trim() !== '',
  });
};
