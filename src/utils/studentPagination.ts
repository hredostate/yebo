import { supabase } from '../services/supabaseClient';
import type { Student } from '../types';

/**
 * Default page size for pagination when fetching students.
 * Supabase has a default limit of 1000 rows, so we use this as our batch size.
 */
const DEFAULT_PAGE_SIZE = 1000;

/**
 * Fetches all students from the database using pagination to bypass Supabase's 1000 row limit.
 * This ensures schools with more than 1000 students can see all their students.
 * 
 * @param selectQuery - The select query string (default: '*, class:classes(name), arm:arms(name)')
 * @param orderBy - The column to order by (default: 'name')
 * @param pageSize - The number of records to fetch per batch (default: 1000)
 * @returns Promise<Student[]> - All students from the database
 * @throws {Error} Throws any errors from Supabase query execution
 */
export async function fetchAllStudents(
  selectQuery: string = '*, class:classes(name), arm:arms(name)',
  orderBy: string = 'name',
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<Student[]> {
  const allStudents: Student[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('students')
      .select(selectQuery)
      .order(orderBy)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allStudents.push(...data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allStudents;
}
