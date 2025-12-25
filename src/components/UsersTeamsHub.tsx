import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { UsersIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const UserManagement = lazy(() => import('./UserManagement'));
const RoleManager = lazy(() => import('./RoleManager'));
const TeamHub = lazy(() => import('./TeamHub'));
const RoleDirectoryView = lazy(() => import('./RoleDirectoryView'));

interface UsersTeamsHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

type UsersTeamsSection = 'directory' | 'roles' | 'teams' | 'role_directory';

const UsersTeamsHub: React.FC<UsersTeamsHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canManageUsers = isAllPowerful || userPermissions.includes('manage-users');
  const canManageRoles = isAllPowerful || userPermissions.includes('manage-roles');
  const canManageTeams = isAllPowerful || userPermissions.includes('manage-teams');

  // Determine initial section based on current view
  const getInitialSection = (): UsersTeamsSection => {
    if (currentView === VIEWS.USER_MANAGEMENT) return 'directory';
    if (currentView === VIEWS.ROLE_MANAGEMENT) return 'roles';
    if (currentView === VIEWS.TEAM_HUB) return 'teams';
    if (currentView === VIEWS.ROLE_DIRECTORY) return 'role_directory';
    // Default to first accessible section
    if (canManageUsers) return 'directory';
    if (canManageRoles) return 'roles';
    if (canManageTeams) return 'teams';
    return 'directory';
  };

  const [activeSection, setActiveSection] = useState<UsersTeamsSection>(getInitialSection());

  const navSections = [
    { id: 'directory' as const, label: 'Directory', show: canManageUsers },
    { id: 'roles' as const, label: 'Roles', show: canManageRoles },
    { id: 'teams' as const, label: 'Teams', show: canManageTeams },
    { id: 'role_directory' as const, label: 'Role Directory', show: canManageRoles },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'directory':
        return (
          <Suspense fallback={<Spinner />}>
            <UserManagement userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'roles':
        return (
          <Suspense fallback={<Spinner />}>
            <RoleManager userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'teams':
        return (
          <Suspense fallback={<Spinner />}>
            <TeamHub userProfile={userProfile} addToast={addToast} onNavigate={onNavigate} />
          </Suspense>
        );
      case 'role_directory':
        return (
          <Suspense fallback={<Spinner />}>
            <RoleDirectoryView userProfile={userProfile} addToast={addToast} />
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
            <UsersIcon className="w-8 h-8 text-blue-600" />
            Users & Teams Hub
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage users, roles, and team structures.</p>
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

export default UsersTeamsHub;
