
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { requireSupabaseClient } from '../../services/supabaseClient';
import type { Student } from '../../types';
import Spinner from '../common/Spinner';
import { 
  DownloadIcon, 
  SearchIcon, 
  FilterIcon,
  BookOpenIcon,
  UsersIcon
} from '../common/icons';

interface StudentSubjectChoice {
  student_id: number;
  student_name: string;
  admission_number?: string;
  class_name?: string;
  arm_name?: string;
  subjects: {
    compulsory: string[];
    elective: string[];
  };
  date_selected?: string;
}

interface StudentSubjectChoicesViewProps {
  schoolId: number;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StudentSubjectChoicesView: React.FC<StudentSubjectChoicesViewProps> = ({ 
  schoolId, 
  addToast 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [studentChoices, setStudentChoices] = useState<StudentSubjectChoice[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [arms, setArms] = useState<{ id: number; name: string }[]>([]);
  const [allSubjects, setAllSubjects] = useState<{ id: number; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<number | 'all'>('all');
  const [filterArm, setFilterArm] = useState<number | 'all'>('all');
  const [filterSubject, setFilterSubject] = useState<number | 'all'>('all');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = requireSupabaseClient();

      // Fetch classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name');

      // Fetch arms
      const { data: armsData } = await supabase
        .from('arms')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name');

      // Fetch all subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name');

      // Fetch students with their subject choices
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          admission_number,
          class_id,
          arm_id,
          class:classes(id, name),
          arm:arms(id, name)
        `)
        .eq('school_id', schoolId)
        .order('name');

      if (studentsError) throw studentsError;

      // Fetch subject choices for all students
      const studentIds = studentsData?.map(s => s.id) || [];
      const { data: choicesData, error: choicesError } = await supabase
        .from('student_subject_choices')
        .select(`
          student_id,
          subject_id,
          created_at,
          subjects(id, name)
        `)
        .in('student_id', studentIds);

      if (choicesError) throw choicesError;

      // Fetch class subjects to determine which are compulsory
      const { data: classSubjectsData } = await supabase
        .from('class_subjects')
        .select('subject_id, class_id, is_compulsory')
        .eq('school_id', schoolId);

      // Build student choices map
      const choicesMap = new Map<number, StudentSubjectChoice>();
      
      studentsData?.forEach(student => {
        const studentClassId = student.class_id;
        const studentChoicesRecords = choicesData?.filter(c => c.student_id === student.id) || [];
        
        // Get compulsory subjects for this student's class
        const compulsorySubjectIds = classSubjectsData
          ?.filter(cs => cs.class_id === studentClassId && cs.is_compulsory)
          .map(cs => cs.subject_id) || [];

        const compulsorySubjects: string[] = [];
        const electiveSubjects: string[] = [];

        studentChoicesRecords.forEach(choice => {
          const subjectName = choice.subjects?.name || 'Unknown';
          if (compulsorySubjectIds.includes(choice.subject_id)) {
            compulsorySubjects.push(subjectName);
          } else {
            electiveSubjects.push(subjectName);
          }
        });

        choicesMap.set(student.id, {
          student_id: student.id,
          student_name: student.name,
          admission_number: student.admission_number,
          class_name: student.class?.name,
          arm_name: student.arm?.name,
          subjects: {
            compulsory: compulsorySubjects.sort(),
            elective: electiveSubjects.sort()
          },
          date_selected: studentChoicesRecords[0]?.created_at
        });
      });

      setClasses(classesData || []);
      setArms(armsData || []);
      setAllSubjects(subjectsData || []);
      setStudentChoices(Array.from(choicesMap.values()));

    } catch (error: any) {
      console.error('Error fetching subject choices:', error);
      addToast(`Error loading data: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and search
  const filteredChoices = useMemo(() => {
    return studentChoices.filter(choice => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = choice.student_name.toLowerCase().includes(searchLower);
        const matchesAdmission = choice.admission_number?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesAdmission) return false;
      }

      // Class filter
      if (filterClass !== 'all') {
        const student = studentChoices.find(s => s.student_id === choice.student_id);
        // We'd need to match based on class name, but we don't have class_id here
        // For simplicity, filter by class name
        const matchesClass = choice.class_name === classes.find(c => c.id === filterClass)?.name;
        if (!matchesClass) return false;
      }

      // Arm filter
      if (filterArm !== 'all') {
        const matchesArm = choice.arm_name === arms.find(a => a.id === filterArm)?.name;
        if (!matchesArm) return false;
      }

      // Subject filter
      if (filterSubject !== 'all') {
        const subjectName = allSubjects.find(s => s.id === filterSubject)?.name;
        const hasSubject = subjectName && (
          choice.subjects.compulsory.includes(subjectName) ||
          choice.subjects.elective.includes(subjectName)
        );
        if (!hasSubject) return false;
      }

      return true;
    });
  }, [studentChoices, searchTerm, filterClass, filterArm, filterSubject, classes, arms, allSubjects]);

  const exportToCSV = () => {
    try {
      const headers = ['Student Name', 'Admission Number', 'Class', 'Arm', 'Compulsory Subjects', 'Elective Subjects', 'Date Selected'];
      const rows = filteredChoices.map(choice => [
        choice.student_name,
        choice.admission_number || '',
        choice.class_name || '',
        choice.arm_name || '',
        choice.subjects.compulsory.join('; '),
        choice.subjects.elective.join('; '),
        choice.date_selected ? new Date(choice.date_selected).toLocaleDateString() : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `student_subject_choices_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('CSV exported successfully!', 'success');
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      addToast('Error exporting CSV', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <BookOpenIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Student Subject Choices
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">View and export student subject selections</p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors flex items-center gap-2"
        >
          <DownloadIcon className="h-5 w-5" />
          Export to CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm">Total Students</p>
              <p className="text-3xl font-bold mt-1">{studentChoices.length}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm">Filtered Results</p>
              <p className="text-3xl font-bold mt-1">{filteredChoices.length}</p>
            </div>
            <FilterIcon className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm">Total Subjects</p>
              <p className="text-3xl font-bold mt-1">{allSubjects.length}</p>
            </div>
            <BookOpenIcon className="w-8 h-8 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Search</label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Student name or ID..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Class</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Arm Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Arm</label>
            <select
              value={filterArm}
              onChange={(e) => setFilterArm(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Arms</option>
              {arms.map(arm => (
                <option key={arm.id} value={arm.id}>{arm.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Subject</label>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Subjects</option>
              {allSubjects.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Compulsory Subjects</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Elective Subjects</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Date Selected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredChoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    No student subject choices found
                  </td>
                </tr>
              ) : (
                filteredChoices.map((choice) => (
                  <tr key={choice.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{choice.student_name}</div>
                        {choice.admission_number && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{choice.admission_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        {choice.class_name || 'N/A'}
                        {choice.arm_name && <span className="text-slate-500 dark:text-slate-400"> - {choice.arm_name}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {choice.subjects.compulsory.length > 0 ? (
                          choice.subjects.compulsory.map((subject, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs rounded-full border border-blue-300 dark:border-blue-700"
                            >
                              {subject}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {choice.subjects.elective.length > 0 ? (
                          choice.subjects.elective.map((subject, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-xs rounded-full border border-purple-300 dark:border-purple-700"
                            >
                              {subject}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {choice.date_selected ? new Date(choice.date_selected).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentSubjectChoicesView;
