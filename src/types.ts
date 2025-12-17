



export type RoleTitle = 'Admin' | 'Principal' | 'Team Lead' | 'Teacher' | 'Counselor' | 'Accountant' | 'School Secretary' | 'IT Support' | 'Maintenance' | 'Librarian' | 'Bookstore and Uniform Attendant' | 'Day care Administrator' | 'Social Media Manager' | 'Guardian' | 'Student';

export enum EmploymentStatus {
    Active = 'Active',
    Resigned = 'Resigned',
    Fired = 'Fired',
    Suspended = 'Suspended',
    LongLeave = 'Long Leave'
}

export interface UserProfile {
    id: string;
    school_id: number;
    name: string;
    email: string;
    role: RoleTitle;
    avatar_url?: string;
    staff_code?: string;
    phone_number?: string;
    description?: string;
    bank_code?: string;
    bank_name?: string;
    account_number?: string;
    account_name?: string;
    base_pay?: number;
    commission?: number;
    campus_id?: number | null;
    has_seen_tour?: boolean;
    dashboard_config?: string[];
    employment_status?: EmploymentStatus;
    policy_acknowledgments?: PolicyAcknowledgment[];
    created_at: string;
}

export interface StudentProfile {
    id: string; // Auth ID
    student_record_id: number; // Link to Student table
    school_id: number;
    full_name: string;
    class_id: number | null;
    arm_id: number | null;
    created_at: string;
    class_name?: string | null;
    arm_name?: string | null;
    email?: string;
}

export interface Student {
    id: number;
    school_id: number;
    name: string;
    admission_number?: string;
    grade?: string; // e.g. "10" or "JSS 1"
    class_id?: number | null;
    arm_id?: number | null;
    campus_id?: number | null; // Campus assignment
    date_of_birth?: string;
    parent_phone_number_1?: string;
    parent_phone_number_2?: string;
    address?: string;
    email?: string;
    status?: StudentStatus;
    reward_points: number;
    user_id?: string | null; // Auth ID if created
    policy_acknowledgments?: PolicyAcknowledgment[];
    created_at?: string;
    class?: { id: number; name: string };
    arm?: { id: number; name: string };
    campus?: { id: number; name: string };
    photo_url?: string;
    /**
     * Dedicated Virtual Account (DVA) number for the student
     * Used for fee collection and payment tracking
     * Format may vary by payment provider (e.g., Paystack, Wema Bank)
     */
    dva?: string;
    // Editable profile fields
    phone?: string;
    street_address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
}

export enum StudentStatus {
    Active = 'Active',
    DisciplinarySuspension = 'Disciplinary Suspension',
    Expelled = 'Expelled',
    FinancialSuspension = 'Financial Suspension',
    OnLeave = 'On Leave',
    Transferred = 'Transferred',
    Graduated = 'Graduated',
    Withdrawn = 'Withdrawn',
    DistanceLearner = 'Distance Learner'
}

export enum TaskPriority {
    Critical = 'Critical',
    High = 'High',
    Medium = 'Medium',
    Low = 'Low'
}

export enum TaskStatus {
    ToDo = 'ToDo',
    InProgress = 'InProgress',
    Completed = 'Completed',
    Archived = 'Archived'
}

export interface Task {
    id: number;
    school_id: number;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    user_id: string;
    created_by?: string;
    report_id?: number;
    reminder_sent?: boolean;
    reminder_minutes_before?: number | null;
    created_at: string;
    updated_at: string;
}

export enum ReportType {
    Incident = 'Incident',
    Infraction = 'Teacher Infraction',
    Observation = 'Observation',
    DailyCheckIn = 'Daily Check-in',
    NextDayAgenda = 'Next Day Agenda',
    MaintenanceRequest = 'Maintenance Request',
    SupplyRequisition = 'Supply Requisition',
    Accident = 'Accident',
    Health = 'Health',
    Discipline = 'Strike'
}

export interface ReportRecord {
    id: number;
    school_id: number;
    report_text: string;
    report_type: ReportType;
    author_id: string;
    assignee_id?: string | null;
    involved_students: number[]; // IDs
    involved_staff: string[]; // IDs
    tagged_users?: { user_id: string; name: string; type: 'staff' | 'student' }[];
    image_url?: string | null;
    status?: 'pending' | 'treated';
    response?: string | null;
    archived?: boolean; // For soft deletion / strike resetting
    analysis?: {
        sentiment: 'Positive' | 'Negative' | 'Neutral';
        urgency: 'Low' | 'Medium' | 'High' | 'Critical';
        summary: string;
    };
    parent_communication_draft?: string;
    internal_summary_draft?: string;
    created_at: string;
    author?: UserProfile;
    assignee?: UserProfile;
    comments?: ReportComment[];
}

export interface ReportComment {
    id: number;
    report_id: number;
    author_id: string;
    comment_text: string;
    created_at: string;
    author?: UserProfile;
}

export interface Announcement {
    id: number;
    school_id: number;
    title: string;
    content: string;
    author_id: string;
    created_at: string;
    author?: { name: string };
}

export interface Notification {
    id: number;
    user_id: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export interface ToastMessage {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

export interface RoleDetails {
    id?: number;
    school_id?: number;
    title: RoleTitle;
    description: string;
    permissions: string[];
    reportingQuotaDays?: number | null;
    reportingQuotaCount?: number | null;
    aiAnalysisFocus?: string;
    aiRoutingInstructions?: string;
}

export interface UserRoleAssignment {
    id: number;
    user_id: string;
    role_id: number;
    school_id: number;
    created_at?: string;
}

export interface PositiveBehaviorRecord {
    id: number;
    student_id: number;
    description: string;
    author_id: string;
    created_at: string;
    student?: Student;
    author?: { name: string };
}

export interface StudentAward {
    id: number;
    school_id: number;
    student_id: number;
    award_type: string; // e.g., "Most Improved"
    reason: string;
    created_at: string;
    student?: { name: string };
}

export interface StaffAward {
    id: number;
    school_id: number;
    recipient_id: string; // user_id
    recipient_name: string;
    reason: string;
    source_report_ids?: number[];
    created_at: string;
}

export interface AIProfileInsight {
    synopsis: string;
    strengths: string[];
    growthAreas: string[];
    nextSteps: string[];
}

export interface AtRiskStudent {
    student: Student;
    score: number; // 1-100
    reasons: string[];
}

export interface Alert {
    id: number | string;
    title: string;
    description: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    type: 'safety' | 'compliance' | 'academic' | 'health';
    sourceId?: number | string;
    sourceType?: 'report' | 'student' | 'inventory';
}

export interface StudentInterventionPlan {
    id: number;
    student_id: number;
    school_id: number;
    goals: string[];
    is_active: boolean;
    created_at: string;
    student?: Student;
}

export interface SIPLog {
    id: number;
    sip_id: number;
    log_entry: string;
    author_id: string;
    created_at: string;
    author?: { name: string };
}

export interface SchoolHealthReport {
    generated_at: string;
    overall_score: number;
    summary: string;
    metrics: { metric: string; score: number; summary: string }[];
}

export interface AISettings {
    groq_api_key?: string;
    openrouter_api_key?: string; // Deprecated, kept for backward compatibility
    default_model?: string;
    is_configured?: boolean;
}

export interface SchoolSettings {
    id: number;
    name: string;
    secret_code: string;
    branding?: { primary_color: string };
    school_documents?: {
        daily_briefing?: DailyBriefing;
        curriculum_report?: CurriculumReport;
        health_report?: SchoolHealthReport;
        improvement_plan?: SchoolImprovementPlan;
        living_policy_document?: { generated_at: string, content: string };
        coverage_deviation_report?: { generated_at: string, report: CoverageDeviation[] };
    };
    social_accounts?: SocialAccount;
    ai_settings?: AISettings;
    created_at: string;
}

export interface PolicyInquiry {
    id: string;
    category: string;
    question: string;
    context: string;
}

export interface LivingPolicySnippet {
    id: number;
    content: string;
    author_id: string;
    school_id: number;
    created_at: string;
    author?: { name: string };
}

export interface PolicyAcknowledgment {
    policy_id: number;
    policy_title: string;
    policy_version: string;
    acknowledged_at: string;
    full_name_entered: string;
    ip_address?: string;
}

export interface PolicyAcknowledgmentRecord {
    id: number;
    policy_id: number;
    school_id: number;
    user_id?: string;
    student_id?: number;
    full_name_entered: string;
    policy_version: string;
    acknowledged_at: string;
    ip_address?: string;
}

export interface PolicyStatement {
    id: number;
    school_id: number;
    title: string;
    content: string;
    version: string;
    target_audience: ('student' | 'staff')[];
    is_active: boolean;
    requires_acknowledgment: boolean;
    effective_date: string;
    created_by?: string;
    created_at: string;
    updated_at?: string;
}

export interface AtRiskTeacher {
    teacher: UserProfile;
    score: number;
    reasons: string[];
}

export interface CalendarEvent {
    id: number;
    school_id: number;
    title: string;
    description?: string;
    start_time: string; // ISO
    end_time: string; // ISO
    is_all_day: boolean;
    created_by: string;
    created_at?: string;
}

export enum SubmissionStatus {
    Pending = 'Pending',
    OnTime = 'On Time',
    Late = 'Late',
    Missed = 'Missed'
}

export enum CoverageStatus {
    Pending = 'Pending',
    FullyCovered = 'Fully Covered',
    PartiallyCovered = 'Partially Covered',
    NotCovered = 'Not Covered'
}

export interface LessonPlanSession {
    title: string;
    scope: string;
    goals: string;
    hook: string;
    active_learning: { description: string; objective: string; materials: string; steps: string[] };
    real_world_connection: string;
    peer_review: string;
    worksheet: { title: string; objective: string; items: string[] };
    core_vocabulary: { list: string[]; usageNotes: string };
    board_summary: { narrative: string; answer_key: string[] };
    mcqs: { question: string; options: string[]; answer: string }[];
    theory_questions: { question: string; answer: string }[];
}

export interface LessonPlan {
    id: number;
    school_id: number;
    teaching_entity_id: number; // links to TeachingAssignment (Academic)
    week_start_date: string;
    title: string;
    grade_level?: string;
    
    // Structured content
    smart_goals?: string;
    objectives?: string;
    materials?: string;
    assessment_methods?: string;
    activities?: string;
    sessions?: LessonPlanSession[];
    
    // Freeform content
    plan_type: 'structured' | 'freeform';
    freeform_content?: string;
    file_url?: string;

    submission_status: SubmissionStatus;
    coverage_status: CoverageStatus;
    coverage_notes?: string | null;
    
    status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revision_required' | 'published';
    
    // Publishing fields
    published_at?: string | null;
    published_by?: string | null;
    publish_target?: 'all' | 'class' | 'arm' | null;

    author_id: string;
    created_at: string;
    updated_at: string;

    author?: { name: string };
    teaching_entity?: AcademicTeachingAssignment;
    ai_analysis?: LessonPlanAnalysis;
}

export interface LessonPlanAnalysis {
    has_objectives: boolean;
    has_assessment: boolean;
    clarity_score: number; // 1-10
    suggestions: string[];
}

export interface CurriculumReport {
    generated_at: string;
    summary: string;
    submission_rate: number;
    late_submissions: number;
    coverage_gaps: { class_name: string, topic: string, suggestion?: string }[];
}

export interface DailyBriefing {
    generated_at: string;
    daily_summary: string;
    morale_forecast: string;
    resource_allocation_suggestions: string[];
    parent_communication_points: string[];
}

export interface TeachingAssignment {
    id: number;
    user_id: string;
    school_id: number;
    subject_id?: number;
    class_id?: number;
    arm_id?: number | null;
    created_at: string;
    
    teacher?: { name: string };
    subject?: { name: string };
    class?: { name: string };
    arm?: { name: string };
}

export interface BaseDataObject {
    id: number;
    school_id?: number;
    name: string;
    campus_id?: number | null;
}

export interface Subject extends BaseDataObject {
    priority?: number | null;
    is_solo?: boolean | null;
    can_co_run?: boolean | null;
}

export interface ClassSubject {
    id: number;
    class_id: number;
    subject_id: number;
    is_compulsory: boolean;
}

// Using Quiz structures for Surveys as well, as noted in SurveyManager
export type QuizQuestionType = 'multiple_choice' | 'short_answer' | 'true_false' | 'ranking';
export type SurveyQuestionType = QuizQuestionType;

export interface MultipleChoiceOption {
    text: string;
    quota?: number | null;
}

export interface QuizQuestion {
    id?: number;
    quiz_id?: number;
    question_text: string;
    question_type: QuizQuestionType;
    position: number;
    options?: MultipleChoiceOption[]; 
}

export interface AudienceRule {
    type: 'global' | 'role' | 'class' | 'class_arm';
    value?: string; // for global/role
    class_id?: number;
    arm_id?: number;
    name: string; // Display label
}

export interface QuizWithQuestions {
    id: number;
    school_id: number;
    title: string;
    description: string;
    created_by: string;
    created_at: string;
    questions: QuizQuestion[];
    audience: AudienceRule[];
}

export type Survey = QuizWithQuestions;
export type SurveyWithQuestions = QuizWithQuestions;
export type SurveyQuestion = QuizQuestion;

export interface TeacherRatingWeekly {
    teacher_id: string;
    week_start: string;
    rating_count: number;
    weighted_avg: number;
    low_count: number;
    spotlight: boolean;
}

export interface SuggestedTask {
    id: string;
    reportId?: number;
    title: string;
    description: string;
    priority: TaskPriority;
    suggestedRole: string;
}

export interface SchoolImprovementPlan {
    generated_at: string;
    executive_summary: string;
    strategic_goals: { goal: string; initiatives: string[]; kpi: string }[];
    data_summary: { total_reports: number; key_themes: string[] };
}

export interface Curriculum {
    id: number;
    teaching_entity_id: number;
    school_id: number;
    created_at: string;
}

export interface CurriculumWeek {
    id?: number;
    curriculum_id?: number;
    week_number: number;
    expected_topics: string;
}

export interface CoverageDeviation {
    teacherName: string;
    teachingAssignment: string;
    week: number;
    status: string;
    justification: string;
}

export enum ClassGroupType {
    ClassTeacher = 'class_teacher',
    SubjectTeacher = 'subject_teacher'
}

export interface ClassGroup {
    id: number;
    school_id: number;
    name: string;
    description: string;
    group_type: ClassGroupType;
    created_by: string;
    created_at: string;
    members: ClassGroupMember[];
    teaching_entity?: AcademicTeachingAssignment;
    teaching_entity_id?: number | null;
}

export interface ClassGroupMember {
    id: number; // member record id
    group_id: number;
    student_id: number;
    // Optional populated data
    student_name?: string;
    schedules?: AttendanceSchedule[];
    records?: AttendanceRecord[];
}

export interface AttendanceSchedule {
    id: number;
    member_id: number; // Link to class_group_member
    day_of_week: number; // 0-6
    start_time: string;
    end_time: string;
}

export enum AttendanceStatus {
    Present = 'Present',
    Absent = 'Absent',
    Late = 'Late',
    Excused = 'Excused',
    Remote = 'Remote'
}

export interface AttendanceRecord {
    id: number;
    member_id: number;
    schedule_id: number | null; // null for daily class teacher attendance
    session_date: string;
    status: AttendanceStatus;
    created_at: string;
    updated_at: string;
}

export interface AttendanceOverride {
    id: number;
    student_id: number;
    class_group_id: number;
    term_id: number;
    session_label?: string | null;
    total_days: number;
    days_present: number;
    comment?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface UPSSGPTResponse {
    answer: string;
    alerts: string[];
    recommended_actions: string[];
    confidence: 'high' | 'medium' | 'low';
}

export interface SchoolConfig {
    school_id: number;
    display_name: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    motto?: string;
    active_grading_scheme_id?: number | null;
    current_term_id?: number | null;
    term_weights?: { term1: number, term2: number, term3: number };
    student_id_prefix?: string;
    staff_id_prefix?: string;
    id_year_mode?: 'current_year' | 'admission_year' | null;
    pay_cycle?: 'monthly' | 'weekly';
    late_checkin_deduction_percent?: number | null;
    fine_early_checkout?: number | null;
    fine_no_checkout?: number | null;
}

export interface Term {
    id: number;
    school_id: number;
    session_label: string; // e.g. "2023/2024"
    term_label: string; // e.g. "First Term"
    start_date: string;
    end_date: string;
    is_active: boolean;
}

export interface AssessmentComponent {
    name: string;
    max_score: number;
}

export interface AssessmentStructure {
    id: number;
    school_id: number;
    name: string;
    components: AssessmentComponent[]; // stored as JSONB
}

export interface ReportCardConfig {
    layout: 'classic' | 'modern' | 'compact' | 'professional' | 'pastel' | 'modern-gradient' | 'banded-rows' | 'executive-dark' | 'minimalist-clean';
    orientation: 'portrait' | 'landscape';
    showPhoto: boolean;
    showPosition: boolean;
    showGraph: boolean;
    colorTheme?: string;
    customLogoUrl?: string;
    schoolNameOverride?: string;
    principalLabel?: string;
    teacherLabel?: string;
    principalNameOverride?: string;
    teacherNameOverride?: string;
}

export interface AcademicClass {
    id: number;
    school_id: number;
    name: string; // Generated e.g. "JSS 1 Gold (2023/2024)"
    level: string; // "JSS 1"
    arm: string; // "Gold"
    session_label: string; // "2023/2024"
    assessment_structure_id?: number | null;
    grading_scheme_id?: number | null;
    report_config?: ReportCardConfig;
    is_active: boolean;
    min_subjects?: number | null;
    max_subjects?: number | null;
    
    assessment_structure?: AssessmentStructure;
}

export interface AcademicTeachingAssignment {
    id: number;
    school_id: number;
    term_id: number;
    academic_class_id: number;
    subject_name: string;
    subject_group?: string; // e.g. "Science"
    teacher_user_id: string;
    
    // Legacy / flat overrides if needed, though ideally use assessment structure
    max_ca_score?: number;
    max_exam_score?: number;
    
    is_locked: boolean;
    submitted_at?: string | null;
    
    teacher?: UserProfile;
    academic_class?: AcademicClass;
    term?: Term;
    subject?: { name: string }; // Added for compatibility/joins
}

export interface GradingSchemeRule {
    min_score: number;
    max_score: number;
    grade_label: string;
    gpa_value?: number;
    remark?: string;
    grading_scheme_id?: number;
}

export interface GradingScheme {
    id: number;
    school_id: number;
    scheme_name: string;
    rules: GradingSchemeRule[];
    gpa_max?: number;
}

export interface AcademicClassStudent {
    id: number;
    academic_class_id: number;
    student_id: number;
    enrolled_term_id: number;
    manually_enrolled?: boolean;
}

export interface StudentSubjectEnrollment {
    id: number;
    school_id: number;
    student_id: number;
    subject_id: number;
    academic_class_id: number;
    term_id: number;
    is_enrolled: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface ScoreEntry {
    id: number;
    school_id: number;
    term_id: number;
    academic_class_id: number;
    subject_name: string;
    student_id: number;
    
    // Score data - matching actual database schema
    exam_score?: number;
    total_score: number;
    grade_label: string; // Changed from 'grade' to match DB
    gpa_value?: number; // Added to match DB
    remark?: string | null; // Changed from 'teacher_comment' to match DB
    
    // CA scores stored as JSONB in database
    // ca_scores_breakdown: Stores CA components (CA1, CA2, etc.) in production DB
    // component_scores: Stores all assessment components including CA and Exam
    // Both fields are used for backward compatibility and different use cases
    ca_scores_breakdown?: Record<string, number> | null; // Changed from 'ca_score' to match DB - for CA components only
    component_scores?: Record<string, number>; // e.g. { "CA1": 10, "CA2": 15, "Exam": 50 } - all components
    
    // Audit fields for tracking who entered/modified scores
    last_updated_by?: string | null; // Added to match DB (UUID)
    entered_by_user_id?: string | null;
    last_modified_by_user_id?: string | null;
    created_at?: string;
    updated_at?: string;
    
    // Populated via joins in UI
    entered_by?: UserProfile;
    last_modified_by?: UserProfile;
}

export interface StudentTermReportDetails {
    student: {
        id: number;
        fullName: string;
        className: string;
    };
    term: {
        sessionLabel: string;
        termLabel: string;
    };
    subjects: {
        subjectName: string;
        componentScores?: Record<string, number>; // e.g. { "CA1": 10, "CA2": 15, "Exam": 50 }
        totalScore: number;
        gradeLabel: string;
        remark: string;
        subjectPosition: number;
    }[];
    summary: {
        average: number;
        positionInArm: number;
        positionInGradeLevel: number | null;
        gradeLevelSize?: number;
        gpaAverage?: number | null;
    };
    attendance: {
        present: number;
        absent: number;
        late: number;
        excused: number;
        unexcused: number;
        total: number;
        rate: number; // Percentage
        source?: 'computed' | 'override';
        overrideApplied?: boolean;
        computed?: {
            present: number;
            absent: number;
            late: number;
            excused: number;
            unexcused: number;
            total: number;
            rate: number;
        } | null;
        overrideMeta?: {
            class_group_id?: number | null;
            comment?: string | null;
            updated_by?: string | null;
            updated_at?: string | null;
        } | null;
    };
    comments: {
        teacher: string;
        principal: string;
    };
    schoolConfig: SchoolConfig;
    classReportConfig?: ReportCardConfig;
}

export interface StudentTermReport {
    id: number;
    student_id: number;
    term_id: number;
    academic_class_id: number;
    average_score: number;
    total_score: number;
    position_in_class: number;
    teacher_comment?: string;
    principal_comment?: string;
    is_published: boolean;
    public_token?: string | null;
    token_expires_at?: string | null;
    created_at: string;
    term?: Term;
}

export interface StudentTermReportSubject {
    id: number;
    report_id: number;
    subject_name: string;
    score: number;
    grade: string;
    position?: number;
    teacher_comment?: string;
    created_at?: string;
}

export interface AuditLog {
    id: number;
    school_id: number;
    actor_user_id: string;
    action: string;
    details: any;
    created_at: string;
    actor?: { name: string };
}

export interface Assessment {
    id: number;
    teaching_assignment_id: number;
    title: string;
    assessment_type: string;
    max_score: number;
    deadline?: string;
    created_at: string;
    assignment?: AcademicTeachingAssignment;
}

export interface AssessmentScore {
    id: number;
    assessment_id: number;
    student_id: number;
    score: number | null;
    comments?: string | null;
    created_at: string;
}

export interface CoverageVote {
    id: number;
    lesson_plan_id: number;
    student_id: number;
    vote: boolean;
    created_at: string;
}

export interface RewardStoreItem {
    id: number;
    school_id: number;
    name: string;
    description: string;
    cost: number;
    stock: number;
    icon: string;
    created_at?: string;
}

export interface PayrollRun {
    id: number;
    school_id: number;
    period_label: string;
    total_amount: number;
    status: 'pending' | 'processing' | 'success' | 'failed' | 'draft' | 'finalized';
    transfer_code?: string;
    created_by: string;
    created_at: string;
    meta?: any;
    pay_period_start?: string | null;
    pay_period_end?: string | null;
    pay_date?: string | null;
    reference_number?: string | null;
    payment_method?: string | null;
    finalized_at?: string | null;
    pay_period_label?: string | null;
}

export interface PayrollItem {
    id: number;
    payroll_run_id: number;
    user_id: string;
    gross_amount: number;
    deductions: { label: string; amount: number }[]; // JSONB
    net_amount: number;
    paystack_recipient_code?: string;
    transfer_status?: string;
    narration?: string;
    payslip_url?: string;
    user?: UserProfile;
    payment_method?: string;
    status?: string;
    pay_date?: string | null;
    reference_number?: string | null;
    employment_type?: string | null;
    department?: string | null;
    role_title?: string | null;
    total_employer_contributions?: number;
    line_items?: PayrollLineItem[];
}

export interface PayrollComponent {
    id: number;
    school_id: number;
    name: string;
    code?: string | null;
    component_type: 'earning' | 'deduction' | 'employer_contrib';
    taxable: boolean;
    pensionable: boolean;
    calculation_type: 'fixed' | 'formula';
    amount: number;
    formula?: string | null;
    ordering: number;
    show_on_payslip: boolean;
    is_default: boolean;
    metadata?: any;
}

export interface PayrollLineItem {
    id: number;
    payroll_item_id: number;
    component_id?: number | null;
    label: string;
    category: 'earning' | 'deduction' | 'employer_contrib';
    amount: number;
    units?: number | null;
    rate?: number | null;
    metadata?: any;
    component?: PayrollComponent;
}

export interface PensionContribution {
    id: number;
    staff_pension_id: number;
    payroll_run_id?: number | null;
    user_id: string;
    school_id: number;
    contribution_month: string;
    period_label: string;
    gross_salary: number;
    pension_base?: number | null;
    employee_contribution: number;
    employer_contribution: number;
    voluntary_contribution: number;
    total_contribution: number;
    cumulative_employee: number;
    cumulative_employer: number;
    cumulative_voluntary: number;
    cumulative_total: number;
    status: string;
}

export interface PayrollAdjustment {
    id: number;
    school_id: number;
    user_id: string;
    amount: number; // Positive for earning, negative for deduction
    reason: string;
    adjustment_type: 'addition' | 'deduction';
    is_recurring: boolean;
    payroll_run_id?: number | null; // Linked when processed
    created_at: string;
    user?: { name: string };
}

export interface Campus {
    id: number;
    school_id: number;
    name: string;
    address?: string;
    geofence_lat?: number | null;
    geofence_lng?: number | null;
    geofence_radius_meters?: number | null;
    // Paystack Integration
    paystack_secret_key?: string;
    paystack_public_key?: string;
    dva_provider?: string; // e.g., 'wema-bank', 'titan-paystack'
}

export type TeacherCheckinStatus = 'Present' | 'Late' | 'Remote' | 'Absent';
export type TeacherMood = 'Great' | 'Good' | 'Okay' | 'Tired' | 'Stressed';

export interface TeacherCheckin {
    id: number;
    school_id: number;
    teacher_id: string;
    checkin_date: string; // YYYY-MM-DD
    status: TeacherCheckinStatus;
    mood?: TeacherMood | null;
    energy?: number | null;
    notes?: string | null;
    photo_url?: string | null;
    geo_lat?: number | null;
    geo_lng?: number | null;
    checkout_time?: string | null;
    checkout_notes?: string | null;
    created_at: string;
    campus_id?: number | null;
}

export interface CheckinAnomaly {
    checkin_id: number;
    teacher_name: string;
    date: string;
    anomaly_type: 'Location' | 'Time' | 'Pattern';
    description: string;
}

export interface WeeklyCheckinRow {
    teacher_name: string;
    teacher_role: string;
    mon?: TeacherCheckin;
    tue?: TeacherCheckin;
    wed?: TeacherCheckin;
    thu?: TeacherCheckin;
    fri?: TeacherCheckin;
}

export interface LeaveType {
    id: number;
    school_id: number;
    name: string;
    days_allowed?: number | null; // per year
    requires_approval: boolean;
}

export enum LeaveRequestStatus {
    Pending = 'pending',
    Approved = 'approved',
    Rejected = 'rejected',
    Cancelled = 'cancelled'
}

export interface LeaveRequest {
    id: number;
    school_id: number;
    requester_id: string;
    leave_type_id: number;
    start_date: string;
    end_date: string;
    reason?: string;
    status: LeaveRequestStatus;
    approved_by?: string | null;
    created_at: string;
    requester?: { name: string };
    leave_type?: LeaveType;
}

export interface TeacherShift {
    id: number;
    school_id: number;
    teacher_id: string;
    day_of_week: number; // 0-6
    start_time: string; // HH:MM
    end_time: string; // HH:MM
}

export interface Holiday {
    id: number;
    school_id: number;
    name: string;
    date: string;
    is_recurring: boolean;
}

export interface FutureRiskPrediction {
    student_name: string;
    risk_level: 'Low' | 'Elevated' | 'High' | 'Critical';
    rationale: string;
}

export interface SocialMediaAnalytics {
    platform: 'Instagram' | 'Facebook' | 'X' | 'TikTok' | 'LinkedIn';
    followers: number;
    engagementRate: number;
}

export interface SocialAccount {
    instagram?: string | null;
    facebook?: string | null;
    x?: string | null;
    tiktok?: string | null;
}

export interface CreatedCredential {
    name: string;
    username?: string; // Add username field
    email?: string;
    password?: string;
    status: 'Success' | 'Failed' | 'Error' | 'Skipped';
    error?: string;
}

export interface NavigationContext {
    targetView: string;
    data?: any;
}

export interface WidgetDefinition {
    id: string;
    title: string;
    description: string;
    requiredPermission: string;
}

export interface TourSlide {
    icon: string;
    title: string;
    description: string;
}

export interface SmsBalance {
    ok: boolean;
    balanceRaw?: number | null;
    balanceFormatted?: string | null;
    currency?: string | null;
    providerCode?: string;
    providerMessage?: string;
    friendlyMessage: string;
}

export interface MaskedTeacherRating {
    id: number;
    teacher_id: string;
    week_start: string;
    rating: number;
    comment?: string | null;
    student_handle: string; // e.g. "Student #123"
    created_at: string;
}

export interface PublicTeacher {
    teacher_id: string;
    teacher_name: string;
    rank_overall: number;
    rating_count: number;
    weighted_avg: number;
    classes_taught?: string[];
    spotlight: boolean;
}

export interface PublicMaskedComment {
    rating: number;
    comment?: string | null;
    student_handle: string;
    created_at: string;
}

export interface PublicClass {
    name: string;
}

export interface FeeInstallment {
    id?: number;
    name: string; // e.g., "1st Installment", "2nd Installment"
    amount: number;
    due_date: string;
    percentage?: number; // Alternative: percentage of total fee
}

export interface FeeItem {
    id: number;
    school_id: number;
    name: string;
    description?: string;
    amount: number;
    is_compulsory: boolean;
    target_class_id?: number | null;
    target_term_id?: number | null;
    allow_installments?: boolean;
    installments?: FeeInstallment[];
    priority?: number; // Bill clearing priority (1 = highest)
}

export interface StudentInvoice {
    id: number;
    school_id: number;
    student_id: number;
    term_id: number;
    invoice_number: string;
    total_amount: number;
    amount_paid: number;
    status: InvoiceStatus;
    due_date?: string;
    created_at: string;
    student?: { name: string, admission_number?: string };
    line_items?: { description: string, amount: number }[];
}

export enum InvoiceStatus {
    Unpaid = 'Unpaid',
    PartiallyPaid = 'Partially Paid',
    Paid = 'Paid',
    Overdue = 'Overdue',
    Void = 'Void'
}

export interface Payment {
    id: number;
    school_id: number;
    invoice_id: number;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference?: string;
    verified: boolean;
    created_at: string;
    invoice?: { invoice_number: string, student?: { name: string } };
}

export interface TimetablePeriod {
    id: number;
    school_id: number;
    name: string;
    start_time: string;
    end_time: string;
    type: 'lesson' | 'break' | 'homeroom';
}

export interface TimetableEntry {
    id: number;
    school_id: number;
    term_id: number;
    day_of_week: string; // Monday...
    period_id: number;
    academic_class_id: number;
    subject_id: number;
    teacher_id: string;
    room_number?: string;
    location_id?: number | null;

    academic_class?: { name: string };
    subject?: { name: string; priority?: number | null; is_solo?: boolean | null; can_co_run?: boolean | null };
    teacher?: { name: string };
    location?: { name: string; capacity?: number | null };
}

export interface TimetableLocation {
    id: number;
    school_id: number;
    campus_id: number;
    name: string;
    capacity?: number | null;
    created_at?: string;
    campus?: { name: string };
}

export interface GlobalSearchResult {
    result_type: 'Student' | 'Staff' | 'Report' | 'Task' | 'Lesson Plan';
    result_id: string | number; // Cast as needed
    result_title: string;
    result_description: string;
}

export interface DailySentiment {
    date: string;
    Positive: number;
    Negative: number;
    Neutral: number;
}

export interface DailyPerformance {
    date: string;
    created: number;
    completed: number;
}

export interface EngagementData {
    time: string;
    Sun: number;
    Mon: number;
    Tue: number;
    Wed: number;
    Thu: number;
    Fri: number;
    Sat: number;
}

export interface DetailedQuizResponse {
    student_name: string;
    student_id: number;
    question_id: number;
    question_text: string;
    response_value: string; // Extracted text or option
    is_correct?: boolean; // For future if quiz has correct answers
    timestamp: string;
}

export interface DetailedSurveyResponse extends DetailedQuizResponse {} // Alias

export interface Team {
    id: number;
    school_id: number;
    team_name: string;
    lead_id: string | null;
    created_at: string;
    lead?: { name: string };
    members: { user_id: string; profile: { name: string } }[];
}

export interface TeamPulse {
    teamId: number;
    teamName: string;
    leadName: string;
    rank: number;
    overallScore: number;
    reportingCompliance: number;
    taskCompletion: number;
    positiveSentiment: number;
    leadEngagement: number;
    leadFeedbackScore: number;
}

export interface TeamFeedback {
    id: number;
    team_id: number;
    author_id: string;
    week_start_date: string;
    rating: number;
    comments: string | null;
    created_at: string;
}

export interface AssistantMessage {
    id: string;
    sender: 'user' | 'ai' | 'tool_code' | 'tool_output';
    text: string;
}

export interface InventoryItem {
    id: number;
    school_id: number;
    name: string;
    category: 'IT' | 'Maintenance' | 'Library' | 'Bookstore' | 'General';
    stock: number;
    low_stock_threshold: number;
    price: number;
    image_url?: string | null;
    description?: string | null;
    is_published?: boolean;
}

export type OrderStatus = 'Pending' | 'Paid' | 'Delivered' | 'Returned' | 'Cancelled';

export interface Order {
    id: number;
    school_id: number;
    user_id: string;
    total_amount: number;
    status: OrderStatus;
    payment_reference?: string | null;
    created_at: string;
    updated_at: string;
    user?: { name: string; email: string };
    items?: OrderItem[];
    notes?: OrderNote[];
}

export interface OrderItem {
    id: number;
    order_id: number;
    inventory_item_id: number;
    quantity: number;
    unit_price: number;
    inventory_item?: { name: string; image_url?: string };
}

export interface OrderNote {
    id: number;
    order_id: number;
    author_id: string;
    note: string;
    created_at: string;
    author?: { name: string };
}

export interface PlatformTask {
    platform: 'Instagram' | 'Facebook' | 'X';
    taskDescription: string;
}

export interface VideoSuggestion {
    trend: string;
    idea: string;
    example: string;
}

export interface PerformanceAnalysis {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
}

export interface TeacherRating {
    id: number;
    student_id: number;
    teacher_id: string;
    week_start: string;
    rating: number;
    comment: string | null;
    created_at: string;
}

export interface Teacher {
    id: string;
    name: string;
    teaches_this_student: boolean;
}

export interface ClassSection {
    id: number;
    school_id: number;
    name: string;
    subject: string;
    grade: number;
    teacher_id: string;
}
// Dedicated Virtual Account (DVA) Types
export interface DedicatedVirtualAccount {
    id: number;
    school_id: number;
    student_id: number;
    account_number: string;
    account_name: string;
    bank_name: string;
    bank_slug: string;
    bank_id: number;
    currency: string;
    active: boolean;
    assigned: boolean;
    paystack_account_id?: number;
    paystack_customer_id?: number;
    created_at: string;
    updated_at: string;
    student?: { name: string; admission_number?: string };
}

export interface PaystackApiSettings {
    id: number;
    school_id: number;
    campus_id?: number | null;
    secret_key: string; // Encrypted in database
    public_key?: string;
    environment: 'test' | 'live';
    enabled: boolean;
    created_at: string;
    updated_at: string;
    campus?: { name: string };
}

export interface BankProvider {
    id: number;
    provider_slug: string;
    bank_id: number;
    bank_name: string;
}

// Form data interfaces for handler parameters
export interface StudentFormData {
    name: string;
    date_of_birth: string;
    status: StudentStatus;
    reward_points?: number;
    parent_phone_number_1?: string;
    parent_phone_number_2?: string;
    class_id?: number | null;
    arm_id?: number | null;
    address?: string;
    email?: string;
}

export interface PayrollUpdateData {
    base_salary?: number;
    bank_name?: string;
    account_number?: string;
    paystack_recipient_code?: string;
}

export interface CommunicationLogData {
    student_id: number;
    method: string;
    notes: string;
    communication_type?: string;
}

// ============================================
// Kudi SMS Integration Types
// ============================================

export type NotificationChannel = 'sms' | 'whatsapp' | 'both';

export type NotificationType = 
    'homework_reminder' | 
    'homework_missing' | 
    'notes_incomplete' | 
    'lesson_published' | 
    'payment_receipt' | 
    'attendance_present' | 
    'absentee_alert' | 
    'late_arrival' | 
    'subject_absentee' | 
    'subject_late' | 
    'report_card_ready' | 
    'emergency_broadcast' | 
    'general';

export interface NotificationChannelConfig {
    payment_receipt: NotificationChannel;
    homework_missing: NotificationChannel;
    homework_reminder: NotificationChannel;
    notes_incomplete: NotificationChannel;
    lesson_published: NotificationChannel;
    attendance_present: NotificationChannel;
    absentee_alert: NotificationChannel;
    late_arrival: NotificationChannel;
    subject_absentee: NotificationChannel;
    subject_late: NotificationChannel;
    report_card_ready: NotificationChannel;
    emergency_broadcast: NotificationChannel;
}

export interface WhatsAppTemplateCodes {
    payment_receipt?: string;
    homework_missing?: string;
    homework_reminder?: string;
    notes_incomplete?: string;
    lesson_published?: string;
    attendance_present?: string;
    absentee_alert?: string;
    late_arrival?: string;
    subject_absentee?: string;
    subject_late?: string;
    report_card_ready?: string;
    emergency_broadcast?: string;
}

export interface KudiSmsSettings {
    id: number;
    school_id: number;
    campus_id: number | null;
    token: string;
    sender_id: string;
    enable_fallback?: boolean;
    notification_channels?: NotificationChannelConfig | Record<string, 'sms' | 'whatsapp' | 'both'>;
    whatsapp_template_codes?: WhatsAppTemplateCodes | Record<string, string>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    campus?: { name: string };
}

export interface KudiSmsResponse {
    status: 'success' | 'error';
    status_msg: string;
    error_code: string;
    msg: string;
    length?: number;
    page?: number;
    initial_balance?: string;
    units_used?: string;
    current_balance?: string;
}

export interface KudiSmsRecipient {
    phone_number: string;
    name?: string;
}

export interface SmsMessageLog {
    id: number;
    school_id: number;
    recipient_phone: string;
    message_type: 'personalised' | 'auto_compose' | 'whatsapp';
    message_content: string;
    kudi_response?: Record<string, any>;
    status: 'pending' | 'sent' | 'failed';
    error_message?: string;
    channel?: 'sms' | 'whatsapp';
    fallback_used?: boolean;
    cost_units?: number;
    created_at: string;
    updated_at: string;
}

export interface ZeroScoreEntry {
    id: number;
    school_id: number;
    term_id: number;
    academic_class_id: number;
    subject_name: string;
    student_id: number;
    teacher_user_id: string | null;
    component_name: string | null;
    total_score: number;
    teacher_comment: string | null;
    entry_date: string;
    reviewed: boolean;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    created_at: string;
    // Populated fields from joins
    student?: Student;
    teacher?: UserProfile;
    academic_class?: AcademicClass;
    term?: Term;
}

// ============================================
// Lesson Plan Enhancement Types
// ============================================

export interface LessonPlanCoverage {
    id: number;
    lesson_plan_id: number;
    academic_class_id: number;
    arm_id: number;
    coverage_status: 'Pending' | 'Fully Covered' | 'Partially Covered' | 'Not Covered';
    coverage_percentage: number;
    topics_covered?: string;
    topics_pending?: string;
    notes?: string;
    covered_date?: string;
    created_at: string;
    updated_at: string;
}

export interface LearningMaterial {
    id: number;
    school_id: number;
    lesson_plan_id: number;
    title: string;
    description?: string;
    material_type: 'pdf' | 'video' | 'link' | 'document' | 'presentation';
    file_url?: string;
    external_url?: string;
    tags?: string[];
    is_shared: boolean;
    is_published: boolean;
    uploaded_by?: string;
    created_at: string;
    updated_at: string;
}

export interface StudentMaterialAccess {
    id: number;
    student_id: number;
    material_id: number;
    accessed_at: string;
}

export interface LessonPlanReview {
    id: number;
    lesson_plan_id: number;
    reviewer_id: string;
    review_status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
    feedback?: string;
    revision_notes?: string;
    reviewed_at: string;
    created_at: string;
    reviewer?: UserProfile;
}

export interface PublishedLessonPlan extends LessonPlan {
    published_at: string;
    published_by: string;
    publish_target: 'all' | 'class' | 'arm';
    materials?: string;
    material_items?: LearningMaterial[];
}

export interface Homework {
    id: number;
    school_id: number;
    lesson_plan_id?: number | null;
    teaching_assignment_id: number;
    academic_class_id: number;
    title: string;
    description?: string;
    instructions?: string;
    due_date: string;
    due_time?: string;
    max_score: number;
    is_graded: boolean;
    allow_late_submission: boolean;
    late_penalty_percent: number;
    status: 'active' | 'closed' | 'archived';
    notify_parents: boolean;
    created_by?: string;
    created_at: string;
    updated_at: string;
    teaching_assignment?: AcademicTeachingAssignment;
    academic_class?: AcademicClass;
    attachments?: HomeworkAttachment[];
}

export interface HomeworkAttachment {
    id: number;
    homework_id: number;
    file_url: string;
    file_name: string;
    file_type?: string;
    file_size?: number;
    uploaded_at: string;
}

export interface HomeworkSubmission {
    id: number;
    homework_id: number;
    student_id: number;
    submission_status: 'pending' | 'submitted' | 'late' | 'missing';
    submitted_at?: string;
    submission_text?: string;
    submission_files?: string[];
    score?: number;
    feedback?: string;
    graded_by?: string;
    graded_at?: string;
    created_at: string;
    updated_at: string;
    student?: Student;
}

export interface NotesCheck {
    id: number;
    school_id: number;
    teaching_assignment_id: number;
    academic_class_id: number;
    check_date: string;
    topic: string;
    checked_by?: string;
    created_at: string;
    teaching_assignment?: AcademicTeachingAssignment;
    academic_class?: AcademicClass;
}

export interface NotesCompliance {
    id: number;
    notes_check_id: number;
    student_id: number;
    status: 'complete' | 'incomplete' | 'partial';
    notes?: string;
    checked_at: string;
    student?: Student;
}

export interface SmsTemplate {
    id: number;
    school_id: number;
    template_name: string;
    message_content: string;
    variables?: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SmsNotification {
    id: number;
    school_id: number;
    student_id: number;
    recipient_phone: string;
    template_name?: string;
    message_content?: string;
    notification_type: NotificationType;
    reference_id?: number;
    status: 'pending' | 'sent' | 'failed';
    error_message?: string;
    sent_by?: string;
    sent_at?: string;
    created_at: string;
    student?: Student;
}

// Notification Types for Messaging System
// (alias retained above for backward compatibility)


// Statistics Dashboard Types
export interface StudentRanking {
    rank: number;
    student_id: number;
    student_name: string;
    admission_number?: string;
    class_name: string;
    arm_name: string;
    average_score: number;
    total_score: number;
    grade_label: string;
    position_in_class: number;
    position_change?: number; // Positive = moved up, negative = moved down, 0 = no change
}

export interface GradeDistribution {
    grade_label: string;
    count: number;
    percentage: number;
}

export interface ArmStatistics {
    arm_name: string;
    academic_class_id: number;
    student_count: number;
    average_score: number | null;
    highest_score: number | null;
    highest_scorer?: string;
    lowest_score: number;
    lowest_scorer?: string;
    pass_count: number;
    pass_rate: number | null;
    grade_distribution: GradeDistribution[];
}

export interface LevelStatistics {
    level: string; // e.g., "SS1", "JSS2"
    total_students: number;
    overall_average: number;
    highest_score: number;
    highest_scorer?: string;
    lowest_score: number;
    lowest_scorer?: string;
    pass_count: number;
    pass_rate: number;
    grade_distribution: GradeDistribution[];
    arms: ArmStatistics[];
}

// Absence Request Types
export type AbsenceRequestType = 'sick' | 'family' | 'appointment' | 'vacation' | 'other';
export type AbsenceRequestStatus = 'pending' | 'approved' | 'denied';

export interface AbsenceRequest {
    id: number;
    school_id: number;
    student_id: number;
    requested_by: string;
    request_type: AbsenceRequestType;
    start_date: string;
    end_date: string;
    reason: string;
    supporting_document_url?: string;
    status: AbsenceRequestStatus;
    reviewed_by?: string;
    reviewed_at?: string;
    review_notes?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    student?: Student;
    requester?: UserProfile;
    reviewer?: UserProfile;
}

// Student Strikes and Appeals
export type StrikeSeverity = 'Minor' | 'Major' | 'Severe';
export type StrikeAppealStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected';

export interface StudentStrike {
    id: number;
    student_id: number;
    school_id: number;
    reason: string;
    severity: StrikeSeverity;
    issued_by: string;
    issued_date: string;
    notes?: string;
    archived: boolean;
    created_at: string;
    updated_at: string;
    // Joined data
    student?: Student;
    issuer?: UserProfile;
    appeal?: StrikeAppeal;
}

export interface StrikeAppeal {
    id: number;
    strike_id: number;
    student_id: number;
    appeal_reason: string;
    supporting_details?: string;
    status: StrikeAppealStatus;
    reviewed_by?: string;
    reviewed_at?: string;
    review_notes?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    strike?: StudentStrike;
    student?: Student;
    reviewer?: UserProfile;
}

export interface StudentDashboardStats {
    attendancePercentage: number;
    pendingAssignments: number;
    totalStrikes: number;
    rewardPoints: number;
    pendingAbsenceRequests: number;
}

// Pension System Types
export type ContributionInputType = 'percentage' | 'fixed';

export interface StaffPension {
    id: number;
    user_id: string;
    school_id: number;
    is_enrolled: boolean;
    enrollment_date?: string;
    pension_provider?: string;
    pension_pin?: string;
    
    // Employee Contribution (always active when enrolled)
    employee_contribution_type: ContributionInputType;
    employee_contribution_value: number;
    
    // Employer Contribution (TOGGLE ON/OFF)
    employer_contribution_enabled: boolean;
    employer_contribution_type: ContributionInputType;
    employer_contribution_value: number;
    
    // Voluntary Contribution (TOGGLE ON/OFF)
    voluntary_contribution_enabled: boolean;
    voluntary_contribution_type: ContributionInputType;
    voluntary_contribution_value: number;
    
    // Preexisting Pension
    has_preexisting_pension: boolean;
    preexisting_pension_amount: number;
    preexisting_pension_months: number;
    preexisting_pension_provider?: string;
    preexisting_pension_pin?: string;
    preexisting_pension_transfer_date?: string;
    preexisting_pension_verified: boolean;
    
    created_at: string;
    updated_at: string;
}

export interface PensionContribution {
    id: number;
    staff_pension_id: number;
    payroll_run_id?: number;
    user_id: string;
    school_id: number;
    contribution_month: string; // Date string (first day of month)
    period_label: string; // e.g., 'December 2025'
    gross_salary: number;
    
    // Config snapshot at time of calculation
    employee_type: ContributionInputType;
    employee_value: number;
    employer_enabled: boolean;
    employer_type: ContributionInputType;
    employer_value: number;
    voluntary_enabled: boolean;
    voluntary_type: ContributionInputType;
    voluntary_value: number;
    
    // This month's amounts
    employee_contribution: number;
    employer_contribution: number;
    voluntary_contribution: number;
    total_contribution: number;
    deduction_from_salary: number; // employee + voluntary
    
    // Cumulative totals
    cumulative_employee: number;
    cumulative_employer: number;
    cumulative_voluntary: number;
    cumulative_total: number;
    
    // Month tracking
    month_number: number; // 1, 2, 3... excluding preexisting
    total_service_months: number; // including preexisting
    
    status: 'recorded' | 'remitted' | 'confirmed';
    remittance_reference?: string;
    remitted_at?: string;
    notes?: string;
    created_at: string;
}

export interface PensionCalculationResult {
    employeeContribution: number;
    employerContribution: number;
    voluntaryContribution: number;
    totalContribution: number;
    deductionFromSalary: number; // employee + voluntary
}

export interface PensionSummary {
    staffName: string;
    pensionProvider?: string;
    pensionPin?: string;
    isEnrolled: boolean;
    enrollmentDate?: string;
    
    // Preexisting pension
    hasPreexisting: boolean;
    preexistingAmount: number;
    preexistingMonths: number;
    
    // Current configuration
    employeeContributionType: ContributionInputType;
    employeeContributionValue: number;
    employerEnabled: boolean;
    employerContributionType: ContributionInputType;
    employerContributionValue: number;
    voluntaryEnabled: boolean;
    voluntaryContributionType: ContributionInputType;
    voluntaryContributionValue: number;
    
    // Totals
    totalMonthsContributed: number; // excluding preexisting
    totalServiceMonths: number; // including preexisting
    cumulativeEmployee: number;
    cumulativeEmployer: number;
    cumulativeVoluntary: number;
    cumulativeTotal: number;
    grandTotal: number; // cumulative + preexisting
    
    // Recent contributions
    recentContributions: PensionContribution[];
}
