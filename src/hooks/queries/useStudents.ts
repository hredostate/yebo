import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabaseClient';
import type { Student } from '../../types';

export const useStudents = (enabled = true) => {
  return useQuery({
    queryKey: ['students'],
    queryFn: async (): Promise<Student[]> => {
      const { data, error } = await supabase
        .from('students')
        .select('*, class:classes(name), arm:arms(name)')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};

export const useStudent = (studentId: number, enabled = true) => {
  return useQuery({
    queryKey: ['students', studentId],
    queryFn: async (): Promise<Student | null> => {
      const { data, error } = await supabase
        .from('students')
        .select('*, class:classes(name), arm:arms(name)')
        .eq('id', studentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: enabled && studentId != null && studentId > 0,
  });
};
