import React, { useState, lazy, Suspense } from 'react';
import type { UserProfile } from '../types';
import { BanknotesIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

// Lazy load sub-components
const HRPayrollModule = lazy(() => import('./HRPayrollModule'));
const StudentFinanceView = lazy(() => import('./StudentFinanceView'));
const StorefrontView = lazy(() => import('./StorefrontView'));
const StoreManager = lazy(() => import('./StoreManager'));

interface FinanceStoreHubProps {
  userProfile: UserProfile;
  userPermissions: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  currentView: string;
  canAccess: (action: 'view' | 'manage', resource: 'payroll' | 'finance' | 'fees' | 'staff_data' | 'admin_cms' | 'payroll_self' | 'results_publish', ownerId?: string) => boolean;
}

type FinanceSection = 'payroll' | 'fees' | 'store' | 'manager';

const FinanceStoreHub: React.FC<FinanceStoreHubProps> = ({
  userProfile,
  userPermissions,
  addToast,
  onNavigate,
  currentView,
  canAccess
}) => {
  const isAllPowerful = userPermissions.includes('*');
  const canViewPayroll = canAccess('view', 'payroll') || canAccess('view', 'payroll_self', userProfile.id);
  const canManageFinance = isAllPowerful || userPermissions.includes('manage-finance');
  const canManageOrders = isAllPowerful || userPermissions.includes('manage-orders');

  // Determine initial section based on current view
  const getInitialSection = (): FinanceSection => {
    if (currentView === VIEWS.HR_PAYROLL) return 'payroll';
    if (currentView === VIEWS.STUDENT_FINANCE) return 'fees';
    if (currentView === VIEWS.STOREFRONT) return 'store';
    if (currentView === VIEWS.STORE_MANAGER) return 'manager';
    // Default to first accessible section
    if (canViewPayroll) return 'payroll';
    if (canManageFinance) return 'fees';
    return 'payroll';
  };

  const [activeSection, setActiveSection] = useState<FinanceSection>(getInitialSection());

  const navSections = [
    { id: 'payroll' as const, label: 'Payroll', show: canViewPayroll },
    { id: 'fees' as const, label: 'Fees', show: canManageFinance },
    { id: 'store' as const, label: 'Store', show: true }, // Everyone can view store
    { id: 'manager' as const, label: 'Manager', show: canManageOrders },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'payroll':
        return (
          <Suspense fallback={<Spinner />}>
            <HRPayrollModule 
              userProfile={userProfile} 
              addToast={addToast}
              userPermissions={userPermissions}
              canAccess={canAccess}
              // Note: HRPayrollModule expects many more props, but we'll handle this in AppRouter
              // This is a placeholder to match the pattern
              users={[]}
              payrollRuns={[]}
              payrollItems={[]}
              payrollAdjustments={[]}
              payrollComponents={[]}
              payrollLineItems={[]}
              pensionContributions={[]}
              schoolConfig={null}
              onRunPayroll={async () => {}}
              onUpdateUserPayroll={async () => {}}
              onSaveSchoolConfig={async () => false}
              campuses={[]}
              teacherShifts={[]}
              onSaveShift={async () => false}
              onDeleteShift={async () => false}
              leaveTypes={[]}
              onSaveLeaveType={async () => false}
              onDeleteLeaveType={async () => false}
              onSaveCampus={async () => false}
              onDeleteCampus={async () => false}
              leaveRequests={[]}
              onSubmitLeaveRequest={async () => false}
              onApproveLeaveRequest={async () => false}
              teams={[]}
            />
          </Suspense>
        );
      case 'fees':
        return (
          <Suspense fallback={<Spinner />}>
            <StudentFinanceView userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'store':
        return (
          <Suspense fallback={<Spinner />}>
            <StorefrontView userProfile={userProfile} addToast={addToast} />
          </Suspense>
        );
      case 'manager':
        return (
          <Suspense fallback={<Spinner />}>
            <StoreManager userProfile={userProfile} addToast={addToast} />
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
            <BanknotesIcon className="w-8 h-8 text-green-600" />
            Finance & Store Hub
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Manage payroll, fees, and store operations.</p>
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
                ? 'bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
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

export default FinanceStoreHub;
