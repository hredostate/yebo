import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import { sendNotificationWithChannel } from '../services/kudiSmsService';
import Spinner from './common/Spinner';

interface StudentWithAuth {
  id: number;
  name: string;
  email: string | null;
  class_name: string | null;
  parent_phone_number_1: string | null;
  parent_phone_number_2: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  user_id: string | null;
  school_id: number;
}

interface SendResult {
  studentId: number;
  studentName: string;
  username: string;
  success: boolean;
  phonesSent: string[];
  phonesFailed: string[];
  error?: string;
}

const StudentCredentialsBulkSend: React.FC = () => {
  const [students, setStudents] = useState<StudentWithAuth[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number; errors: number } | null>(null);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchStudentsWithAuth();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const supabase = requireSupabaseClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('school_id')
        .eq('id', user.user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('academic_classes')
        .select('id, name')
        .eq('school_id', profile.school_id)
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchStudentsWithAuth = async () => {
    setIsLoading(true);
    try {
      const supabase = requireSupabaseClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error('Not authenticated');
      }

      // Get user's school_id
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('school_id')
        .eq('id', user.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Failed to get user profile');
      }

      setSchoolId(profile.school_id);

      // Query students with auth accounts
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          email,
          parent_phone_number_1,
          parent_phone_number_2,
          father_phone,
          mother_phone,
          user_id,
          school_id,
          academic_classes(name)
        `)
        .eq('school_id', profile.school_id)
        .not('user_id', 'is', null)
        .order('name');

      if (error) throw error;

      // Transform data to include class name
      const studentsWithClass = (data || []).map((student: any) => ({
        id: student.id,
        name: student.name,
        email: student.email,
        class_name: student.academic_classes?.name || null,
        parent_phone_number_1: student.parent_phone_number_1,
        parent_phone_number_2: student.parent_phone_number_2,
        father_phone: student.father_phone,
        mother_phone: student.mother_phone,
        user_id: student.user_id,
        school_id: student.school_id,
      }));

      setStudents(studentsWithClass);
    } catch (error) {
      console.error('Error fetching students with auth accounts:', error);
      alert('Failed to load students with auth accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    const filtered = getFilteredStudents();
    if (selectedStudents.size === filtered.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filtered.map(s => s.id)));
    }
  };

  const handleSelectStudent = (studentId: number) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const getFilteredStudents = () => {
    let filtered = students;

    // Filter by class
    if (classFilter !== 'all') {
      filtered = filtered.filter(s => s.class_name === classFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        (s.email && s.email.toLowerCase().includes(query))
      );
    }

    return filtered;
  };

  const getParentPhones = (student: StudentWithAuth): string[] => {
    const phones: string[] = [];
    
    // Use parent_phone_number_1 and parent_phone_number_2 if available
    if (student.parent_phone_number_1) phones.push(student.parent_phone_number_1);
    if (student.parent_phone_number_2) phones.push(student.parent_phone_number_2);
    
    // Fallback to father_phone and mother_phone if the above are not available
    if (phones.length === 0) {
      if (student.father_phone) phones.push(student.father_phone);
      if (student.mother_phone) phones.push(student.mother_phone);
    }
    
    return phones;
  };

  const handleSendCredentials = async () => {
    if (selectedStudents.size === 0) {
      alert('Please select at least one student');
      return;
    }

    if (!window.confirm(`Send login credentials to ${selectedStudents.size} parents via WhatsApp/SMS?`)) {
      return;
    }

    const supabase = requireSupabaseClient();
    setIsSending(true);
    setProgress({ sent: 0, total: selectedStudents.size, errors: 0 });
    setSendResults([]);
    setShowResults(false);

    let sentCount = 0;
    let errorCount = 0;
    const results: SendResult[] = [];

    for (const studentId of selectedStudents) {
      const student = students.find(s => s.id === studentId);
      if (!student || !student.user_id || !schoolId) continue;

      try {
        // Get password from auth user metadata via edge function
        const { data: passwordData, error: passwordError } = await supabase.functions.invoke(
          'manage-users',
          {
            body: {
              action: 'get_password',
              user_id: student.user_id,
            }
          }
        );

        if (passwordError || !passwordData?.password) {
          console.error(`Failed to get password for ${student.name}:`, passwordError);
          errorCount++;
          results.push({
            studentId: student.id,
            studentName: student.name,
            username: student.email || 'N/A',
            success: false,
            phonesSent: [],
            phonesFailed: [],
            error: 'Failed to retrieve password',
          });
          continue;
        }

        const password = passwordData.password;
        const username = student.email || '';
        const parentPhones = getParentPhones(student);

        if (parentPhones.length === 0) {
          console.log(`No parent phone numbers for student: ${student.name}`);
          results.push({
            studentId: student.id,
            studentName: student.name,
            username,
            success: false,
            phonesSent: [],
            phonesFailed: [],
            error: 'No parent phone numbers',
          });
          continue;
        }

        const phonesSent: string[] = [];
        const phonesFailed: string[] = [];

        // Send to each parent phone number
        for (const phone of parentPhones) {
          try {
            const result = await sendNotificationWithChannel(
              'student_credentials',
              {
                schoolId: schoolId,
                recipientPhone: phone,
                templateName: 'student_credentials',
                variables: {
                  student_name: student.name,
                  username: username,
                  password: password,
                  school_name: 'UPSS', // Will be replaced by template system
                },
                studentId: student.id,
              }
            );

            if (result.success) {
              phonesSent.push(phone);
            } else {
              phonesFailed.push(phone);
            }

            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 120));
          } catch (err) {
            console.error(`Error sending to ${phone}:`, err);
            phonesFailed.push(phone);
          }
        }

        const success = phonesSent.length > 0;
        if (success) {
          sentCount++;
        } else {
          errorCount++;
        }

        results.push({
          studentId: student.id,
          studentName: student.name,
          username,
          success,
          phonesSent,
          phonesFailed,
        });

      } catch (err) {
        console.error(`Error processing student ${studentId}:`, err);
        errorCount++;
        results.push({
          studentId: student.id,
          studentName: student.name,
          username: student.email || 'N/A',
          success: false,
          phonesSent: [],
          phonesFailed: [],
          error: 'Processing error',
        });
      }

      setProgress({ sent: sentCount, total: selectedStudents.size, errors: errorCount });
    }

    setIsSending(false);
    setSendResults(results);
    setShowResults(true);
    alert(`Credentials sent!\n\nSuccessful: ${sentCount}\nFailed: ${errorCount}\nTotal: ${selectedStudents.size}`);
    
    // Clear selection after sending
    setSelectedStudents(new Set());
  };

  const exportResultsToCSV = () => {
    if (sendResults.length === 0) return;

    const headers = ['Student Name', 'Username', 'Status', 'Phones Sent', 'Phones Failed', 'Error'];
    const rows = sendResults.map(r => [
      r.studentName,
      r.username,
      r.success ? 'Success' : 'Failed',
      r.phonesSent.join('; '),
      r.phonesFailed.join('; '),
      r.error || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-credentials-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredStudents = getFilteredStudents();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Bulk Send Student Credentials
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          Send student login credentials to parents via WhatsApp/SMS
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <div className="text-sm text-slate-600 dark:text-slate-400">Students with Accounts</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {filteredStudents.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <div className="text-sm text-slate-600 dark:text-slate-400">Selected</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {selectedStudents.size}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <div className="text-sm text-slate-600 dark:text-slate-400">Without Phone Numbers</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {filteredStudents.filter(s => getParentPhones(s).length === 0).length}
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Class Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Class:
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">All Classes</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.name}>{cls.name}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Search:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Student name or email..."
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
            >
              {selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="flex gap-2">
            {showResults && sendResults.length > 0 && (
              <button
                onClick={exportResultsToCSV}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                📥 Export Results
              </button>
            )}
            <button
              onClick={handleSendCredentials}
              disabled={isSending || selectedStudents.size === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 font-medium flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <Spinner size="sm" />
                  Sending...
                </>
              ) : (
                <>
                  📱 Send Credentials ({selectedStudents.size})
                </>
              )}
            </button>
          </div>
        </div>

        {progress && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium">Sending Progress:</p>
              <p className="mt-1">Sent: {progress.sent} / {progress.total}</p>
              {progress.errors > 0 && (
                <p className="text-red-600 dark:text-red-400">Errors: {progress.errors}</p>
              )}
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((progress.sent + progress.errors) / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {showResults && sendResults.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Send Results</h3>
          <div className="space-y-2">
            {sendResults.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-md ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {result.success ? '✓' : '✗'} {result.studentName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Username: {result.username}
                    </p>
                    {result.phonesSent.length > 0 && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Sent to: {result.phonesSent.join(', ')}
                      </p>
                    )}
                    {result.phonesFailed.length > 0 && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Failed: {result.phonesFailed.join(', ')}
                      </p>
                    )}
                    {result.error && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Error: {result.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Students Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Username (Email)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Parent Phone Numbers
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No students with auth accounts found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const phones = getParentPhones(student);
                  return (
                    <tr 
                      key={student.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                        selectedStudents.has(student.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => handleSelectStudent(student.id)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        {student.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {student.class_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {student.email || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {phones.length > 0 ? phones.join(', ') : (
                          <span className="text-yellow-600 dark:text-yellow-400">No phone numbers</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentCredentialsBulkSend;
