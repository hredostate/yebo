import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  parent_phone_number_1: string | null;
  total_outstanding: number;
  oldest_due_date: string | null;
}

const FeeReminderBulkSend: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number; errors: number } | null>(null);
  const [filterAmount, setFilterAmount] = useState<number>(0);

  useEffect(() => {
    fetchStudentsWithOutstanding();
  }, []);

  const fetchStudentsWithOutstanding = async () => {
    setIsLoading(true);
    try {
      // Query students with unpaid invoices
      const { data, error } = await supabase
        .from('student_invoices')
        .select(`
          student_id,
          amount,
          amount_paid,
          due_date,
          status,
          students (
            id,
            first_name,
            last_name,
            parent_phone_number_1
          )
        `)
        .neq('status', 'Paid');

      if (error) throw error;

      // Aggregate outstanding amounts per student
      const studentMap = new Map<number, Student>();

      data?.forEach((invoice: any) => {
        const student = invoice.students;
        if (!student) return;

        const outstanding = (invoice.amount || 0) - (invoice.amount_paid || 0);
        
        if (studentMap.has(student.id)) {
          const existing = studentMap.get(student.id)!;
          existing.total_outstanding += outstanding;
          
          // Track oldest due date
          if (invoice.due_date) {
            if (!existing.oldest_due_date || invoice.due_date < existing.oldest_due_date) {
              existing.oldest_due_date = invoice.due_date;
            }
          }
        } else {
          studentMap.set(student.id, {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            parent_phone_number_1: student.parent_phone_number_1,
            total_outstanding: outstanding,
            oldest_due_date: invoice.due_date,
          });
        }
      });

      // Filter out students without phone numbers and convert to array
      const studentsArray = Array.from(studentMap.values())
        .filter(s => s.parent_phone_number_1 && s.parent_phone_number_1.trim() !== '')
        .sort((a, b) => b.total_outstanding - a.total_outstanding);

      setStudents(studentsArray);
    } catch (error) {
      console.error('Error fetching students with outstanding fees:', error);
      alert('Failed to load students with outstanding fees');
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
    return students.filter(s => s.total_outstanding >= filterAmount);
  };

  const handleSendReminders = async () => {
    if (selectedStudents.size === 0) {
      alert('Please select at least one student');
      return;
    }

    if (!window.confirm(`Send fee reminders to ${selectedStudents.size} parents via WhatsApp?`)) {
      return;
    }

    setIsSending(true);
    setProgress({ sent: 0, total: selectedStudents.size, errors: 0 });

    let sentCount = 0;
    let errorCount = 0;

    for (const studentId of selectedStudents) {
      const student = students.find(s => s.id === studentId);
      if (!student) continue;

      try {
        const studentName = `${student.first_name} ${student.last_name}`;
        const amountFormatted = `₦${student.total_outstanding.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        let dueDateText = '';
        if (student.oldest_due_date) {
          const dueDate = new Date(student.oldest_due_date);
          dueDateText = dueDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        const message = `💰 *Fee Payment Reminder* 💰\n\n` +
          `Dear Parent,\n\n` +
          `This is a friendly reminder that there is an outstanding balance for *${studentName}*.\n\n` +
          `*Amount Due:* ${amountFormatted}\n` +
          (dueDateText ? `*Due Date:* ${dueDateText}\n` : '') +
          `\n` +
          `Please make payment at your earliest convenience to avoid any disruption to your child's education.\n\n` +
          `You can make payments via:\n` +
          `• Bank transfer\n` +
          `• Online payment portal\n` +
          `• At the school's finance office\n\n` +
          `If you have any questions or need payment arrangements, please contact the school's finance office.\n\n` +
          `Thank you for your cooperation.\n\n` +
          `Best regards,\n` +
          `School Finance Office`;

        const { error: sendError } = await supabase.functions.invoke('kudisms-send-whatsapp', {
          body: {
            school_id: schoolId,
            recipient: student.parent_phone_number_1,
            template_code: 'fee_reminder', // This should be configured in Kudi SMS settings
            parameters: `${student.name},${outstandingBalance.toFixed(2)},${dueDate}`,
          }
        });

        if (sendError) {
          console.error(`Failed to send to ${student.parent_phone_number_1}:`, sendError);
          errorCount++;
        } else {
          sentCount++;
        }
      } catch (err) {
        console.error(`Error sending reminder for student ${studentId}:`, err);
        errorCount++;
      }

      setProgress({ sent: sentCount, total: selectedStudents.size, errors: errorCount });
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    setIsSending(false);
    alert(`Fee reminders sent!\n\nSuccessful: ${sentCount}\nFailed: ${errorCount}\nTotal: ${selectedStudents.size}`);
    
    // Clear selection after sending
    setSelectedStudents(new Set());
  };

  const filteredStudents = getFilteredStudents();
  const totalOutstanding = filteredStudents.reduce((sum, s) => sum + s.total_outstanding, 0);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Fee Reminder Bulk Send
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          Send fee payment reminders to parents via WhatsApp
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <div className="text-sm text-slate-600 dark:text-slate-400">Students with Outstanding</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {filteredStudents.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Outstanding</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            ₦{totalOutstanding.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
          <div className="text-sm text-slate-600 dark:text-slate-400">Selected</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {selectedStudents.size}
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Minimum Outstanding:
            </label>
            <input
              type="number"
              value={filterAmount}
              onChange={(e) => setFilterAmount(Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              placeholder="0"
            />
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
            >
              {selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <button
            onClick={handleSendReminders}
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
                📱 Send Reminders ({selectedStudents.size})
              </>
            )}
          </button>
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
                  style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

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
                  Parent Phone
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Outstanding Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Oldest Due Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No students with outstanding fees found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
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
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {student.parent_phone_number_1}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600 dark:text-red-400">
                      ₦{student.total_outstanding.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {student.oldest_due_date 
                        ? new Date(student.oldest_due_date).toLocaleDateString('en-NG')
                        : 'N/A'
                      }
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

export default FeeReminderBulkSend;
