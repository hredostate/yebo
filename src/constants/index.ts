
import type { RoleTitle } from '../types';
import { StudentStatus } from '../types';

export const ALL_PERMISSIONS: string[] = [
  'access-ai-assistant',
  'access-data-uploader',
  'access-policy-inquiry',
  'assign-reports',
  'comment-on-reports',
  'delete-any-report',
  'generate-staff-awards',
  'manage-announcements',
  'manage-assessments',
  'manage-calendar',
  'manage-class-groups',
  'manage-curriculum',
  'manage-living-policy',
  'manage-payroll',
  'manage-surveys',
  'manage-roles',
  'manage-settings',
  'manage-students',
  'manage-tasks',
  'manage-teams',
  'manage-users',
  'manage-orders',
  'results.lock_and_publish',
  'school.console.branding_edit',
  'school.console.role_admin',
  'school.console.structure_edit',
  'school.console.view_audit_log',
  'school.console.view', // Master permission to see the console
  'score_entries.edit_department',
  'score_entries.edit_self',
  'send-emergency-broadcast',
  'submit-report',
  'view-all-reports',
  'view-analytics',
  'view-compliance-tracker',
  'view-coverage-feedback',
  'view-curriculum-analytics',
  'view-dashboard',
  'view-school-health-overview',
  'view-sms-balance',
  'view-teacher-ratings',
  'view-teacher-attendance',
  'manage-finance',
  'generate-id-cards',
  'manage-social-media',
  // Teacher-specific permissions
  'view-my-classes',
  'view-my-lesson-plans',
  'view-my-coverage-feedback',
  'take-class-attendance',
  'view-curriculum-readonly',
  // Sensitive feature restrictions
  'view-ai-task-suggestions',
  'view-at-risk-students',
  'view-all-student-data',
  'view-sensitive-reports',
  // Predictive Analytics permissions
  'view-predictive-analytics',
  'manage-risk-predictions',
  'manage-learning-paths',
  'manage-schedule-optimization',
  'generate-automated-reports',
];

export const VIEWS = {
  DASHBOARD: 'Dashboard',
  STUDENT_PORTAL: 'Student Portal',
  MY_SUBJECTS: 'My Subjects',
  RATE_MY_TEACHER: 'Rate My Teacher',
  STUDENT_REPORTS: 'Student Reports',
  STUDENT_SURVEYS: 'Student Surveys',
  TAKE_QUIZ: 'Take Quiz',
  TAKE_SURVEY: 'Take Survey',
  SUBMIT_REPORT: 'Submit Report',
  REPORT_FEED: 'Report Feed',
  TASK_BOARD: 'Task Board',
  BULLETIN_BOARD: 'Bulletin Board',
  STUDENT_ROSTER: 'Student Roster',
  STUDENT_PROFILE: 'Student Profile',
  INTERVENTION_PLANS: 'Intervention Plans',
  ANALYTICS: 'Analytics',
  COMPLIANCE_TRACKER: 'Compliance Tracker',
  CLASSES_ATTENDANCE: 'Classes & Attendance',
  SURVEY_MANAGER: 'Survey Manager',
  SURVEYS: 'Surveys', // For Staff Manager
  CALENDAR: 'Calendar',
  GUARDIAN_COMMAND: 'Guardian Command',
  USER_MANAGEMENT: 'User Management',
  ROLE_MANAGEMENT: 'Role Management',
  TEAM_MANAGEMENT: 'Team Management',
  CURRICULUM_MANAGER: 'Curriculum Manager',
  LESSON_PLANNER: 'Lesson Planner',
  GRADEBOOK: 'Gradebook',
  TEACHER_SCORE_ENTRY: 'Teacher Score Entry',
  ASSESSMENT_MANAGER: 'Assessment Manager',
  TEACHING_ASSIGNMENTS: 'Teaching Assignments',
  RESULT_MANAGER: 'Result Manager',
  COVERAGE_FEEDBACK: 'Coverage Feedback',
  DATA_UPLOAD: 'Data Upload',
  LIVING_POLICY: 'Living Policy',
  EMERGENCY_BROADCAST: 'Emergency Broadcast',
  PROFILE: 'Profile',
  SETTINGS: 'Settings',
  TEACHER_RATINGS: 'Teacher Ratings',
  MY_CHECKIN: 'My Check-in',
  TEACHER_ATTENDANCE: 'Teacher Attendance',
  TEACHER_PULSE: 'Teacher Pulse',
  AI_STRATEGIC_CENTER: 'AI Strategic Center',
  SUPER_ADMIN_CONSOLE: 'Super Admin',
  SUPPORT_HUB: 'Support Hub',
  DATA_ANALYSIS: 'Data Analysis',
  REWARDS_STORE: 'Rewards Store',
  ROLE_DIRECTORY: 'Role Directory',
  STUDENT_REPORT: 'Student Report', // Individual Report View
  HR_PAYROLL: 'HR & Payroll',
  MY_PAYROLL: 'My Payroll',
  MY_LEAVE: 'My Leave',
  LEAVE_APPROVALS: 'Leave Approvals',
  MY_ADJUSTMENTS: 'My Adjustments',
  STUDENT_FINANCE: 'Student Finance',
  TIMETABLE: 'Timetable',
  ID_CARDS: 'ID Cards',
  STOREFRONT: 'School Store',
  STORE_MANAGER: 'Store Manager',
  ORDER_MANAGER: 'Order Manager',
  SOCIAL_MEDIA_HUB: 'Social Media Hub',
  PREDICTIVE_ANALYTICS: 'Predictive Analytics',
  ZERO_SCORE_MONITOR: 'Zero Score Monitor',
};

export const STUDENT_STATUSES = [
    { value: 'Active', label: 'Active', color: 'bg-green-500/20 text-green-800 dark:text-green-300' },
    { value: StudentStatus.DisciplinarySuspension, label: 'Disciplinary Suspension', color: 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300' },
    { value: StudentStatus.Expelled, label: 'Expelled', color: 'bg-red-500/20 text-red-800 dark:text-red-300' },
    { value: StudentStatus.FinancialSuspension, label: 'Financial Suspension', color: 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300' },
    { value: StudentStatus.OnLeave, label: 'On Leave', color: 'bg-blue-500/20 text-blue-800 dark:text-blue-300' },
    { value: StudentStatus.Transferred, label: 'Transferred', color: 'bg-slate-500/20 text-slate-700 dark:text-slate-400' },
    { value: StudentStatus.Graduated, label: 'Graduated', color: 'bg-purple-500/20 text-purple-800 dark:text-purple-300' },
    { value: StudentStatus.Withdrawn, label: 'Withdrawn', color: 'bg-slate-500/20 text-slate-700 dark:text-slate-400' },
    { value: StudentStatus.DistanceLearner, label: 'Distance Learner', color: 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-300' },
];

export const REPORTING_ROLES: RoleTitle[] = ['Teacher', 'Team Lead', 'Principal', 'Counselor', 'IT Support', 'Maintenance'];

export const ADMINISTRATIVE_ROLES: RoleTitle[] = ['Admin', 'Principal', 'Team Lead'];

export const SUBJECT_OPTIONS: string[] = ['Accounting','Agricultural Science','Art','Art and Creativity','Basic Science','Beauty and Cosmetology','Biology','Business Studies','Catering and Craft Practice','Chemistry','Christian Religious Studies','Civic Education','Commerce','Common core language','Common core maths','Computer Hardware and GSM Repair','Core Mathematics','Creative Art','Critical Thinking','Cultural and Creative Arts','Cultural studies (History)','Digital Technologies','Economics','ELA (English Language Arts)','English','Essential in writing','Essentials in Writing','Fashion Design and Garment Making','French','Further Mathematics','General science','Geography','Government','Handwriting','History','History/Geography','Home Economics','Horticulture and Crop Production','ICT','Intermediate Science','Language Smart','Life Skills','Literature','Literature in English','Livestock Farming','Mathematics','Mathematics 1','Mathematics 2','Maths Quest','Montessori Language','Montessori Maths','Montessori science','Music','Nigerian History','Number Navigators','Numeracy','Oral English','PHE (Physical and Health Education)','Phonics (1-3)','Physical Education','Physical Health and Safety','Physics','Practical life','Quantitative','Religion','Religious Awareness','Religious Studies','Science','Sensorial','Sensory Splash','Social and Citizenship Studies','Social Ethics','Social Studies','Solar Photovoltaic Installation and Maintenance','STEM','Technical Drawing','Visual Arts','Vocabulary Virtuoso','Vocational Studies'];

export const SCHOOL_LOGO_URL = "https://tyvufbldcucgmmlattct.supabase.co/storage/v1/object/public/Images/imageedit_1_5058819643%20(1).png";

export const PRINCIPAL_PERSONA_PROMPT = `
Role:
You are a Nigerian High School Principal — wise, kind, visionary, and firm. You are deeply respected because you combine warmth with discipline, humor with structure, and compassion with high expectations. You believe in growth, accountability, and excellence for students, teachers, and the entire school workforce.

🧠 Core Character Foundation

Values: Discipline • Integrity • Growth Mindset • Structure • Respect • Teamwork • Accountability • Service • Pride in Work

Philosophy: “Discipline is love in uniform.”

Style: Firm but fair. Always calm, never rude. Speaks with heart, purpose, and quiet authority.

Cultural tone: Nigerian wisdom with global polish — uses proverbs, relatable examples, and humor that connects deeply.

Voice: Warm, articulate, slightly witty; switches between formal English and light Naija phrasing when emotion or humor fits.

🎒 When Talking to Students

Tone: Encouraging, humorous, slightly parental, full of structure and purpose.
Goal: Build character, promote academic focus, teach discipline and self-belief.
Example Voice:
“Listen, my dear students — greatness is not magic. It’s habit. You can’t want to top the class and still be allergic to morning prep. No shortcut will take you to the top if you’re skipping the staircase.”
“I’m proud of you all, but let’s remember: talent is nothing without self-discipline. Even Messi trains. Even pastors rehearse sermons.”

👩🏽‍🏫 When Talking to Teachers

Tone: Collegial but firm — respect with authority.
Goal: Inspire professionalism, structure, and unity among staff.
Example Voice:
“We are the standard. Students mirror what they see. If we want excellence in the children, we must wear excellence first — in our time, our tone, and our teaching.”
“Let’s not chase perfection; let’s build consistency. Small daily effort, big lifetime result.”

👔 When Talking to the General Workforce (Admin, Security, Cleaners, Drivers, Cooks, etc.)

Tone: Respectful, empowering, unifying.
Goal: Build pride and diligence in every role — teach that every contribution matters.
Example Voice:
“Every hand here builds this school — from the gate to the classroom. When the gatekeeper smiles, learning begins. When the cleaner keeps the floor shining, excellence walks freely.”
“Respect your work, and your work will respect you. Don’t do things anyhow. We are building a legacy.”

🧭 Behavioral Logic

When in doubt, the principal:
1. Starts with encouragement (“I see potential here…”).
2. Identifies the gap (“…but you’re not giving your best yet.”).
3. Reframes as growth opportunity (“Let’s raise the bar together.”).
4. Ends with purpose and hope (“We are not where we want to be, but we’re surely not where we were.”).
`;
