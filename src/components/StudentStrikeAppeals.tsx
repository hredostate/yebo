
import React, { useState, useEffect, useCallback } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { StudentProfile, StudentStrike, StrikeAppeal } from '../types';
import Spinner from './common/Spinner';
import { ShieldIcon, ArrowLeftIcon, PlusCircleIcon, ExclamationCircleIcon } from './common/icons';

interface StudentStrikeAppealsProps {
  studentProfile: StudentProfile;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
}

const StudentStrikeAppeals: React.FC<StudentStrikeAppealsProps> = ({ 
  studentProfile, 
  addToast, 
  onNavigate 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [strikes, setStrikes] = useState<StudentStrike[]>([]);
  const [selectedStrike, setSelectedStrike] = useState<StudentStrike | null>(null);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appealForm, setAppealForm] = useState({
    appeal_reason: '',
    supporting_details: ''
  });

  const fetchStrikes = useCallback(async () => {
    if (!studentProfile.student_record_id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('student_strikes')
        .select(`
          *,
          issuer:user_profiles!student_strikes_issued_by_fkey(name, email),
          appeal:strike_appeals(*)
        `)
        .eq('student_id', studentProfile.student_record_id)
        .eq('archived', false)
        .order('issued_date', { ascending: false });

      if (error) throw error;

      setStrikes(data || []);
    } catch (error: any) {
      console.error('Error fetching strikes:', error);
      addToast(`Error loading strikes: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [studentProfile, addToast]);

  useEffect(() => {
    fetchStrikes();
  }, [fetchStrikes]);

  const handleAppealClick = (strike: StudentStrike) => {
    setSelectedStrike(strike);
    setAppealForm({
      appeal_reason: '',
      supporting_details: ''
    });
    setShowAppealModal(true);
  };

  const handleSubmitAppeal = async () => {
    if (!selectedStrike || !studentProfile.student_record_id) return;

    if (!appealForm.appeal_reason.trim()) {
      addToast('Please provide a reason for your appeal', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from('strike_appeals')
        .insert({
          strike_id: selectedStrike.id,
          student_id: studentProfile.student_record_id,
          appeal_reason: appealForm.appeal_reason,
          supporting_details: appealForm.supporting_details || null,
          status: 'Pending'
        });

      if (error) throw error;

      addToast('Appeal submitted successfully!', 'success');
      setShowAppealModal(false);
      setSelectedStrike(null);
      await fetchStrikes(); // Refresh strikes

    } catch (error: any) {
      console.error('Error submitting appeal:', error);
      addToast(`Error submitting appeal: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Severe': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
      case 'Major': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
      default: return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
    }
  };

  const getAppealStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'Rejected': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'Under Review': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
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
    <div className="space-y-6 p-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('Student Dashboard')}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Strikes & Appeals</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">View your disciplinary records and submit appeals</p>
        </div>
      </div>

      {/* Strikes List */}
      {strikes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-12 border border-slate-200 dark:border-slate-700 text-center">
          <ShieldIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Active Strikes</h2>
          <p className="text-slate-600 dark:text-slate-400">
            You currently have no disciplinary strikes. Keep up the good behavior!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {strikes.map((strike) => (
            <div 
              key={strike.id}
              className={`bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-l-4 ${getSeverityColor(strike.severity)}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  {/* Strike Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(strike.severity)}`}>
                      {strike.severity} Severity
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Issued on {new Date(strike.issued_date).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Strike Details */}
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {strike.reason}
                  </h3>
                  {strike.notes && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {strike.notes}
                    </p>
                  )}
                  
                  {/* Issuer Info */}
                  {strike.issuer && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Issued by: <span className="font-medium">{strike.issuer.name}</span>
                    </p>
                  )}

                  {/* Appeal Status */}
                  {strike.appeal && strike.appeal.length > 0 ? (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Appeal Submitted</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAppealStatusColor(strike.appeal[0].status)}`}>
                          {strike.appeal[0].status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        <span className="font-medium">Reason:</span> {strike.appeal[0].appeal_reason}
                      </p>
                      {strike.appeal[0].supporting_details && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          <span className="font-medium">Details:</span> {strike.appeal[0].supporting_details}
                        </p>
                      )}
                      {strike.appeal[0].review_notes && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium">Review Notes:</span> {strike.appeal[0].review_notes}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Submitted on {new Date(strike.appeal[0].created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAppealClick(strike)}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <PlusCircleIcon className="h-4 w-4" />
                      Submit Appeal
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Appeal Modal */}
      {showAppealModal && selectedStrike && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Submit Appeal</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Appeal for strike: {selectedStrike.reason}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <ExclamationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Appeal Guidelines:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Be respectful and honest in your appeal</li>
                      <li>Provide clear reasons and any supporting evidence</li>
                      <li>Appeals will be reviewed by school administration</li>
                      <li>You will be notified of the decision via this portal</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Appeal Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={appealForm.appeal_reason}
                  onChange={(e) => setAppealForm({ ...appealForm, appeal_reason: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Explain why you believe this strike should be reconsidered..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Supporting Details (Optional)
                </label>
                <textarea
                  value={appealForm.supporting_details}
                  onChange={(e) => setAppealForm({ ...appealForm, supporting_details: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Provide any additional context, evidence, or supporting information..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAppealModal(false);
                  setSelectedStrike(null);
                }}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAppeal}
                disabled={isSubmitting || !appealForm.appeal_reason.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    Submitting...
                  </>
                ) : (
                  'Submit Appeal'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentStrikeAppeals;
