import React, { useState, useEffect } from 'react';
import type { Student, CreatedCredential } from '../types';
import Spinner from './common/Spinner';
import SearchableSelect from './common/SearchableSelect';

interface CreateStudentAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAccount: (studentId: number) => Promise<CreatedCredential | null>;
  students: Student[];
}

const CreateStudentAccountModal: React.FC<CreateStudentAccountModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateAccount, 
  students 
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCredential, setCreatedCredential] = useState<CreatedCredential | null>(null);

  // Filter students who don't already have an account
  const studentsWithoutAccount = students.filter(s => !s.user_id);

  useEffect(() => {
    if (isOpen) {
      setSelectedStudentId(null);
      setError(null);
      setCreatedCredential(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError('Please select a student.');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      const credential = await onCreateAccount(selectedStudentId);
      if (credential) {
        setCreatedCredential(credential);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedCredential(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Create Student Account</h2>
          <button 
            onClick={handleClose} 
            className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-3xl font-light"
          >
            &times;
          </button>
        </div>

        {createdCredential ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">Account Created Successfully!</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Email: </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-white">{createdCredential.email}</span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Password: </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-white">{createdCredential.password}</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
                Please provide these credentials to the student. They should change their password after first login.
              </p>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={handleClose} 
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {studentsWithoutAccount.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  All students already have accounts, or no students are available.
                </p>
                <button 
                  onClick={handleClose} 
                  className="mt-4 px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="student" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Select Student
                  </label>
                  <SearchableSelect
                    options={studentsWithoutAccount.map(s => ({ 
                      value: s.id, 
                      label: `${s.name}${s.admission_number ? ` (${s.admission_number})` : ''}` 
                    }))}
                    value={selectedStudentId}
                    onChange={value => setSelectedStudentId(value as number)}
                    placeholder="Search for a student..."
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Only showing students without existing accounts
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button 
                    type="button" 
                    onClick={handleClose} 
                    className="px-4 py-2 bg-slate-500/20 text-slate-800 dark:text-white font-semibold rounded-lg hover:bg-slate-500/30"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || !selectedStudentId} 
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting && <Spinner size="sm" />}
                    <span className={isSubmitting ? 'ml-2' : ''}>Create Account</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreateStudentAccountModal;
