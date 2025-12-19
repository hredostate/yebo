import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requireSupabaseClient } from '../../services/supabaseClient';
import type { Student } from '../../types';
import { fetchAllStudents } from '../../utils/studentPagination';

export const useStudents = (enabled = true) => {
  return useQuery({
    queryKey: ['students'],
    queryFn: async (): Promise<Student[]> => {
      // Use pagination to support schools with more than 1000 students
      return await fetchAllStudents();
    },
    enabled,
  });
};

export const useStudent = (studentId: number, enabled = true) => {
  return useQuery({
    queryKey: ['students', studentId],
    queryFn: async (): Promise<Student | null> => {
      const supabase = requireSupabaseClient();
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
