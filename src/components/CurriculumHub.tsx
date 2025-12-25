import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { BookOpenIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const LessonPlannerView = lazy(() => import('./CurriculumPlannerView'));
const TeamLessonPlanHub = lazy(() => import('./TeamLessonPlanHub'));
const LearningMaterialsManager = lazy(() => import('./LearningMaterialsManager'));
const CurriculumManager = lazy(() => import('./CurriculumManager'));
const CoverageAnalyticsDashboard = lazy(() => import('./CoverageAnalyticsDashboard'));
const TeachingAssignmentsContainer = lazy(() => import('./TeachingAssignmentsContainer'));
const CoverageFeedbackReport = lazy(() => import('./CoverageFeedbackReport'));

interface CurriculumHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

type CurriculumSection = 'my_plans' | 'team_hub' | 'materials' | 'map' | 'analytics' | 'workload' | 'feedback';

const CurriculumHub: React.FC<CurriculumHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canViewMyPlans = isAllPowerful || userPermissions.includes('view-my-lesson-plans') || userPermissions.includes('manage-curriculum');
  const canManageCurriculum = isAllPowerful || userPermissions.includes('manage-curriculum');
  const canViewCurriculumReadonly = isAllPowerful || userPermissions.includes('view-curriculum-readonly') || userPermissions.includes('manage-curriculum');
  const canViewMyFeedback = isAllPowerful || userPermissions.includes('view-my-coverage-feedback') || userPermissions.includes('view-coverage-feedback');

  // Determine initial section based on current view
  const getInitialSection = (): CurriculumSection => {
    if (currentView === VIEWS.LESSON_PLANNER) return 'my_plans';
    if (currentView === VIEWS.TEAM_LESSON_HUB) return 'team_hub';
    if (currentView === VIEWS.LEARNING_MATERIALS) return 'materials';
    if (currentView === VIEWS.CURRICULUM_MANAGER) return 'map';
    if (currentView === VIEWS.COVERAGE_ANALYTICS) return 'analytics';
    if (currentView === VIEWS.TEACHING_ASSIGNMENTS) return 'workload';
    if (currentView === VIEWS.COVERAGE_FEEDBACK) return 'feedback';
    // Default to first accessible section
    if (canViewMyPlans) return 'my_plans';
    if (canManageCurriculum) return 'team_hub';
    return 'my_plans';
  };

  const [activeSection, setActiveSection] = useState<CurriculumSection>(getInitialSection());

  const navSections = [
    { id: 'my_plans' as const, label: 'My Plans', show: canViewMyPlans },
    { id: 'team_hub' as const, label: 'Team Hub', show: canManageCurriculum },
    { id: 'materials' as const, label: 'Materials', show: canViewMyPlans },
    { id: 'map' as const, label: 'Map', show: canViewCurriculumReadonly },
    { id: 'analytics' as const, label: 'Analytics', show: canManageCurriculum },
    { id: 'workload' as const, label: 'Workload', show: canManageCurriculum },
    { id: 'feedback' as const, label: 'Feedback', show: canViewMyFeedback },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'my_plans':
        return (
          <Suspense fallback={<Spinner />}>
            <LessonPlannerView userProfile={userProfile} addToast={addToast} onNavigate={onNavigate} />
          </Suspense>
        );
      case 'team_hub':
        return (
          <Suspense fallback={<Spinner />}>
            <TeamLessonPlanHub userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'materials':
        return (
          <Suspense fallback={<Spinner />}>
            <LearningMaterialsManager userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'map':
        return (
          <Suspense fallback={<Spinner />}>
            <CurriculumManager userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'analytics':
        return (
          <Suspense fallback={<Spinner />}>
            <CoverageAnalyticsDashboard userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'workload':
        return (
          <Suspense fallback={<Spinner />}>
            <TeachingAssignmentsContainer userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'feedback':
        return (
          <Suspense fallback={<Spinner />}>
            <CoverageFeedbackReport userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      default:
        return (
          <div className="text-center py-8 text-slate-500">
            <p>Section not found. Please select a valid option from the menu.</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <BookOpenIcon className="w-8 h-8 text-blue-600" />
            Curriculum Hub
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage lesson plans, curriculum, and coverage analytics.</p>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {navSections.filter(s => s.show).map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg whitespace-nowrap ${
              activeSection === section.id
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 shadow-xl min-h-[60vh]">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default CurriculumHub;
