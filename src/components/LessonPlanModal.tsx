import React, { useState, useEffect } from 'react';
import type { LessonPlan, LessonPlanAnalysis, UserProfile, Team } from '../types';
import Spinner from './common/Spinner';
import { WandIcon } from './common/icons';

interface LessonPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: LessonPlan | null;
  onAnalyzeLessonPlan: (planId: number) => Promise<LessonPlanAnalysis | null>;
  onCopy: (plan: LessonPlan) => void;
  userProfile: UserProfile;
  teams: Team[];
  onApprove: (plan: LessonPlan) => Promise<void>;
  onSubmitForReview?: (plan: LessonPlan) => Promise<void>;
}

type Tab = 'Content' | 'AI Analysis';

const LessonPlanModal: React.FC<LessonPlanModalProps> = ({ isOpen, onClose, plan, onAnalyzeLessonPlan, onCopy, userProfile, teams, onApprove, onSubmitForReview }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Content');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<LessonPlanAnalysis | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  useEffect(() => {
    if (plan) {
      setAnalysis(plan.ai_analysis || null);
      setActiveTab('Content'); // Reset to content tab when a new plan is opened
    }
  }, [plan]);

  if (!isOpen || !plan) return null;
  
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await onAnalyzeLessonPlan(plan.id);
    if (result) {
      setAnalysis(result);
    }
    setIsAnalyzing(false);
  };

  const handleApprove = async () => {
      setIsApproving(true);
      await onApprove(plan);
      setIsApproving(false);
  }

  const handleSubmitForReview = async () => {
      if (!onSubmitForReview) return;
      setIsSubmitting(true);
      await onSubmitForReview(plan);
      setIsSubmitting(false);
      setShowSubmitConfirm(false);
      onClose();
  }

  const isAuthor = plan.author_id === userProfile.id;
  const myTeam = teams.find(team => team.lead_id === userProfile.id);
  const isTeamLeadOfAuthor = myTeam ? myTeam.members.some(m => m.user_id === plan.author_id) : false;
  const isAdmin = ['Admin', 'Principal'].includes(userProfile.role);

  const canCopy = isAuthor || isTeamLeadOfAuthor || isAdmin;
  const canApprove = isAdmin || isTeamLeadOfAuthor;


  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/80 w-full max-w-3xl m-4 flex flex-col max-h-[90vh]">
        <div className="flex-shrink-0">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Lesson Plan Details</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {plan.teaching_entity?.subject_name} - {plan.teaching_entity?.academic_class?.name} for week of {plan.week_start_date} by {plan.author?.name}
          </p>
           <div className="mt-4 border-b border-slate-200/60 dark:border-slate-800/60">
                <button onClick={() => setActiveTab('Content')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'Content' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>Content</button>
                <button onClick={() => setActiveTab('AI Analysis')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'AI Analysis' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>AI Analysis</button>
           </div>
        </div>

        <div className="flex-grow overflow-y-auto py-4 pr-2 space-y-4">
          {activeTab === 'Content' ? (
             <>
              {plan.file_url && (
                  <div className="mb-4">
                      <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Attached PDF</h3>
                      <div className="w-full h-[50vh] bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border">
                          <iframe
                              title="Lesson Plan PDF"
                              src={plan.file_url}
                              className="w-full h-full"
                              frameBorder="0"
                          />
                      </div>
                  </div>
              )}
              
              {plan.freeform_content ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-700 dark:text-slate-200">AI-Generated Lesson Plan</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center gap-1"><WandIcon className="w-3 h-3"/> AI Generated</span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-slate-500/5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                        <div dangerouslySetInnerHTML={{ __html: plan.freeform_content }} />
                    </div>
                  </div>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Learning Objectives</h3>
                    <p className="text-sm p-2 bg-slate-500/5 rounded mt-1">{plan.objectives || 'Not provided.'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Materials</h3>
                    <p className="text-sm p-2 bg-slate-500/5 rounded mt-1">{plan.materials || 'Not provided.'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Activities</h3>
                    <p className="text-sm p-2 bg-slate-500/5 rounded mt-1">{plan.activities || 'Not provided.'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Assessment Methods</h3>
                    <p className="text-sm p-2 bg-slate-500/5 rounded mt-1">{plan.assessment_methods || 'Not provided.'}</p>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {isAnalyzing ? (
                <div className="flex justify-center items-center h-40"><Spinner size="lg" /></div>
              ) : analysis ? (
                <>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 bg-slate-500/10 rounded-lg">
                      <p className="text-xs font-semibold uppercase text-slate-500">Clarity Score</p>
                      <p className="text-2xl font-bold">{analysis.clarity_score}/10</p>
                    </div>
                    <div className="p-2 bg-slate-500/10 rounded-lg">
                      <p className="text-xs font-semibold uppercase text-slate-500">Objectives Met</p>
                      <p className="text-2xl font-bold">{analysis.has_objectives ? '✅' : '❌'}</p>
                    </div>
                     <div className="p-2 bg-slate-500/10 rounded-lg">
                      <p className="text-xs font-semibold uppercase text-slate-500">Assessment Included</p>
                      <p className="text-2xl font-bold">{analysis.has_assessment ? '✅' : '❌'}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">Suggestions for Improvement</h3>
                    <ul className="list-disc list-inside text-sm mt-1 p-2 bg-slate-500/5 rounded">
                        {analysis.suggestions.map((s,i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 mb-4">No AI analysis has been run for this lesson plan.</p>
                  <button onClick={handleRunAnalysis} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    Analyze with AI
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center pt-4 flex-shrink-0">
            <div className="flex gap-2">
                {canCopy && (
                    <button onClick={() => onCopy(plan)} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700">Copy Plan</button>
                )}
                {isAuthor && plan.status === 'draft' && onSubmitForReview && (
                    <button 
                        onClick={() => setShowSubmitConfirm(true)} 
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 flex items-center min-w-[180px] justify-center"
                    >
                        {isSubmitting ? <Spinner size="sm"/> : 'Submit for Review'}
                    </button>
                )}
                {canApprove && (
                    <button onClick={handleApprove} disabled={isApproving} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 flex items-center min-w-[180px] justify-center">
                        {isApproving ? <Spinner size="sm"/> : 'Approve Plan'}
                    </button>
                )}
            </div>
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 ml-auto">Close</button>
        </div>

        {/* Submit for Review Confirmation Dialog */}
        {showSubmitConfirm && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl max-w-md m-4">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Submit for Review?</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Are you sure you want to submit this lesson plan for review? It will be sent to your team lead for approval.
                    </p>
                    <div className="flex gap-2 justify-end">
                        <button 
                            onClick={() => setShowSubmitConfirm(false)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmitForReview}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center min-w-[120px] justify-center"
                        >
                            {isSubmitting ? <Spinner size="sm"/> : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default LessonPlanModal;