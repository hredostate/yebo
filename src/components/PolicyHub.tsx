import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { ShieldIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const LivingPolicyManager = lazy(() => import('./LivingPolicyManager'));
const PolicyQueryView = lazy(() => import('./PolicyQueryView'));
const PolicyStatementsManager = lazy(() => import('./PolicyStatementsManager'));

interface PolicyHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

type PolicySection = 'policies' | 'query' | 'statements';

const PolicyHub: React.FC<PolicyHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canManagePolicy = isAllPowerful || userPermissions.includes('manage-living-policy');
  const canQueryPolicy = isAllPowerful || userPermissions.includes('query-living-policy');

  // Determine initial section based on current view
  const getInitialSection = (): PolicySection => {
    if (currentView === VIEWS.LIVING_POLICY) return 'policies';
    if (currentView === VIEWS.POLICY_QUERY) return 'query';
    if (currentView === VIEWS.POLICY_STATEMENTS) return 'statements';
    // Default to first accessible section
    if (canManagePolicy) return 'policies';
    if (canQueryPolicy) return 'query';
    return 'policies';
  };

  const [activeSection, setActiveSection] = useState<PolicySection>(getInitialSection());

  const navSections = [
    { id: 'policies' as const, label: 'Policies', show: canManagePolicy },
    { id: 'query' as const, label: 'Query', show: canQueryPolicy },
    { id: 'statements' as const, label: 'Statements', show: canManagePolicy },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'policies':
        return (
          <Suspense fallback={<Spinner />}>
            <LivingPolicyManager userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'query':
        return (
          <Suspense fallback={<Spinner />}>
            <PolicyQueryView userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'statements':
        return (
          <Suspense fallback={<Spinner />}>
            <PolicyStatementsManager userProfile={userProfile} addToast={addToast} />
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
            <ShieldIcon className="w-8 h-8 text-indigo-600" />
            Policy Hub
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage policies, queries, and statements.</p>
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {navSections.filter(s => s.show).map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg ${
              activeSection === section.id
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
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

export default PolicyHub;
