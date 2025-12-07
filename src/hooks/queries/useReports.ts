import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import type { ReportRecord } from '../../types';

export const useReports = (enabled = true) => {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async (): Promise<ReportRecord[]> => {
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
