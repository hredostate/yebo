import { WidgetDefinition } from './types';

export const ALL_WIDGETS: WidgetDefinition[] = [
  { id: 'my-tasks', title: 'My Tasks', description: 'A list of your assigned tasks.', requiredPermission: 'view-dashboard' },
  { id: 'daily-report-status', title: 'Daily Report Status', description: 'Shows if you have submitted your daily report.', requiredPermission: 'submit-report' },
  { id: 'daily-briefing', title: 'AI Strategic Briefing', description: 'A daily summary of key events and AI-powered recommendations.', requiredPermission: 'view-school-health-overview' },
  { id: 'announcements', title: 'Bulletin Board', description: 'School-wide announcements.', requiredPermission: 'view-dashboard' },
  { id: 'alerts', title: 'Urgent Alerts', description: 'Critical and high-priority alerts.', requiredPermission: 'view-dashboard' },
  { id: 'at-risk-students', title: 'At-Risk Students', description: 'Students flagged by AI as needing attention.', requiredPermission: 'view-at-risk-students' },
  { id: 'positive-trends', title: 'Positive Trends', description: 'A feed of positive behavior logs.', requiredPermission: 'view-dashboard' },
  { id: 'kudos', title: 'Staff Spotlight', description: 'AI-generated recognition for staff members.', requiredPermission: 'view-dashboard' },
  { id: 'counselor-caseload', title: 'My Caseload', description: 'Key students for counselors.', requiredPermission: 'manage-students' },
  { id: 'inventory', title: 'Inventory Levels', description: 'Tracks stock for relevant categories.', requiredPermission: 'view-dashboard' },
  { id: 'maintenance-schedule', title: 'Maintenance Schedule', description: 'Upcoming preventative maintenance tasks.', requiredPermission: 'manage-tasks' },
  { id: 'student-records', title: 'Student Records', description: 'Quickly search for a student.', requiredPermission: 'view-all-student-data' },
  { id: 'sip-status', title: 'Active Intervention Plans', description: 'Summary of active SIPs.', requiredPermission: 'manage-students' },
  { id: 'at-risk-teachers', title: 'At-Risk Staff Analysis', description: 'AI analysis of staff well-being.', requiredPermission: 'manage-users' },
  { id: 'policy-inquiry', title: 'AI Policy Inquiry', description: 'AI highlights potential policy gaps for leadership review.', requiredPermission: 'access-policy-inquiry' },
  { id: 'curriculum-report', title: 'AI Curriculum Report', description: 'AI-generated summary of lesson plan submission and coverage.', requiredPermission: 'view-curriculum-analytics' },
  { id: 'sms-wallet', title: 'SMS Wallet Balance', description: 'Shows the current balance for sending SMS alerts.', requiredPermission: 'view-sms-balance' },
  { id: 'team-pulse', title: 'Team Pulse', description: 'Team morale and feedback summary.', requiredPermission: 'view-dashboard' },
  { id: 'social-media', title: 'Social Media', description: 'Social media analytics and summary.', requiredPermission: 'manage-social-media' },
];