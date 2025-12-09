-- ============================================
-- School Guardian 360 - Complete Database Schema
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================

-- SECTION 1: TABLES AND BASE STRUCTURE
-- Complete Database Schema for School Guardian 360
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Schools (Tenancy Root)
CREATE TABLE IF NOT EXISTS public.schools (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    secret_code TEXT UNIQUE NOT NULL DEFAULT 'UPSS-SECRET-2025',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branding JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    school_documents JSONB DEFAULT '{}',
    social_accounts JSONB DEFAULT '{}'
);

INSERT INTO public.schools (id, name, secret_code)
VALUES (1, 'University Preparatory Secondary School', 'UPSS-SECRET-2025')
ON CONFLICT (id) DO NOTHING;

-- 2) User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar_url TEXT,
    staff_code TEXT,
    phone_number TEXT,
    description TEXT,
    bank_code TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    base_pay NUMERIC DEFAULT 0,
    commission NUMERIC DEFAULT 0,
    campus_id INTEGER,
    has_seen_tour BOOLEAN DEFAULT FALSE,
    dashboard_config TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    permissions TEXT[],
    reporting_quota_days INTEGER,
    reporting_quota_count INTEGER,
    ai_analysis_focus TEXT,
    ai_routing_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_school_id_title_key') THEN
        ALTER TABLE public.roles ADD CONSTRAINT roles_school_id_title_key UNIQUE (school_id, title);
    END IF;
END $$;

INSERT INTO public.roles (school_id, title, description, permissions) VALUES
(1, 'Admin', 'System Administrator', ARRAY['*']),
(1, 'Principal', 'School Head', ARRAY['view-dashboard', 'view-all-reports', 'manage-users', 'manage-students', 'view-analytics', 'view-school-health-overview', 'manage-tasks', 'manage-announcements', 'view-teacher-ratings', 'view-ai-task-suggestions', 'view-at-risk-students', 'view-all-student-data', 'view-sensitive-reports']),
(1, 'Team Lead', 'Department Head', ARRAY['view-dashboard', 'submit-report', 'view-all-reports', 'assign-reports', 'comment-on-reports', 'manage-tasks', 'manage-curriculum', 'view-coverage-feedback']),
(1, 'Teacher', 'Classroom teacher', ARRAY['view-dashboard', 'submit-report', 'score_entries.edit_self', 'view-my-reports', 'view-my-classes', 'view-my-lesson-plans', 'view-my-coverage-feedback', 'take-class-attendance', 'view-curriculum-readonly']),
(1, 'Counselor', 'Student guidance', ARRAY['view-dashboard', 'submit-report', 'view-all-reports', 'manage-students', 'view-at-risk-students', 'view-sensitive-reports']),
(1, 'Accountant', 'Financial management', ARRAY['view-dashboard', 'manage-payroll', 'view-sms-balance', 'manage-finance', 'manage-orders']),
(1, 'School Secretary', 'Admin support', ARRAY['view-dashboard', 'submit-report', 'manage-calendar', 'manage-announcements']),
(1, 'IT Support', 'Tech support', ARRAY['view-dashboard', 'submit-report', 'manage-inventory']),
(1, 'Maintenance', 'Facility', ARRAY['view-dashboard', 'submit-report', 'manage-inventory']),
(1, 'Librarian', 'Library', ARRAY['view-dashboard', 'submit-report', 'manage-inventory']),
(1, 'Bookstore and Uniform Attendant', 'Store', ARRAY['view-dashboard', 'submit-report', 'manage-inventory', 'manage-orders']),
(1, 'Day care Administrator', 'Day care', ARRAY['view-dashboard', 'submit-report']),
(1, 'Social Media Manager', 'Social media', ARRAY['view-dashboard', 'manage-social-media', 'submit-report']),
(1, 'Guardian', 'Parent', ARRAY['view-dashboard']),
(1, 'Student', 'Student', ARRAY['view-dashboard'])
ON CONFLICT (school_id, title) DO NOTHING;

-- 4) User Role Assignments
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES public.roles(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);
-- Add school_id column if it doesn't exist (for existing deployments)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_role_assignments' AND column_name='school_id') THEN
        ALTER TABLE public.user_role_assignments ADD COLUMN school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add ai_analysis_focus and ai_routing_instructions columns to roles (for existing deployments)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='ai_analysis_focus') THEN
        ALTER TABLE public.roles ADD COLUMN ai_analysis_focus TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='ai_routing_instructions') THEN
        ALTER TABLE public.roles ADD COLUMN ai_routing_instructions TEXT;
    END IF;
END $$;

-- 5) Students & Profiles
CREATE TABLE IF NOT EXISTS public.students (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    admission_number TEXT,
    grade TEXT,
    class_id INTEGER,
    arm_id INTEGER,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL,
    date_of_birth DATE,
    parent_phone_number_1 TEXT,
    parent_phone_number_2 TEXT,
    address TEXT,
    email TEXT,
    status TEXT DEFAULT 'Active',
    reward_points INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='email') THEN
        ALTER TABLE public.students ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='campus_id') THEN
        ALTER TABLE public.students ADD COLUMN campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.student_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    student_record_id INTEGER REFERENCES public.students(id) ON DELETE SET NULL,
    class_id INTEGER,
    arm_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6) Academics Base (Dictionaries)
CREATE TABLE IF NOT EXISTS public.terms (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    session_label TEXT NOT NULL,
    term_label TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS public.subjects (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public.classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL
);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='campus_id') THEN
        ALTER TABLE public.classes ADD COLUMN campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL;
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.arms (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public.class_subjects (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    is_compulsory BOOLEAN DEFAULT FALSE,
    UNIQUE(class_id, subject_id)
);

-- 7) Academic Structure
CREATE TABLE IF NOT EXISTS public.assessment_structures (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    components JSONB DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS public.grading_schemes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    scheme_name TEXT NOT NULL,
    gpa_max NUMERIC
);
CREATE TABLE IF NOT EXISTS public.grading_scheme_rules (
    id SERIAL PRIMARY KEY,
    grading_scheme_id INTEGER REFERENCES public.grading_schemes(id) ON DELETE CASCADE,
    min_score NUMERIC,
    max_score NUMERIC,
    grade_label TEXT,
    gpa_value NUMERIC,
    remark TEXT
);
CREATE TABLE IF NOT EXISTS public.school_config (
    school_id INTEGER PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    display_name TEXT,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    motto TEXT,
    active_grading_scheme_id INTEGER REFERENCES public.grading_schemes(id) ON DELETE SET NULL,
    current_term_id INTEGER REFERENCES public.terms(id) ON DELETE SET NULL,
    term_weights JSONB DEFAULT '{"term1": 10, "term2": 10, "term3": 80}',
    student_id_prefix TEXT,
    staff_id_prefix TEXT,
    id_year_mode TEXT,
    pay_cycle TEXT DEFAULT 'monthly',
    late_checkin_deduction_percent NUMERIC,
    fine_early_checkout NUMERIC DEFAULT 0,
    fine_no_checkout NUMERIC DEFAULT 0
);
-- Ensure config exists
INSERT INTO public.school_config (school_id, display_name) VALUES (1, 'University Preparatory Secondary School') ON CONFLICT (school_id) DO NOTHING;

-- Update config table with new columns if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_config' AND column_name='fine_early_checkout') THEN
        ALTER TABLE public.school_config ADD COLUMN fine_early_checkout NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='school_config' AND column_name='fine_no_checkout') THEN
        ALTER TABLE public.school_config ADD COLUMN fine_no_checkout NUMERIC DEFAULT 0;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.academic_classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level TEXT,
    arm TEXT,
    session_label TEXT,
    assessment_structure_id INTEGER REFERENCES public.assessment_structures(id) ON DELETE SET NULL,
    grading_scheme_id INTEGER REFERENCES public.grading_schemes(id) ON DELETE SET NULL,
    report_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    min_subjects INTEGER DEFAULT NULL,
    max_subjects INTEGER DEFAULT NULL
);
CREATE TABLE IF NOT EXISTS public.teaching_assignments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_name TEXT,
    subject_group TEXT,
    teacher_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    max_ca_score NUMERIC,
    max_exam_score NUMERIC,
    is_locked BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE
);
CREATE TABLE IF NOT EXISTS public.academic_class_students (
    id SERIAL PRIMARY KEY,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    enrolled_term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    UNIQUE(academic_class_id, student_id, enrolled_term_id)
);
CREATE TABLE IF NOT EXISTS public.student_subject_choices (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    locked BOOLEAN DEFAULT FALSE,
    UNIQUE(student_id, subject_id)
);

-- 8) Assessments & Scores
CREATE TABLE IF NOT EXISTS public.score_entries (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_name TEXT,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    component_scores JSONB DEFAULT '{}',
    total_score NUMERIC,
    grade TEXT,
    teacher_comment TEXT,
    ca_score NUMERIC,
    exam_score NUMERIC,
    UNIQUE(term_id, academic_class_id, subject_name, student_id)
);
CREATE TABLE IF NOT EXISTS public.student_term_reports (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    average_score NUMERIC,
    total_score NUMERIC,
    position_in_class INTEGER,
    position_in_grade INTEGER,
    teacher_comment TEXT,
    principal_comment TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, term_id)
);
CREATE TABLE IF NOT EXISTS public.student_term_report_subjects (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES public.student_term_reports(id) ON DELETE CASCADE,
    subject_name TEXT,
    total_score NUMERIC,
    grade_label TEXT,
    remark TEXT,
    subject_position INTEGER
);
CREATE TABLE IF NOT EXISTS public.student_term_report_traits (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES public.student_term_reports(id) ON DELETE CASCADE,
    trait_name TEXT,
    rating INTEGER
);

CREATE TABLE IF NOT EXISTS public.assessments (
    id SERIAL PRIMARY KEY,
    teaching_assignment_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assessment_type TEXT,
    max_score NUMERIC,
    deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.assessment_scores (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assessment_id, student_id)
);

-- 9) Attendance & Staff Ops
CREATE TABLE IF NOT EXISTS public.campuses (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    geofence_lat NUMERIC,
    geofence_lng NUMERIC,
    geofence_radius_meters NUMERIC,
    paystack_secret_key TEXT,
    paystack_public_key TEXT,
    dva_provider TEXT DEFAULT 'titan-paystack'
);
CREATE TABLE IF NOT EXISTS public.teacher_checkins (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    checkin_date DATE,
    status TEXT,
    mood TEXT,
    energy INTEGER,
    notes TEXT,
    photo_url TEXT,
    geo_lat NUMERIC,
    geo_lng NUMERIC,
    checkout_time TIMESTAMP WITH TIME ZONE,
    checkout_notes TEXT,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.class_groups (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    description TEXT,
    group_type TEXT,
    teaching_entity_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.class_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES public.class_groups(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    UNIQUE(group_id, student_id)
);
CREATE TABLE IF NOT EXISTS public.attendance_schedules (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES public.class_group_members(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    start_time TIME,
    end_time TIME
);
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES public.class_group_members(id) ON DELETE CASCADE,
    schedule_id INTEGER REFERENCES public.attendance_schedules(id) ON DELETE SET NULL,
    session_date DATE,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Teaching Entities (Legacy support / alternative to teaching_assignments)
CREATE TABLE IF NOT EXISTS public.teaching_entities (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
    arm_id INTEGER REFERENCES public.arms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10) E-Commerce & Inventory
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    price NUMERIC DEFAULT 0,
    image_url TEXT,
    description TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.orders (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    payment_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    quantity INTEGER,
    unit_price NUMERIC
);
CREATE TABLE IF NOT EXISTS public.order_notes (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES public.orders(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11) Payroll & Finance
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    period_label TEXT,
    total_amount NUMERIC,
    status TEXT,
    transfer_code TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    meta JSONB
);
CREATE TABLE IF NOT EXISTS public.payroll_items (
    id SERIAL PRIMARY KEY,
    payroll_run_id INTEGER REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    gross_amount NUMERIC,
    deductions JSONB,
    net_amount NUMERIC,
    paystack_recipient_code TEXT,
    transfer_status TEXT,
    narration TEXT,
    payslip_url TEXT
);
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount NUMERIC,
    reason TEXT,
    adjustment_type TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    payroll_run_id INTEGER REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.paystack_recipients (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recipient_code TEXT NOT NULL,
    bank_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Fee Management
CREATE TABLE IF NOT EXISTS public.fee_items (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC DEFAULT 0,
    is_compulsory BOOLEAN DEFAULT TRUE,
    target_class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
    target_term_id INTEGER REFERENCES public.terms(id) ON DELETE SET NULL,
    allow_installments BOOLEAN DEFAULT FALSE,
    installments JSONB DEFAULT '[]',
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Add columns to existing fee_items table
ALTER TABLE public.fee_items ADD COLUMN IF NOT EXISTS allow_installments BOOLEAN DEFAULT FALSE;
ALTER TABLE public.fee_items ADD COLUMN IF NOT EXISTS installments JSONB DEFAULT '[]';
ALTER TABLE public.fee_items ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.student_invoices (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    invoice_number TEXT,
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Unpaid',
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES public.student_invoices(id) ON DELETE CASCADE,
    fee_item_id INTEGER REFERENCES public.fee_items(id) ON DELETE SET NULL,
    description TEXT,
    amount NUMERIC
);
CREATE TABLE IF NOT EXISTS public.payments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES public.student_invoices(id) ON DELETE SET NULL,
    amount NUMERIC,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_method TEXT,
    reference TEXT,
    recorded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12) HR Extra
CREATE TABLE IF NOT EXISTS public.leave_types (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    days_allowed INTEGER,
    requires_approval BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    leave_type_id INTEGER REFERENCES public.leave_types(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.teacher_shifts (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    start_time TIME,
    end_time TIME
);
CREATE TABLE IF NOT EXISTS public.holidays (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    date DATE,
    is_recurring BOOLEAN DEFAULT FALSE
);

-- 13) General & Comms
CREATE TABLE IF NOT EXISTS public.reports (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    report_text TEXT,
    report_type TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    involved_students INTEGER[],
    involved_staff TEXT[],
    tagged_users JSONB,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    response TEXT,
    analysis JSONB,
    parent_communication_draft TEXT,
    internal_summary_draft TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS public.report_comments (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES public.reports(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    comment_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.tasks (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ToDo',
    priority TEXT DEFAULT 'Medium',
    due_date DATE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    report_id INTEGER REFERENCES public.reports(id) ON DELETE SET NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_minutes_before INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.announcements (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_all_day BOOLEAN,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.communications_audit (
    id SERIAL PRIMARY KEY,
    recipients TEXT[],
    message_body TEXT,
    provider_message_id TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timetable System
CREATE TABLE IF NOT EXISTS public.timetable_periods (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    start_time TIME,
    end_time TIME,
    type TEXT DEFAULT 'lesson'
);
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    day_of_week TEXT,
    period_id INTEGER REFERENCES public.timetable_periods(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    room_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Timetable Locations (campus-specific)
CREATE TABLE IF NOT EXISTS public.timetable_locations (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capacity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Add location_id to timetable_entries
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timetable_entries' AND column_name = 'location_id') THEN
        ALTER TABLE public.timetable_entries ADD COLUMN location_id INTEGER REFERENCES public.timetable_locations(id) ON DELETE SET NULL;
    END IF;
END $$;
-- Unique constraints for timetable to prevent double booking
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_teacher_slot') THEN
        ALTER TABLE public.timetable_entries ADD CONSTRAINT unique_teacher_slot UNIQUE (term_id, day_of_week, period_id, teacher_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_class_slot') THEN
        ALTER TABLE public.timetable_entries ADD CONSTRAINT unique_class_slot UNIQUE (term_id, day_of_week, period_id, academic_class_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_location_slot') THEN
        ALTER TABLE public.timetable_entries ADD CONSTRAINT unique_location_slot UNIQUE (term_id, day_of_week, period_id, location_id);
    END IF;
END $$;

-- 14) Quizzes & Surveys
CREATE TABLE IF NOT EXISTS public.quizzes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    audience JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT,
    question_type TEXT,
    position INTEGER,
    options JSONB
);
CREATE TABLE IF NOT EXISTS public.quiz_responses (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    selected_option_index INTEGER,
    ranking_value INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15) Other Modules
CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teaching_entity_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    week_start_date DATE,
    title TEXT,
    plan_type TEXT DEFAULT 'structured',
    objectives TEXT,
    materials TEXT,
    activities TEXT,
    assessment_methods TEXT,
    freeform_content TEXT,
    file_url TEXT,
    submission_status TEXT DEFAULT 'Pending',
    coverage_status TEXT DEFAULT 'Pending',
    coverage_notes TEXT,
    status TEXT DEFAULT 'draft',
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ai_analysis JSONB
);
CREATE TABLE IF NOT EXISTS public.curriculum (
    id SERIAL PRIMARY KEY,
    teaching_entity_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.curriculum_weeks (
    id SERIAL PRIMARY KEY,
    curriculum_id INTEGER REFERENCES public.curriculum(id) ON DELETE CASCADE,
    week_number INTEGER,
    expected_topics TEXT
);
CREATE TABLE IF NOT EXISTS public.lesson_plan_coverage_votes (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    vote BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.teams (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    lead_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.team_assignments (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.team_feedback (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES public.teams(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start_date DATE,
    rating INTEGER,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.living_policy_snippets (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    content TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.student_intervention_plans (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    goals TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.sip_logs (
    id SERIAL PRIMARY KEY,
    sip_id INTEGER REFERENCES public.student_intervention_plans(id) ON DELETE CASCADE,
    log_entry TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.positive_behavior (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    description TEXT,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.student_awards (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    award_type TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.staff_awards (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recipient_name TEXT,
    reason TEXT,
    source_report_ids INTEGER[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.rewards_store_items (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT,
    description TEXT,
    cost INTEGER,
    stock INTEGER,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    reward_item_id INTEGER REFERENCES public.rewards_store_items(id) ON DELETE SET NULL,
    cost INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.audit_log (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.teacher_ratings (
    id SERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start DATE,
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, teacher_id, week_start)
);
CREATE TABLE IF NOT EXISTS public.teacher_rating_weekly (
    id SERIAL PRIMARY KEY,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    week_start DATE,
    rating_count INTEGER,
    weighted_avg NUMERIC,
    low_count INTEGER,
    spotlight BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Views
CREATE OR REPLACE VIEW public.v_teacher_ratings_masked AS
SELECT
    tr.id,
    tr.teacher_id,
    tr.week_start,
    tr.rating,
    tr.comment,
    'Student ' || substr(md5(tr.student_id::text), 1, 6) as student_handle,
    tr.created_at
FROM public.teacher_ratings tr;

-- Safe Drop/Create of Materialized View
DO $$
DECLARE
    r_kind "char";
BEGIN
    SELECT relkind INTO r_kind
    FROM pg_class
    JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
    WHERE pg_class.relname = 'mv_public_teacher_leaderboard_current_week'
      AND pg_namespace.nspname = 'public';

    IF r_kind = 'v' THEN
        EXECUTE 'DROP VIEW public.mv_public_teacher_leaderboard_current_week CASCADE';
    ELSIF r_kind = 'm' THEN
        EXECUTE 'DROP MATERIALIZED VIEW public.mv_public_teacher_leaderboard_current_week CASCADE';
    END IF;
END $$;

CREATE MATERIALIZED VIEW public.mv_public_teacher_leaderboard_current_week AS
SELECT
    u.id as teacher_id,
    u.name as teacher_name,
    COALESCE(w.weighted_avg, 0) as weighted_avg,
    COALESCE(w.rating_count, 0) as rating_count,
    w.spotlight,
    RANK() OVER (ORDER BY COALESCE(w.weighted_avg, 0) DESC) as rank_overall
FROM public.user_profiles u
LEFT JOIN public.teacher_rating_weekly w ON u.id = w.teacher_id AND w.week_start = date_trunc('week', CURRENT_DATE)::date
WHERE u.role = 'Teacher' OR u.role = 'Team Lead';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_current ON public.mv_public_teacher_leaderboard_current_week (teacher_id);

CREATE OR REPLACE FUNCTION public.refresh_public_leaderboard_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_public_teacher_leaderboard_current_week;
END;
$$ LANGUAGE plpgsql;


-- Trigger: Handle User Creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
    user_type TEXT;
    skip_student_creation BOOLEAN;
    new_student_id INTEGER;
BEGIN
    user_type := new.raw_user_meta_data->>'user_type';
    skip_student_creation := (new.raw_user_meta_data->>'skip_student_creation')::boolean;

    IF user_type = 'student' THEN
        IF skip_student_creation IS NOT TRUE THEN
            -- First, create the student record in students table
            INSERT INTO public.students (school_id, name, user_id, status)
            VALUES (
                COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
                COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
                new.id,
                'Active'
            )
            RETURNING id INTO new_student_id;
            
            -- Then create student_profiles with the student_record_id populated
            INSERT INTO public.student_profiles (id, full_name, school_id, class_id, arm_id, student_record_id)
            VALUES (
                new.id,
                COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
                COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
                (new.raw_user_meta_data->>'class_id')::int,
                (new.raw_user_meta_data->>'arm_id')::int,
                new_student_id
            ) ON CONFLICT (id) DO NOTHING;
        ELSE
            -- If skip_student_creation is TRUE, just create the profile without student_record_id
            -- The student_record_id will be set later when linking to an existing student
            INSERT INTO public.student_profiles (id, full_name, school_id, class_id, arm_id)
            VALUES (
                new.id,
                COALESCE(new.raw_user_meta_data->>'name', 'New Student'),
                COALESCE((new.raw_user_meta_data->>'school_id')::int, 1),
                (new.raw_user_meta_data->>'class_id')::int,
                (new.raw_user_meta_data->>'arm_id')::int
            ) ON CONFLICT (id) DO NOTHING;
        END IF;

    ELSIF user_type = 'staff' OR user_type IS NULL THEN
        SELECT count(*) = 0 INTO is_first_user FROM public.user_profiles;

        INSERT INTO public.user_profiles (id, school_id, name, email, role)
        VALUES (
            new.id,
            1,
            COALESCE(new.raw_user_meta_data->>'name', new.email),
            new.email,
            CASE WHEN is_first_user THEN 'Admin' ELSE 'Teacher' END
        ) ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function: Handle auth user deletion
-- This ensures that when a student's auth account is deleted,
-- the student record's user_id is properly set to NULL
CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- When an auth user is deleted, update the students table to set user_id to NULL
    -- This ensures students remain in the roster but without login credentials
    UPDATE public.students
    SET user_id = NULL
    WHERE user_id = OLD.id;
    
    -- Note: student_profiles will be automatically deleted by CASCADE
    -- due to the foreign key constraint: REFERENCES auth.users(id) ON DELETE CASCADE
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users deletion
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deletion();

-- Function: Compute Ratings
CREATE OR REPLACE FUNCTION public.compute_teacher_rating_week_current()
RETURNS void AS $$
DECLARE
    week_start_date date;
BEGIN
    week_start_date := date_trunc('week', CURRENT_DATE)::date;
    
    DELETE FROM public.teacher_rating_weekly WHERE week_start = week_start_date;

    INSERT INTO public.teacher_rating_weekly (teacher_id, week_start, rating_count, weighted_avg, low_count, spotlight)
    SELECT
        teacher_id,
        week_start,
        count(*),
        avg(rating),
        count(*) FILTER (WHERE rating <= 2),
        (avg(rating) >= 4.5 AND count(*) >= 5)
    FROM public.teacher_ratings
    WHERE week_start = week_start_date
    GROUP BY teacher_id, week_start;
END;
$$ LANGUAGE plpgsql;

-- Policies (Non-destructive)
-- SKIP tables that have specific policy overrides below (student_profiles, students, user_profiles, schools, class_groups, etc.)
DO $$
DECLARE
    t text;
    skip_tables text[] := ARRAY['student_profiles', 'students', 'user_profiles', 'schools', 'class_groups', 'class_group_members', 'attendance_schedules', 'teacher_checkins'];
BEGIN
    -- FIX: Only select BASE TABLES to avoid "cannot be performed on relation" errors for views
    FOR t IN
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        -- Enable RLS on ALL tables
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

        -- Skip tables that have specific policy overrides defined below
        IF t = ANY(skip_tables) THEN
            CONTINUE;
        END IF;

        -- Read Policy (Check existence)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = format('Auth read %s', t)) THEN
             EXECUTE format('CREATE POLICY "Auth read %I" ON %I FOR SELECT TO authenticated USING (true)', t, t);
        END IF;
        
        -- Write Policy (Check existence)
        IF t IN ('reports', 'tasks', 'announcements', 'inventory_items', 'attendance_records', 'leave_requests', 'score_entries', 'orders', 'order_items', 'order_notes', 'team_feedback', 'report_comments', 'lesson_plans', 'quiz_responses', 'student_intervention_plans', 'sip_logs', 'student_invoices', 'payments', 'timetable_entries', 'timetable_periods', 'holidays', 'teacher_shifts', 'student_subject_choices', 'class_subjects', 'roles', 'user_role_assignments', 'assessment_structures', 'grading_schemes', 'grading_scheme_rules', 'school_config', 'academic_classes', 'terms', 'student_awards', 'staff_awards', 'audit_log') THEN
             IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = format('Auth write %s', t)) THEN
                 EXECUTE format('CREATE POLICY "Auth write %I" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
             END IF;
        END IF;
    END LOOP;
END $$;

-- Specific Policy Overrides (Force recreate to ensure correct permissions)
-- NOTE: These run AFTER the generic loop, so we MUST drop the "Auth read/write" policies created by the loop
DO $$
BEGIN
    -- ============================================================================
    -- USER_PROFILES: Drop ALL possible policies first, then create clean ones
    -- ============================================================================
    DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users update profiles policy" ON public.user_profiles;
    DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;
    DROP POLICY IF EXISTS "Auth read user_profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Auth write user_profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
    DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
    DROP POLICY IF EXISTS "user_profiles_delete_policy" ON public.user_profiles;
    
    CREATE POLICY "user_profiles_select_policy" ON public.user_profiles FOR SELECT TO authenticated USING (true);
    CREATE POLICY "user_profiles_insert_policy" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "user_profiles_update_policy" ON public.user_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "user_profiles_delete_policy" ON public.user_profiles FOR DELETE TO authenticated USING (true);
    
    -- ============================================================================
    -- SCHOOLS: Public view
    -- ============================================================================
    DROP POLICY IF EXISTS "Public view schools" ON public.schools;
    DROP POLICY IF EXISTS "Auth read schools" ON public.schools;
    CREATE POLICY "Public view schools" ON public.schools FOR SELECT USING (true);
    
    -- ============================================================================
    -- STUDENT_PROFILES: Critical - fixes vanishing records issue
    -- ============================================================================
    DROP POLICY IF EXISTS "student_profiles_select_policy" ON public.student_profiles;
    DROP POLICY IF EXISTS "student_profiles_insert_policy" ON public.student_profiles;
    DROP POLICY IF EXISTS "student_profiles_update_policy" ON public.student_profiles;
    DROP POLICY IF EXISTS "student_profiles_delete_policy" ON public.student_profiles;
    DROP POLICY IF EXISTS "Auth read student_profiles" ON public.student_profiles;
    DROP POLICY IF EXISTS "Auth write student_profiles" ON public.student_profiles;
    DROP POLICY IF EXISTS "Students update profiles policy" ON public.student_profiles;
    DROP POLICY IF EXISTS "Students update own profile" ON public.student_profiles;
    DROP POLICY IF EXISTS "student_profiles_all_policy" ON public.student_profiles;
    
    -- Use simple USING(true) policies - no complex conditions
    CREATE POLICY "student_profiles_select_policy" ON public.student_profiles FOR SELECT TO authenticated USING (true);
    CREATE POLICY "student_profiles_insert_policy" ON public.student_profiles FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "student_profiles_update_policy" ON public.student_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "student_profiles_delete_policy" ON public.student_profiles FOR DELETE TO authenticated USING (true);
    
    -- ============================================================================
    -- STUDENTS: Critical - fixes profile update issues
    -- ============================================================================
    DROP POLICY IF EXISTS "students_select_policy" ON public.students;
    DROP POLICY IF EXISTS "students_insert_policy" ON public.students;
    DROP POLICY IF EXISTS "students_update_policy" ON public.students;
    DROP POLICY IF EXISTS "students_delete_policy" ON public.students;
    DROP POLICY IF EXISTS "Auth read students" ON public.students;
    DROP POLICY IF EXISTS "Auth write students" ON public.students;
    DROP POLICY IF EXISTS "students_all_policy" ON public.students;
    
    CREATE POLICY "students_select_policy" ON public.students FOR SELECT TO authenticated USING (true);
    CREATE POLICY "students_insert_policy" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "students_update_policy" ON public.students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "students_delete_policy" ON public.students FOR DELETE TO authenticated USING (true);
    
    -- Force drop and recreate class_groups policies (to ensure they work)
    DROP POLICY IF EXISTS "class_groups_select_policy" ON public.class_groups;
    DROP POLICY IF EXISTS "class_groups_insert_policy" ON public.class_groups;
    DROP POLICY IF EXISTS "class_groups_update_policy" ON public.class_groups;
    DROP POLICY IF EXISTS "class_groups_delete_policy" ON public.class_groups;
    DROP POLICY IF EXISTS "Auth read class_groups" ON public.class_groups;
    DROP POLICY IF EXISTS "Auth write class_groups" ON public.class_groups;
    
    CREATE POLICY "class_groups_select_policy" ON public.class_groups FOR SELECT TO authenticated USING (true);
    CREATE POLICY "class_groups_insert_policy" ON public.class_groups FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "class_groups_update_policy" ON public.class_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "class_groups_delete_policy" ON public.class_groups FOR DELETE TO authenticated USING (true);
    
    -- Force drop and recreate class_group_members policies
    DROP POLICY IF EXISTS "class_group_members_select_policy" ON public.class_group_members;
    DROP POLICY IF EXISTS "class_group_members_insert_policy" ON public.class_group_members;
    DROP POLICY IF EXISTS "class_group_members_update_policy" ON public.class_group_members;
    DROP POLICY IF EXISTS "class_group_members_delete_policy" ON public.class_group_members;
    DROP POLICY IF EXISTS "Auth read class_group_members" ON public.class_group_members;
    DROP POLICY IF EXISTS "Auth write class_group_members" ON public.class_group_members;
    
    CREATE POLICY "class_group_members_select_policy" ON public.class_group_members FOR SELECT TO authenticated USING (true);
    CREATE POLICY "class_group_members_insert_policy" ON public.class_group_members FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "class_group_members_update_policy" ON public.class_group_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "class_group_members_delete_policy" ON public.class_group_members FOR DELETE TO authenticated USING (true);
    
    -- Force drop and recreate attendance_schedules policies
    DROP POLICY IF EXISTS "attendance_schedules_select_policy" ON public.attendance_schedules;
    DROP POLICY IF EXISTS "attendance_schedules_insert_policy" ON public.attendance_schedules;
    DROP POLICY IF EXISTS "attendance_schedules_update_policy" ON public.attendance_schedules;
    DROP POLICY IF EXISTS "attendance_schedules_delete_policy" ON public.attendance_schedules;
    DROP POLICY IF EXISTS "Auth read attendance_schedules" ON public.attendance_schedules;
    DROP POLICY IF EXISTS "Auth write attendance_schedules" ON public.attendance_schedules;
    
    CREATE POLICY "attendance_schedules_select_policy" ON public.attendance_schedules FOR SELECT TO authenticated USING (true);
    CREATE POLICY "attendance_schedules_insert_policy" ON public.attendance_schedules FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "attendance_schedules_update_policy" ON public.attendance_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "attendance_schedules_delete_policy" ON public.attendance_schedules FOR DELETE TO authenticated USING (true);

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_config' AND policyname = 'Public view config') THEN
        CREATE POLICY "Public view config" ON public.school_config FOR SELECT USING (true);
    END IF;
    
    -- Teacher checkins: Users can only see their own records, unless they are Admin/Principal/Team Lead
    -- First drop the generic read policy if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_checkins' AND policyname = 'Auth read teacher_checkins') THEN
        DROP POLICY "Auth read teacher_checkins" ON public.teacher_checkins;
    END IF;
    
    -- Create policy: Users see own checkins, Admins/Principals/Team Leads see all
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_checkins' AND policyname = 'Teacher checkins read policy') THEN
        CREATE POLICY "Teacher checkins read policy" ON public.teacher_checkins FOR SELECT USING (
            teacher_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() 
                AND role IN ('Admin', 'Principal', 'Team Lead')
            )
        );
    END IF;
END $$;

-- Include the fix function


-- Include the dictionary fix


-- Include Quiz RPCs




-- SECTION 2: ADDITIONAL FUNCTIONS
DROP FUNCTION IF EXISTS public.get_daily_teacher_attendance(date,integer) CASCADE;
CREATE OR REPLACE FUNCTION public.get_daily_teacher_attendance(p_date date, p_campus_id int DEFAULT NULL)
RETURNS TABLE (
    teacher_id uuid,
    teacher_name text,
    teacher_role text,
    campus_name text,
    status text,
    checkin_time timestamptz,
    checkout_time timestamptz,
    notes text,
    photo_url text,
    is_late boolean,
    on_time boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as teacher_id,
        u.name as teacher_name,
        u.role as teacher_role,
        COALESCE(c.name, 'Main Campus') as campus_name,
        tc.status,
        tc.created_at as checkin_time,
        tc.checkout_time,
        tc.notes,
        tc.photo_url,
        CASE WHEN tc.status = 'Late' THEN true ELSE false END as is_late,
        CASE WHEN tc.status = 'Present' THEN true ELSE false END as on_time
    FROM public.user_profiles u
    LEFT JOIN public.campuses c ON u.campus_id = c.id
    LEFT JOIN public.teacher_checkins tc ON u.id = tc.teacher_id AND date(tc.checkin_date) = p_date
    WHERE (u.role = 'Teacher' OR u.role = 'Team Lead')
    AND (p_campus_id IS NULL OR u.campus_id = p_campus_id);
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.get_user_campus_geofence(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_campus_geofence(p_user_id uuid)
RETURNS TABLE (
    user_name text,
    user_campus_id int,
    campus_name text,
    geofence_lat numeric,
    geofence_lng numeric,
    geofence_radius_meters numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.name as user_name,
        u.campus_id as user_campus_id,
        c.name as campus_name,
        c.geofence_lat,
        c.geofence_lng,
        c.geofence_radius_meters
    FROM public.user_profiles u
    LEFT JOIN public.campuses c ON u.campus_id = c.id
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.submit_quiz_answers(jsonb) CASCADE;
CREATE OR REPLACE FUNCTION public.submit_quiz_answers(p_answers JSONB)
RETURNS VOID AS $$
DECLARE
    answer_record JSONB;
    q_id INT;
    qz_id INT;
BEGIN
    FOR answer_record IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        q_id := (answer_record->>'question_id')::INT;
        SELECT quiz_id INTO qz_id FROM public.quiz_questions WHERE id = q_id;
        
        INSERT INTO public.quiz_responses (quiz_id, user_id, question_id, answer_text, selected_option_index, ranking_value)
        VALUES (
            qz_id,
            auth.uid(),
            q_id,
            answer_record->>'answer_text',
            (answer_record->>'selected_option')::INT,
            (answer_record->>'ranking_value')::INT
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.get_quiz_results(integer) CASCADE;
CREATE OR REPLACE FUNCTION public.get_quiz_results(p_quiz_id INT)
RETURNS TABLE (
    question_id INT,
    question_text TEXT,
    question_type TEXT,
    results JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.question_text,
        q.question_type,
        CASE 
            WHEN q.question_type = 'multiple_choice' OR q.question_type = 'true_false' THEN
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'option_text', opt->>'text', 
                            'count', (SELECT COUNT(*) FROM public.quiz_responses r WHERE r.question_id = q.id AND r.selected_option_index = (idx::int - 1))
                        )
                    )
                    FROM jsonb_array_elements(q.options) WITH ORDINALITY AS o(opt, idx)
                )
            WHEN q.question_type = 'ranking' THEN
                jsonb_build_object(
                    'average', (SELECT AVG(ranking_value) FROM public.quiz_responses r WHERE r.question_id = q.id),
                    'distribution', (
                        SELECT jsonb_object_agg(rv, cnt)
                        FROM (
                            SELECT ranking_value as rv, COUNT(*) as cnt 
                            FROM public.quiz_responses r 
                            WHERE r.question_id = q.id 
                            GROUP BY ranking_value
                        ) t
                    )
                )
            WHEN q.question_type = 'short_answer' THEN
                 (SELECT jsonb_agg(answer_text) FROM public.quiz_responses r WHERE r.question_id = q.id AND answer_text IS NOT NULL)
            ELSE NULL
        END
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.get_detailed_quiz_responses(integer) CASCADE;
CREATE OR REPLACE FUNCTION public.get_detailed_quiz_responses(p_quiz_id INT)
RETURNS TABLE (
    student_name TEXT,
    student_id UUID,
    question_id INT,
    question_text TEXT,
    response_value TEXT,
    response_timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(u.name, 'Anonymous'),
        r.user_id,
        r.question_id,
        q.question_text,
        CASE 
            WHEN r.answer_text IS NOT NULL THEN r.answer_text
            WHEN r.selected_option_index IS NOT NULL THEN (q.options->r.selected_option_index)->>'text'
            WHEN r.ranking_value IS NOT NULL THEN r.ranking_value::TEXT
            ELSE ''
        END,
        r.created_at
    FROM public.quiz_responses r
    LEFT JOIN public.user_profiles u ON r.user_id = u.id
    JOIN public.quiz_questions q ON r.question_id = q.id
    WHERE r.quiz_id = p_quiz_id
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.get_student_term_report_details(integer, integer) CASCADE;
CREATE OR REPLACE FUNCTION public.get_student_term_report_details(p_student_id INT, p_term_id INT)
RETURNS JSONB AS $$
DECLARE
    v_student JSONB;
    v_term JSONB;
    v_school_config JSONB;
    v_subjects JSONB;
    v_report_row public.student_term_reports%ROWTYPE;
    v_attendance JSONB;
    v_student_level TEXT;
    v_session_label TEXT;
    v_grade_level_position INTEGER;
    v_grade_level_size INTEGER;
BEGIN
    -- 1. Student Info
    SELECT jsonb_build_object('id', s.id, 'fullName', s.name, 'className', c.name)
    INTO v_student
    FROM public.students s
    LEFT JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id;

    -- 2. Term Info
    SELECT jsonb_build_object('sessionLabel', session_label, 'termLabel', term_label)
    INTO v_term
    FROM public.terms WHERE id = p_term_id;

    -- 3. Config
    SELECT to_jsonb(sc.*) INTO v_school_config
    FROM public.school_config sc LIMIT 1;

    -- 4. Report Meta
    SELECT * INTO v_report_row
    FROM public.student_term_reports
    WHERE student_id = p_student_id AND term_id = p_term_id;

    -- 4.5. Get student's grade level and session for position calculations
    SELECT ac.level, ac.session_label
    INTO v_student_level, v_session_label
    FROM public.score_entries se
    JOIN public.academic_classes ac ON se.academic_class_id = ac.id
    WHERE se.student_id = p_student_id AND se.term_id = p_term_id
    LIMIT 1;

    -- 5. Subjects (from score_entries) with grade level-based position
    SELECT jsonb_agg(jsonb_build_object(
        'subjectName', se.subject_name,
        'componentScores', COALESCE(se.component_scores, '{}'::jsonb),
        'totalScore', se.total_score,
        'gradeLabel', se.grade,
        'remark', COALESCE(se.teacher_comment, '-'),
        'subjectPosition', (
            SELECT COUNT(*) + 1 
            FROM public.score_entries se2 
            JOIN public.academic_classes ac2 ON se2.academic_class_id = ac2.id
            WHERE se2.term_id = p_term_id 
              AND se2.subject_name = se.subject_name 
              AND se2.total_score > se.total_score
              AND ac2.level = v_student_level
              AND ac2.session_label = v_session_label
        )
    ))
    INTO v_subjects
    FROM public.score_entries se
    WHERE se.student_id = p_student_id AND se.term_id = p_term_id;

    -- 5.5. Calculate grade level position (across all arms)
    SELECT COUNT(*) + 1 INTO v_grade_level_position
    FROM public.student_term_reports str
    JOIN public.score_entries se ON str.student_id = se.student_id AND str.term_id = se.term_id
    JOIN public.academic_classes ac ON se.academic_class_id = ac.id
    WHERE str.term_id = p_term_id
      AND ac.level = v_student_level
      AND ac.session_label = v_session_label
      AND str.average_score > v_report_row.average_score;

    -- 5.6. Calculate grade level size
    SELECT COUNT(DISTINCT str.student_id) INTO v_grade_level_size
    FROM public.student_term_reports str
    JOIN public.score_entries se ON str.student_id = se.student_id AND str.term_id = se.term_id
    JOIN public.academic_classes ac ON se.academic_class_id = ac.id
    WHERE str.term_id = p_term_id
      AND ac.level = v_student_level
      AND ac.session_label = v_session_label;

    -- 6. Attendance (Mock for now or aggregate)
    v_attendance := jsonb_build_object('present', 0, 'possible', 0);

    RETURN jsonb_build_object(
        'student', v_student,
        'term', v_term,
        'schoolConfig', v_school_config,
        'subjects', COALESCE(v_subjects, '[]'::jsonb),
        'summary', jsonb_build_object(
            'average', v_report_row.average_score,
            'positionInArm', v_report_row.position_in_class,
            'positionInGradeLevel', COALESCE(v_grade_level_position, v_report_row.position_in_grade),
            'gradeLevelSize', v_grade_level_size,
            'gpaAverage', 0
        ),
        'attendance', v_attendance,
        'comments', jsonb_build_object(
            'teacher', v_report_row.teacher_comment,
            'principal', v_report_row.principal_comment
        )
    );
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.search_teachers_public(text, text) CASCADE;
CREATE OR REPLACE FUNCTION public.search_teachers_public(q text, p_class_name text)
RETURNS SETOF public.mv_public_teacher_leaderboard_current_week AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.mv_public_teacher_leaderboard_current_week
    WHERE (q IS NULL OR teacher_name ILIKE '%' || q || '%')
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.teacher_comments_public(uuid, int, int) CASCADE;
CREATE OR REPLACE FUNCTION public.teacher_comments_public(p_teacher_id uuid, p_limit int, p_offset int)
RETURNS TABLE (
    id int,
    teacher_id uuid,
    week_start date,
    rating int,
    comment text,
    student_handle text,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.teacher_id,
        t.week_start,
        t.rating,
        t.comment,
        t.student_handle,
        t.created_at
    FROM public.v_teacher_ratings_masked t
    WHERE t.teacher_id = p_teacher_id
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.get_student_initial_password(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_student_initial_password(p_student_user_id uuid)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    -- Query the auth.users table to get user_metadata
    SELECT raw_user_meta_data->>'initial_password'
    INTO result
    FROM auth.users
    WHERE id = p_student_user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECTION 3: COLUMN ADDITIONS AND POLICY UPDATES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'Public can view subjects') THEN
        CREATE POLICY "Public can view subjects" ON public.subjects FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'classes' AND policyname = 'Public can view classes') THEN
        CREATE POLICY "Public can view classes" ON public.classes FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'arms' AND policyname = 'Public can view arms') THEN
        CREATE POLICY "Public can view arms" ON public.arms FOR SELECT USING (true);
    END IF;

    -- Add new columns for Subject Limits on Academic Classes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_classes' AND column_name='min_subjects') THEN
        ALTER TABLE public.academic_classes ADD COLUMN min_subjects INTEGER DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_classes' AND column_name='max_subjects') THEN
        ALTER TABLE public.academic_classes ADD COLUMN max_subjects INTEGER DEFAULT NULL;
    END IF;

    -- Add compulsory flag to class_subjects
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='class_subjects' AND column_name='is_compulsory') THEN
        ALTER TABLE public.class_subjects ADD COLUMN is_compulsory BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add archived flag to reports for strike resetting
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reports' AND column_name='archived') THEN
        ALTER TABLE public.reports ADD COLUMN archived BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add social_accounts to schools for the Social Media Hub
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='social_accounts') THEN
        ALTER TABLE public.schools ADD COLUMN social_accounts JSONB DEFAULT '{}';
    END IF;
    
    -- Update Math and English to be compulsory by default (for demonstration)
    UPDATE public.class_subjects 
    SET is_compulsory = true 
    WHERE subject_id IN (
        SELECT id FROM public.subjects WHERE name ILIKE '%Mathematics%' OR name ILIKE '%English%'
    );
END $$;

-- SECTION 4: SEED DATA
INSERT INTO public.classes (name) VALUES 
('JSS 1'), ('JSS 2'), ('JSS 3'),
('SS 1'), ('SS 2'), ('SS 3')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.arms (name) VALUES 
('Gold'), ('Silver'), ('Diamond'), ('Blue'), ('Red')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.subjects (name) VALUES 
('Mathematics'), ('English Language'), ('Basic Science'), ('Civic Education'), ('ICT')
ON CONFLICT (name) DO NOTHING;

-- SECTION 4.5: DEDICATED VIRTUAL ACCOUNTS (DVA) FOR PAYSTACK
-- Paystack API settings per campus
CREATE TABLE IF NOT EXISTS public.paystack_api_settings (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    campus_id INTEGER REFERENCES public.campuses(id) ON DELETE CASCADE,
    secret_key TEXT NOT NULL, -- Store encrypted
    public_key TEXT,
    environment TEXT DEFAULT 'test' CHECK (environment IN ('test', 'live')),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, campus_id)
);

-- Enable RLS on paystack_api_settings
ALTER TABLE public.paystack_api_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins and accountants can view/manage API settings
DROP POLICY IF EXISTS "Admins can manage paystack settings" ON public.paystack_api_settings;
CREATE POLICY "Admins can manage paystack settings" ON public.paystack_api_settings
FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'Admin' OR role = 'Accountant')
    )
);

-- Dedicated Virtual Accounts table
CREATE TABLE IF NOT EXISTS public.dedicated_virtual_accounts (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    bank_slug TEXT NOT NULL,
    bank_id INTEGER NOT NULL,
    currency TEXT DEFAULT 'NGN',
    active BOOLEAN DEFAULT true,
    assigned BOOLEAN DEFAULT true,
    paystack_account_id INTEGER, -- Reference to Paystack's DVA ID
    paystack_customer_id INTEGER, -- Reference to Paystack's customer ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id)
);

-- Enable RLS on dedicated_virtual_accounts
ALTER TABLE public.dedicated_virtual_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own DVA
DROP POLICY IF EXISTS "Students can view own DVA" ON public.dedicated_virtual_accounts;
CREATE POLICY "Students can view own DVA" ON public.dedicated_virtual_accounts
FOR SELECT
USING (
    student_id IN (
        SELECT student_record_id FROM public.student_profiles
        WHERE id = auth.uid()
    )
);

-- Policy: Staff can view and manage DVAs
DROP POLICY IF EXISTS "Staff can manage DVAs" ON public.dedicated_virtual_accounts;
CREATE POLICY "Staff can manage DVAs" ON public.dedicated_virtual_accounts
FOR ALL
USING (
    school_id IN (
        SELECT school_id FROM public.user_profiles
        WHERE id = auth.uid()
    )
);

-- SECTION 5: STORAGE BUCKETS (Optional - requires storage schema)
-- Note: These may fail if storage.buckets table doesn't exist in your database
-- You can safely ignore errors for this section or run these in Supabase Dashboard > Storage manually
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('report_images', 'report_images', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('attendance_photos', 'attendance_photos', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('lesson_plans', 'lesson_plans', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true) ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- SECTION 6: STORAGE POLICIES
-- Allow authenticated users to upload and manage files in storage buckets
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Policy for authenticated users to upload to attendance-photos
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload attendance-photos') THEN
            CREATE POLICY "Authenticated upload attendance-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attendance-photos');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated read attendance-photos') THEN
            CREATE POLICY "Authenticated read attendance-photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attendance-photos');
        END IF;
        
        -- Policy for student-photos bucket
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload student-photos') THEN
            CREATE POLICY "Authenticated upload student-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'student-photos');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated read student-photos') THEN
            CREATE POLICY "Authenticated read student-photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'student-photos');
        END IF;
        
        -- Policy for avatars bucket
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload avatars') THEN
            CREATE POLICY "Authenticated upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated read avatars') THEN
            CREATE POLICY "Authenticated read avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
        END IF;
        
        -- Allow public read on public buckets
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read public buckets') THEN
            CREATE POLICY "Public read public buckets" ON storage.objects FOR SELECT USING (
                bucket_id IN ('attendance-photos', 'attendance_photos', 'student-photos', 'avatars', 'report_images')
            );
        END IF;
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload config';
