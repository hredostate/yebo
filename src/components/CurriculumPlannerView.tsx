









import React, { useState, useMemo } from 'react';
import type { LessonPlan, Team, UserProfile, LessonPlanAnalysis, AcademicTeachingAssignment, Curriculum, CurriculumWeek } from '../types';
import { SubmissionStatus, CoverageStatus } from '../types';
import LessonPlanModal from './LessonPlanModal';
// FIX: Changed to a default import for LessonPlanEditorModal as it is a default export.
import LessonPlanEditorModal from './LessonPlanEditorModal';
import FreeformLessonPlanEditorModal from './FreeformLessonPlanEditorModal';
import CopyLessonPlanModal from './CopyLessonPlanModal';

interface CurriculumPlannerViewProps {
  teams: Team[];
  lessonPlans: LessonPlan[];
  userProfile: UserProfile;
  onSaveLessonPlan: (plan: Partial<LessonPlan>, generateWithAi: boolean, file: File | null) => Promise<LessonPlan | null>;
  onAnalyzeLessonPlan: (planId: number) => Promise<LessonPlanAnalysis | null>;
  teachingAssignments: AcademicTeachingAssignment[];
  onCopyLessonPlan: (sourcePlan: LessonPlan, targetEntityIds: number[]) => Promise<boolean>;
  curricula: Curriculum[];
  curriculumWeeks: CurriculumWeek[];
  onApprove: (plan: LessonPlan) => Promise<void>;
  onSubmitForReview?: (plan: LessonPlan) => Promise<void>;
}

const getWeekStartDate = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const CurriculumPlannerView: React.FC<CurriculumPlannerViewProps> = ({ 
    teams, 
    lessonPlans, 
    userProfile, 
    onSaveLessonPlan, 
    onAnalyzeLessonPlan,
    teachingAssignments,
    onCopyLessonPlan,
    curricula,
    curriculumWeeks,
    onApprove,
    onSubmitForReview,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const userAssignments = useMemo(() => {
    if (['Admin', 'Principal'].includes(userProfile.role)) {
      return teachingAssignments;
    }
    if (userProfile.role === 'Team Lead') {
        const myTeam = teams.find(team => team.lead_id === userProfile.id);
        if (myTeam) {
            const memberIds = new Set(myTeam.members.map(m => m.user_id));
            memberIds.add(userProfile.id); // include lead's assignments
            return teachingAssignments.filter(a => memberIds.has(a.teacher_user_id));
        }
    }
    // Teacher
    return teachingAssignments.filter(a => a.teacher_user_id === userProfile.id);
  }, [teachingAssignments, userProfile, teams]);

  // Filter lesson plans based on user role (same logic as userAssignments)
  const userLessonPlans = useMemo(() => {
    if (['Admin', 'Principal'].includes(userProfile.role)) {
      return lessonPlans;
    }
    if (userProfile.role === 'Team Lead') {
      const myTeam = teams.find(team => team.lead_id === userProfile.id);
      if (myTeam) {
        const memberIds = new Set(myTeam.members.map(m => m.user_id));
        memberIds.add(userProfile.id);
        return lessonPlans.filter(p => memberIds.has(p.author_id));
      }
    }
    // Teacher - only see their own lesson plans
    return lessonPlans.filter(p => p.author_id === userProfile.id);
  }, [lessonPlans, userProfile, teams]);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(userAssignments.length > 0 ? userAssignments[0].id : null);
  
  // State for structured plan modals
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanEditorOpen, setIsPlanEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<LessonPlan> | null>(null);
  
  // State for freeform plan modal
  const [isFreeformEditorOpen, setIsFreeformEditorOpen] = useState(false);
  const [editingFreeformPlan, setEditingFreeformPlan] = useState<Partial<LessonPlan> | null>(null);
  
  // State for copy plan modal
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [planToCopy, setPlanToCopy] = useState<LessonPlan | null>(null);

  const weekStart = getWeekStartDate(currentDate);

  const plansForWeek = useMemo(() => {
    if (!selectedAssignmentId) return [];
    const weekStartTime = weekStart.getTime();
    return userLessonPlans.filter(lp => {
      if (!lp.week_start_date) return false;
      const planDate = new Date(lp.week_start_date + 'T00:00:00');
      return lp.teaching_entity_id === selectedAssignmentId && planDate.getTime() === weekStartTime;
    });
  }, [userLessonPlans, selectedAssignmentId, weekStart]);

  const handlePrevWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
  const handleNextWeek = () => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));

  const handleViewPlan = (plan: LessonPlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };
  
  const handleOpenStructuredEditor = (plan?: LessonPlan) => {
    setEditingPlan(plan || { 
        teaching_entity_id: selectedAssignmentId!,
        week_start_date: formatDate(weekStart),
        submission_status: SubmissionStatus.Pending,
        coverage_status: CoverageStatus.Pending,
        plan_type: 'structured',
    });
    setIsPlanEditorOpen(true);
  }
  
  const handleOpenFreeformEditor = (plan?: LessonPlan) => {
    setEditingFreeformPlan(plan || { 
        teaching_entity_id: selectedAssignmentId!,
        week_start_date: formatDate(weekStart),
        plan_type: 'freeform',
    });
    setIsFreeformEditorOpen(true);
  }

  const handleOpenCopyModal = (plan: LessonPlan) => {
    setPlanToCopy(plan);
    setIsCopyModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Curriculum Planner</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">Manage and analyze your weekly lesson plans for your teams.</p>
      </div>

      <div className="flex justify-between items-center p-4 rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40">
        <div>
          <label htmlFor="assignment-select" className="text-sm font-medium">Assignment:</label>
          <select 
            id="assignment-select" 
            value={selectedAssignmentId || ''} 
            onChange={e => setSelectedAssignmentId(Number(e.target.value))}
            className="ml-2 p-2 rounded-md bg-transparent border border-slate-300 dark:border-slate-700 max-w-xs"
          >
            {userAssignments.map(a => <option key={a.id} value={a.id}>
                {`${a.teacher?.name} - ${a.subject_name} - ${a.academic_class?.name}`}
            </option>)}
          </select>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={handlePrevWeek} className="px-3 py-1 bg-slate-500/20 rounded-lg hover:bg-slate-500/30">&lt; Prev</button>
            <span className="font-semibold">Week of {weekStart.toLocaleDateString()}</span>
            <button onClick={handleNextWeek} className="px-3 py-1 bg-slate-500/20 rounded-lg hover:bg-slate-500/30">Next &gt;</button>
        </div>
      </div>
      
       <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 min-h-[300px]">
        {selectedAssignmentId ? (
          plansForWeek.length > 0 ? (
            plansForWeek.map(plan => {
              const getStatusBadge = (status: string) => {
                const styles: Record<string, string> = {
                  draft: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
                  submitted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                  under_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                  revision_required: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                };
                return (
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles.draft}`}>
                    {status.replace('_', ' ').toUpperCase()}
                  </span>
                );
              };
              
              return (
                <div key={plan.id} className="p-4 bg-slate-500/10 rounded-lg mb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{plan.title || (plan.plan_type === 'freeform' ? 'Freeform Plan' : 'Structured Plan')}</h3>
                        {getStatusBadge(plan.status)}
                      </div>
                      <p className="text-sm text-slate-500">Last updated: {new Date(plan.updated_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleViewPlan(plan)} className="px-3 py-1 bg-blue-600 text-white rounded-md">View Details</button>
                      <button onClick={() => plan.plan_type === 'freeform' ? handleOpenFreeformEditor(plan) : handleOpenStructuredEditor(plan)} className="px-3 py-1 bg-slate-500/20 rounded-md">Edit</button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16">
              <p className="text-slate-500">No lesson plan submitted for this week.</p>
              <div className="mt-4 flex justify-center gap-4">
                <button onClick={() => handleOpenStructuredEditor()} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg">Create Structured Plan</button>
                <button onClick={() => handleOpenFreeformEditor()} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg">Create Blank Plan</button>
              </div>
            </div>
          )
        ) : (
          <p className="text-center py-16 text-slate-500">Select an assignment to view lesson plans.</p>
        )}
      </div>

      <LessonPlanModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        plan={selectedPlan}
        onAnalyzeLessonPlan={onAnalyzeLessonPlan}
        onCopy={handleOpenCopyModal}
        userProfile={userProfile}
        teams={teams}
        onApprove={onApprove}
        onSubmitForReview={onSubmitForReview}
      />
      
      {isPlanEditorOpen && <LessonPlanEditorModal 
        isOpen={isPlanEditorOpen}
        onClose={() => setIsPlanEditorOpen(false)}
        initialPlanData={editingPlan}
        onSave={(plan, generateWithAi, file) => onSaveLessonPlan(plan, generateWithAi, file)}
      />}

      <FreeformLessonPlanEditorModal
        isOpen={isFreeformEditorOpen}
        onClose={() => setIsFreeformEditorOpen(false)}
        initialPlanData={editingFreeformPlan}
        // FIX: The onSave prop of FreeformLessonPlanEditorModal had an incompatible signature.
        // The modal component itself is being fixed to handle a file, making this call valid.
        onSave={(plan, file) => onSaveLessonPlan(plan, false, file)}
      />

      <CopyLessonPlanModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        planToCopy={planToCopy}
        onCopy={onCopyLessonPlan}
        userProfile={userProfile}
        allTeachingAssignments={teachingAssignments}
        allLessonPlans={userLessonPlans}
        teams={teams}
      />
    </div>
  );
};

export default CurriculumPlannerView;