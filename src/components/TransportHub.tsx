import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { MapPinIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const TransportManager = lazy(() => import('./transport/TransportManager'));
const TransportGroupManager = lazy(() => import('./transport/TransportGroupManager'));
const TransportAttendanceView = lazy(() => import('./transport/TransportAttendanceView'));

interface TransportHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

type TransportSection = 'routes' | 'my_groups' | 'attendance';

const TransportHub: React.FC<TransportHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canManageRoutes = isAllPowerful || userPermissions.includes('transport.routes.manage');
  const canMarkAttendance = isAllPowerful || userPermissions.includes('transport.attendance.mark');

  // Determine initial section based on current view
  const getInitialSection = (): TransportSection => {
    if (currentView === VIEWS.TRANSPORT_MANAGER) return 'routes';
    if (currentView === VIEWS.TEACHER_TRANSPORT_GROUPS) return 'my_groups';
    if (currentView === VIEWS.TEACHER_TRANSPORT_ATTENDANCE) return 'attendance';
    // Default to first accessible section
    if (canManageRoutes) return 'routes';
    if (canMarkAttendance) return 'my_groups';
    return 'routes';
  };

  const [activeSection, setActiveSection] = useState<TransportSection>(getInitialSection());

  const navSections = [
    { id: 'routes' as const, label: 'Routes', show: canManageRoutes },
    { id: 'my_groups' as const, label: 'My Groups', show: canMarkAttendance },
    { id: 'attendance' as const, label: 'Attendance', show: canMarkAttendance },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'routes':
        return (
          <Suspense fallback={<Spinner />}>
            <TransportManager userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'my_groups':
        return (
          <Suspense fallback={<Spinner />}>
            <TransportGroupManager userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'attendance':
        return (
          <Suspense fallback={<Spinner />}>
            <TransportAttendanceView userProfile={userProfile} addToast={addToast} />
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
            <MapPinIcon className="w-8 h-8 text-amber-600" />
            Transport Hub
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage transport routes, groups, and attendance.</p>
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
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400'
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

export default TransportHub;
