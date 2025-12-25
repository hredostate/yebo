import React, { useState } from 'react';
import type { UserProfile } from '../types';
import { MapPinIcon } from './common/icons';
import { VIEWS } from '../constants';

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
    { id: 'routes' as const, label: 'Routes', view: VIEWS.TRANSPORT_MANAGER, show: canManageRoutes },
    { id: 'my_groups' as const, label: 'My Groups', view: VIEWS.TEACHER_TRANSPORT_GROUPS, show: canMarkAttendance },
    { id: 'attendance' as const, label: 'Attendance', view: VIEWS.TEACHER_TRANSPORT_ATTENDANCE, show: canMarkAttendance },
  ];

  // Navigate to the selected view
  // Note: TransportHub uses a router pattern instead of inline rendering because
  // transport components require complex props (schoolId, currentTermId, etc.) that
  // aren't available at the hub level. This is an intentional design choice.
  const handleSectionClick = (view: string) => {
    onNavigate(view);
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
            onClick={() => handleSectionClick(section.view)}
            className={`px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg ${
              currentView === section.view
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Information Card */}
      <main className="flex-1 min-w-0">
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6 shadow-xl min-h-[60vh]">
          <div className="text-center py-12">
            <MapPinIcon className="w-16 h-16 mx-auto text-amber-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Transport Management</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Select a tab above to access different transport management features.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {navSections.filter(s => s.show).map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section.view)}
                  className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all hover:border-amber-500"
                >
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{section.label}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {section.id === 'routes' && 'Manage transport routes and stops'}
                    {section.id === 'my_groups' && 'View and manage your transport groups'}
                    {section.id === 'attendance' && 'Mark and track transport attendance'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TransportHub;
