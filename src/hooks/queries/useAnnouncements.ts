import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requireSupabaseClient } from '../../services/supabaseClient';
import type { Announcement } from '../../types';

export const useAnnouncements = (enabled = true) => {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async (): Promise<Announcement[]> => {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('announcements')
        .select('*, author:user_profiles(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};

export const useAddAnnouncement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (announcementData: Partial<Announcement>) => {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('announcements')
        .insert(announcementData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
};

export const useUpdateAnnouncement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Announcement> & { id: number }) => {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
};

export const useDeleteAnnouncement = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const supabase = requireSupabaseClient();
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
};
