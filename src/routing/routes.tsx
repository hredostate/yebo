/**
 * Router Configuration
 * 
 * Defines the React Router v6 route structure with:
 * - Section-based layouts
 * - Default redirects
 * - Integration with existing AppRouter component
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SectionLayout from '../components/layouts/SectionLayout';
import { SECTION_CONFIGS } from './sectionConfig';
import Spinner from '../components/common/Spinner';

// Lazy load AppRouter to match existing pattern
const AppRouter = lazy(() => import('../components/AppRouter'));

interface RouterConfigProps {
  currentView: string;
  data: any;
  actions: any;
  userPermissions: string[];
}

/**
 * Wrapper component that renders AppRouter with the correct view
 * This maintains compatibility with existing AppRouter component
 */
const ViewRenderer: React.FC<{ view: string; data: any; actions: any }> = ({ 
  view, 
  data, 
  actions 
}) => {
  return (
    <Suspense fallback={<div className="flex justify-center pt-10"><Spinner size="lg" /></div>}>
      <AppRouter currentView={view} data={data} actions={actions} />
    </Suspense>
  );
};

/**
 * Main router configuration component
 */
export const RouterConfig: React.FC<RouterConfigProps> = ({
  currentView,
  data,
  actions,
  userPermissions,
}) => {
  return (
    <Routes>
      {/* Root redirect to workspace/dashboard */}
      <Route path="/" element={<Navigate to="/workspace/dashboard" replace />} />
      
      {/* Workspace Section */}
      <Route
        path="/workspace"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS.workspace} 
            userPermissions={userPermissions}
          />
        }
      >
        {/* Default redirect */}
        <Route index element={<Navigate to={SECTION_CONFIGS.workspace.defaultPath} replace />} />
        
        {/* Workspace routes */}
        {SECTION_CONFIGS.workspace.tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
      </Route>
      
      {/* Communication Section */}
      <Route
        path="/communication"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS.communication} 
            userPermissions={userPermissions}
          />
        }
      >
        <Route index element={<Navigate to={SECTION_CONFIGS.communication.defaultPath} replace />} />
        {SECTION_CONFIGS.communication.tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
      </Route>
      
      {/* Academics Section */}
      <Route
        path="/academics"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS.academics} 
            userPermissions={userPermissions}
          />
        }
      >
        <Route index element={<Navigate to={SECTION_CONFIGS.academics.defaultPath} replace />} />
        {SECTION_CONFIGS.academics.tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
        {/* Support parameterized routes like score-entry/:assignmentId */}
        <Route
          path="score-entry/:assignmentId"
          element={<ViewRenderer view="Teacher Score Entry" data={data} actions={actions} />}
        />
      </Route>
      
      {/* Student Affairs Section */}
      <Route
        path="/student-affairs"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS['student-affairs']} 
            userPermissions={userPermissions}
          />
        }
      >
        <Route index element={<Navigate to={SECTION_CONFIGS['student-affairs'].defaultPath} replace />} />
        {SECTION_CONFIGS['student-affairs'].tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
        {/* Support parameterized routes like student-profile/:studentId */}
        <Route
          path="student-profile/:studentId"
          element={<ViewRenderer view="Student Profile" data={data} actions={actions} />}
        />
        <Route
          path="intervention-plans/:studentId"
          element={<ViewRenderer view="Intervention Plans" data={data} actions={actions} />}
        />
      </Route>
      
      {/* Transport Section */}
      <Route
        path="/transport"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS.transport} 
            userPermissions={userPermissions}
          />
        }
      >
        <Route index element={<Navigate to={SECTION_CONFIGS.transport.defaultPath} replace />} />
        {SECTION_CONFIGS.transport.tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
      </Route>
      
      {/* HR Section */}
      <Route
        path="/hr"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS.hr} 
            userPermissions={userPermissions}
          />
        }
      >
        <Route index element={<Navigate to={SECTION_CONFIGS.hr.defaultPath} replace />} />
        {SECTION_CONFIGS.hr.tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
      </Route>
      
      {/* Finance Section */}
      <Route
        path="/finance"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS.finance} 
            userPermissions={userPermissions}
          />
        }
      >
        <Route index element={<Navigate to={SECTION_CONFIGS.finance.defaultPath} replace />} />
        {SECTION_CONFIGS.finance.tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
      </Route>
      
      {/* Admin Section */}
      <Route
        path="/admin"
        element={
          <SectionLayout 
            config={SECTION_CONFIGS.admin} 
            userPermissions={userPermissions}
          />
        }
      >
        <Route index element={<Navigate to={SECTION_CONFIGS.admin.defaultPath} replace />} />
        {SECTION_CONFIGS.admin.tabs.map(tab => (
          <Route
            key={tab.id}
            path={tab.path.split('/').pop()}
            element={<ViewRenderer view={tab.view} data={data} actions={actions} />}
          />
        ))}
      </Route>
      
      {/* Student Portal Routes (no section layout) */}
      <Route path="/student/*">
        <Route path="dashboard" element={<ViewRenderer view="Student Dashboard" data={data} actions={actions} />} />
        <Route path="portal" element={<ViewRenderer view="Student Portal" data={data} actions={actions} />} />
        <Route path="subjects" element={<ViewRenderer view="My Subjects" data={data} actions={actions} />} />
        <Route path="finances" element={<ViewRenderer view="Student Finances" data={data} actions={actions} />} />
        <Route path="reports" element={<ViewRenderer view="Student Reports" data={data} actions={actions} />} />
        <Route path="report/:studentId/:termId" element={<ViewRenderer view="Student Report" data={data} actions={actions} />} />
        <Route path="surveys" element={<ViewRenderer view="Student Surveys" data={data} actions={actions} />} />
        <Route path="profile-edit" element={<ViewRenderer view="Student Profile Edit" data={data} actions={actions} />} />
        <Route path="strikes" element={<ViewRenderer view="My Strikes & Appeals" data={data} actions={actions} />} />
        <Route path="take-quiz/:quizId" element={<ViewRenderer view="Take Quiz" data={data} actions={actions} />} />
        <Route path="lessons" element={<ViewRenderer view="Student Lessons" data={data} actions={actions} />} />
        <Route path="homework" element={<ViewRenderer view="My Homework" data={data} actions={actions} />} />
        <Route path="rate-teacher" element={<ViewRenderer view="Rate My Teacher" data={data} actions={actions} />} />
      </Route>
      
      {/* Fallback for unknown routes */}
      <Route path="*" element={<Navigate to="/workspace/dashboard" replace />} />
    </Routes>
  );
};

export default RouterConfig;
