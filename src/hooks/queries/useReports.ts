import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requireSupabaseClient } from '../../services/supabaseClient';
import type { ReportRecord } from '../../types';

export const useReports = (enabled = true) => {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async (): Promise<ReportRecord[]> => {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};

export const useAddReport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reportData: Partial<ReportRecord>) => {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
