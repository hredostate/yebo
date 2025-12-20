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
    employment_status TEXT DEFAULT 'Active',
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
(1, 'Principal', 'School Head', ARRAY['view-dashboard', 'view-all-reports', 'manage-users', 'manage-students', 'view-analytics', 'view-school-health-overview', 'manage-tasks', 'manage-announcements', 'view-teacher-ratings', 'view-ai-task-suggestions', 'view-at-risk-students', 'view-all-student-data', 'view-sensitive-reports', 'score_entries.view_all', 'score_entries.edit_all', 'results.lock_and_publish', 'view-campus-stats']),
(1, 'Team Lead', 'Department Head', ARRAY['view-dashboard', 'submit-report', 'view-all-reports', 'assign-reports', 'comment-on-reports', 'manage-tasks', 'manage-curriculum', 'view-coverage-feedback', 'score_entries.view_all', 'score_entries.edit_all', 'results.lock_and_publish']),
(1, 'Teacher', 'Classroom teacher', ARRAY['view-dashboard', 'submit-report', 'score_entries.edit_self', 'view-my-reports', 'view-my-classes', 'view-my-lesson-plans', 'view-my-coverage-feedback', 'take-class-attendance', 'view-curriculum-readonly', 'query-living-policy']),
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
    father_name TEXT,
    father_phone TEXT,
    father_email TEXT,
    mother_name TEXT,
    mother_phone TEXT,
    mother_email TEXT,
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='father_name') THEN
        ALTER TABLE public.students ADD COLUMN father_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='father_phone') THEN
        ALTER TABLE public.students ADD COLUMN father_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='father_email') THEN
        ALTER TABLE public.students ADD COLUMN father_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='mother_name') THEN
        ALTER TABLE public.students ADD COLUMN mother_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='mother_phone') THEN
        ALTER TABLE public.students ADD COLUMN mother_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='mother_email') THEN
        ALTER TABLE public.students ADD COLUMN mother_email TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.staff_certifications (
    id BIGSERIAL PRIMARY KEY,
    staff_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    size BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    certification_type TEXT,
    certification_number TEXT,
    expiry_date DATE
);

ALTER TABLE public.staff_certifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_certifications' AND policyname = 'Staff certifications select') THEN
        CREATE POLICY "Staff certifications select" ON public.staff_certifications
            FOR SELECT USING (
                staff_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin','Principal','Team Lead')
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_certifications' AND policyname = 'Staff certifications insert') THEN
        CREATE POLICY "Staff certifications insert" ON public.staff_certifications
            FOR INSERT WITH CHECK (
                staff_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin','Principal','Team Lead')
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_certifications' AND policyname = 'Staff certifications update') THEN
        CREATE POLICY "Staff certifications update" ON public.staff_certifications
            FOR UPDATE USING (
                staff_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin','Principal','Team Lead')
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_certifications' AND policyname = 'Staff certifications delete') THEN
        CREATE POLICY "Staff certifications delete" ON public.staff_certifications
            FOR DELETE USING (
                staff_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.user_profiles up
                    WHERE up.id = auth.uid() AND up.role IN ('Admin','Principal','Team Lead')
                )
            );
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
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='priority') THEN
        ALTER TABLE public.subjects ADD COLUMN priority INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='is_solo') THEN
        ALTER TABLE public.subjects ADD COLUMN is_solo BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='can_co_run') THEN
        ALTER TABLE public.subjects ADD COLUMN can_co_run BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'subjects' AND constraint_name = 'subjects_solo_corun_check'
    ) THEN
        ALTER TABLE public.subjects
        ADD CONSTRAINT subjects_solo_corun_check CHECK (NOT (is_solo AND can_co_run));
    END IF;
END $$;
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
    manually_enrolled BOOLEAN DEFAULT FALSE,
    UNIQUE(academic_class_id, student_id, enrolled_term_id)
);
CREATE TABLE IF NOT EXISTS public.student_subject_choices (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    locked BOOLEAN DEFAULT FALSE,
    UNIQUE(student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.student_subject_enrollments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    is_enrolled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, subject_id, academic_class_id, term_id)
);

-- 8) Assessments & Scores
CREATE TABLE IF NOT EXISTS public.score_entries (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    subject_name TEXT,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    
    -- Score data
    exam_score NUMERIC,
    total_score NUMERIC,
    grade_label TEXT, -- Changed from 'grade' to match actual production DB
    gpa_value NUMERIC, -- Added to match actual production DB
    remark TEXT, -- Changed from 'teacher_comment' to match actual production DB
    
    -- CA scores stored as JSONB
    ca_scores_breakdown JSONB, -- Changed from 'ca_score' NUMERIC to match actual production DB
    component_scores JSONB DEFAULT '{}',
    
    -- Audit fields
    last_updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL, -- Added to match actual production DB
    entered_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    last_modified_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(term_id, academic_class_id, subject_name, student_id)
);

-- Add columns to existing score_entries table if they don't exist (for migration from old schema)
DO $$ BEGIN
    -- Add audit columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='entered_by_user_id') THEN
        ALTER TABLE public.score_entries ADD COLUMN entered_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='last_modified_by_user_id') THEN
        ALTER TABLE public.score_entries ADD COLUMN last_modified_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='last_updated_by') THEN
        ALTER TABLE public.score_entries ADD COLUMN last_updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='created_at') THEN
        ALTER TABLE public.score_entries ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='updated_at') THEN
        ALTER TABLE public.score_entries ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    -- Add new score columns to match production schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='grade_label') THEN
        -- Migrate data from 'grade' to 'grade_label' if grade exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='grade') THEN
            ALTER TABLE public.score_entries ADD COLUMN grade_label TEXT;
            UPDATE public.score_entries SET grade_label = grade WHERE grade IS NOT NULL;
        ELSE
            ALTER TABLE public.score_entries ADD COLUMN grade_label TEXT;
        END IF;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='remark') THEN
        -- Migrate data from 'teacher_comment' to 'remark' if teacher_comment exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='teacher_comment') THEN
            ALTER TABLE public.score_entries ADD COLUMN remark TEXT;
            UPDATE public.score_entries SET remark = teacher_comment WHERE teacher_comment IS NOT NULL;
        ELSE
            ALTER TABLE public.score_entries ADD COLUMN remark TEXT;
        END IF;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='ca_scores_breakdown') THEN
        ALTER TABLE public.score_entries ADD COLUMN ca_scores_breakdown JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='gpa_value') THEN
        ALTER TABLE public.score_entries ADD COLUMN gpa_value NUMERIC;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='score_entries' AND column_name='component_scores') THEN
        ALTER TABLE public.score_entries ADD COLUMN component_scores JSONB DEFAULT '{}';
    END IF;
END $$;
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
CREATE TABLE IF NOT EXISTS public.attendance_overrides (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES public.class_groups(id) ON DELETE CASCADE,
    term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
    session_label TEXT,
    total_days INTEGER DEFAULT 0,
    days_present INTEGER DEFAULT 0,
    comment TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, group_id, term_id),
    CHECK (days_present <= total_days)
);
CREATE INDEX IF NOT EXISTS attendance_overrides_term_idx ON public.attendance_overrides(term_id, group_id);
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
    meta JSONB,
    pay_period_start DATE,
    pay_period_end DATE,
    pay_date DATE,
    reference_number TEXT,
    payment_method TEXT,
    finalized_at TIMESTAMP WITH TIME ZONE,
    pay_period_label TEXT
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
    payslip_url TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'draft',
    pay_date DATE,
    reference_number TEXT,
    employment_type TEXT,
    department TEXT,
    role_title TEXT,
    total_employer_contributions NUMERIC DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.payroll_components (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    component_type TEXT NOT NULL CHECK (component_type IN ('earning', 'deduction', 'employer_contrib')),
    taxable BOOLEAN DEFAULT TRUE,
    pensionable BOOLEAN DEFAULT FALSE,
    calculation_type TEXT DEFAULT 'fixed' NOT NULL CHECK (calculation_type IN ('fixed', 'formula')),
    amount NUMERIC DEFAULT 0,
    formula TEXT,
    ordering INTEGER DEFAULT 100,
    show_on_payslip BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_components_school_id ON public.payroll_components(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_components_type ON public.payroll_components(component_type);
CREATE TABLE IF NOT EXISTS public.payroll_line_items (
    id SERIAL PRIMARY KEY,
    payroll_item_id INTEGER REFERENCES public.payroll_items(id) ON DELETE CASCADE NOT NULL,
    component_id INTEGER REFERENCES public.payroll_components(id) ON DELETE SET NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('earning', 'deduction', 'employer_contrib')),
    amount NUMERIC NOT NULL DEFAULT 0,
    units NUMERIC,
    rate NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_item ON public.payroll_line_items(payroll_item_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_component ON public.payroll_line_items(component_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_category ON public.payroll_line_items(category);
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
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_location_slot') THEN
        ALTER TABLE public.timetable_entries ADD CONSTRAINT unique_location_slot UNIQUE (term_id, day_of_week, period_id, location_id);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_class_slot') THEN
        ALTER TABLE public.timetable_entries DROP CONSTRAINT unique_class_slot;
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
        IF t IN ('reports', 'tasks', 'announcements', 'inventory_items', 'attendance_records', 'leave_requests', 'score_entries', 'orders', 'order_items', 'order_notes', 'team_feedback', 'report_comments', 'lesson_plans', 'quiz_responses', 'student_intervention_plans', 'sip_logs', 'student_invoices', 'payments', 'timetable_entries', 'timetable_periods', 'holidays', 'teacher_shifts', 'student_subject_choices', 'class_subjects', 'roles', 'user_role_assignments', 'assessment_structures', 'grading_schemes', 'grading_scheme_rules', 'school_config', 'academic_classes', 'terms', 'student_awards', 'staff_awards', 'audit_log', 'policy_statements') THEN
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

    -- Attendance overrides: class teachers/admins manage, everyone authenticated can read
    DROP POLICY IF EXISTS "Auth read attendance_overrides" ON public.attendance_overrides;
    DROP POLICY IF EXISTS "Auth write attendance_overrides" ON public.attendance_overrides;
    DROP POLICY IF EXISTS "attendance_overrides_select" ON public.attendance_overrides;
    DROP POLICY IF EXISTS "attendance_overrides_manage_insert" ON public.attendance_overrides;
    DROP POLICY IF EXISTS "attendance_overrides_manage_update" ON public.attendance_overrides;
    DROP POLICY IF EXISTS "attendance_overrides_manage_delete" ON public.attendance_overrides;

    CREATE POLICY "attendance_overrides_select" ON public.attendance_overrides
        FOR SELECT TO authenticated USING (true);

    CREATE POLICY "attendance_overrides_manage_insert" ON public.attendance_overrides
        FOR INSERT TO authenticated
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
            )
            OR EXISTS (
                SELECT 1 FROM public.class_groups cg
                JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                WHERE cg.id = attendance_overrides.group_id
                  AND ta.teacher_user_id = auth.uid()
            )
        );

    CREATE POLICY "attendance_overrides_manage_update" ON public.attendance_overrides
        FOR UPDATE TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
            )
            OR EXISTS (
                SELECT 1 FROM public.class_groups cg
                JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                WHERE cg.id = attendance_overrides.group_id
                  AND ta.teacher_user_id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
            )
            OR EXISTS (
                SELECT 1 FROM public.class_groups cg
                JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                WHERE cg.id = attendance_overrides.group_id
                  AND ta.teacher_user_id = auth.uid()
            )
        );

    CREATE POLICY "attendance_overrides_manage_delete" ON public.attendance_overrides
        FOR DELETE TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid() AND up.role IN ('Admin', 'Principal', 'School Owner')
            )
            OR EXISTS (
                SELECT 1 FROM public.class_groups cg
                JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
                WHERE cg.id = attendance_overrides.group_id
                  AND ta.teacher_user_id = auth.uid()
            )
        );

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

-- Policy Statements Table
CREATE TABLE IF NOT EXISTS public.policy_statements (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    target_audience TEXT[] DEFAULT ARRAY['student', 'staff'],
    is_active BOOLEAN DEFAULT TRUE,
    requires_acknowledgment BOOLEAN DEFAULT TRUE,
    effective_date DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy Acknowledgments Table (for efficient querying of who acknowledged what)
CREATE TABLE IF NOT EXISTS public.policy_acknowledgments (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER REFERENCES public.policy_statements(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    full_name_entered TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    UNIQUE(policy_id, user_id),
    UNIQUE(policy_id, student_id),
    CHECK ((user_id IS NOT NULL AND student_id IS NULL) OR (user_id IS NULL AND student_id IS NOT NULL))
);

-- Add RLS policies for policy_acknowledgments
ALTER TABLE public.policy_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view acknowledgments for their school" ON public.policy_acknowledgments;
CREATE POLICY "Users can view acknowledgments for their school" ON public.policy_acknowledgments
    FOR SELECT USING (school_id = (SELECT school_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own acknowledgments" ON public.policy_acknowledgments;
CREATE POLICY "Users can insert their own acknowledgments" ON public.policy_acknowledgments
    FOR INSERT WITH CHECK (
        (user_id = auth.uid() AND school_id = (SELECT school_id FROM public.user_profiles WHERE id = auth.uid()))
        OR 
        (student_id IS NOT NULL AND school_id = (SELECT school_id FROM public.user_profiles WHERE id = auth.uid()))
    );

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
    v_term_start DATE;
    v_term_end DATE;
    v_present_count INTEGER;
    v_absent_count INTEGER;
    v_late_count INTEGER;
    v_excused_count INTEGER;
    v_unexcused_count INTEGER;
    v_total_count INTEGER;
    v_attendance_rate NUMERIC;
    v_present_computed INTEGER;
    v_absent_computed INTEGER;
    v_late_computed INTEGER;
    v_excused_computed INTEGER;
    v_unexcused_computed INTEGER;
    v_total_computed INTEGER;
    v_attendance_rate_computed NUMERIC;
    v_class_group_id INTEGER;
    v_override public.attendance_overrides%ROWTYPE;
    v_computed_attendance JSONB;
    v_attendance_source TEXT;
    v_override_found BOOLEAN := false;
    v_cohort_rank INTEGER;
    v_cohort_size INTEGER;
    v_level_rank INTEGER;
    v_level_size INTEGER;
    v_campus_percentile NUMERIC;
BEGIN
    -- 1. Student Info scoped with campus/class/arm for cohort filters
    SELECT jsonb_build_object(
        'id', s.id,
        'fullName', s.name,
        'className', ac.name,
        'classId', ac.id,
        'armName', ac.arm,
        'campusId', s.campus_id
    )
    INTO v_student
    FROM public.students s
    LEFT JOIN public.academic_class_students acs ON acs.student_id = s.id AND acs.enrolled_term_id = p_term_id
    LEFT JOIN public.academic_classes ac ON ac.id = acs.academic_class_id
    WHERE s.id = p_student_id;

    -- 2. Term Info with date range
    SELECT jsonb_build_object('sessionLabel', session_label, 'termLabel', term_label),
           start_date, end_date
    INTO v_term, v_term_start, v_term_end
    FROM public.terms WHERE id = p_term_id;

    -- 3. Config
    SELECT to_jsonb(sc.*) INTO v_school_config
    FROM public.school_config sc LIMIT 1;

    -- 4. Report Meta
    SELECT * INTO v_report_row
    FROM public.student_term_reports
    WHERE student_id = p_student_id AND term_id = p_term_id;

    -- 5. Cohort-level ranking (campus + session + term + class + arm) and Level-wide ranking
    WITH cohort AS (
        SELECT
            str.student_id,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id, str.academic_class_id, ac.arm
                ORDER BY COALESCE(str.average_score, 0) DESC
            ) AS cohort_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id, str.academic_class_id, ac.arm
            ) AS cohort_size,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id, ac.level
                ORDER BY COALESCE(str.average_score, 0) DESC
            ) AS level_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id, ac.level
            ) AS level_size,
            DENSE_RANK() OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id
                ORDER BY COALESCE(str.average_score, 0) DESC
            ) AS campus_rank,
            COUNT(*) OVER (
                PARTITION BY s.campus_id, t.session_label, str.term_id
            ) AS campus_total
        FROM public.student_term_reports str
        JOIN public.students s ON str.student_id = s.id
        JOIN public.terms t ON t.id = str.term_id
        LEFT JOIN public.academic_classes ac ON ac.id = str.academic_class_id
        WHERE str.term_id = p_term_id
          AND COALESCE(s.status, 'Active') NOT IN ('Withdrawn', 'Graduated', 'Expelled', 'Inactive')
    )
    SELECT
        c.cohort_rank,
        c.cohort_size,
        c.level_rank,
        c.level_size,
        CASE WHEN c.campus_total > 0 THEN ROUND(((c.campus_total - c.campus_rank)::NUMERIC / c.campus_total::NUMERIC) * 100, 2) ELSE NULL END
    INTO v_cohort_rank, v_cohort_size, v_level_rank, v_level_size, v_campus_percentile
    FROM cohort c
    WHERE c.student_id = p_student_id
    LIMIT 1;

    -- 6. Subjects (from score_entries) ranked within cohort scope
    SELECT jsonb_agg(jsonb_build_object(
        'subjectName', se.subject_name,
        'componentScores', COALESCE(se.component_scores, '{}'::jsonb),
        'totalScore', se.total_score,
        'gradeLabel', COALESCE(se.grade, se.grade_label),
        'remark', COALESCE(se.teacher_comment, '-'),
        'subjectPosition', DENSE_RANK() OVER (
            PARTITION BY s.campus_id, t.session_label, se.term_id, se.academic_class_id, ac.arm, se.subject_name
            ORDER BY COALESCE(se.total_score, 0) DESC
        )
    ))
    INTO v_subjects
    FROM public.score_entries se
    JOIN public.students s ON s.id = se.student_id
    JOIN public.terms t ON t.id = se.term_id
    LEFT JOIN public.academic_classes ac ON ac.id = se.academic_class_id
    WHERE se.student_id = p_student_id AND se.term_id = p_term_id;

    -- 7. Identify the student's class group for this term (class teacher groups take precedence)
    SELECT cgm.group_id
    INTO v_class_group_id
    FROM public.class_group_members cgm
    JOIN public.class_groups cg ON cg.id = cgm.group_id
    LEFT JOIN public.teaching_assignments ta ON cg.teaching_entity_id = ta.id
    WHERE cgm.student_id = p_student_id
      AND cg.group_type = 'class_teacher'
      AND (ta.term_id = p_term_id OR ta.term_id IS NULL)
    ORDER BY (ta.term_id = p_term_id) DESC, cg.id
    LIMIT 1;

    -- 8. Calculate real attendance from attendance_records
    -- Join through class_group_members to connect students with attendance records
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('present', 'p')), 0),
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('absent', 'a', 'unexcused')), 0),
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('late', 'tardy', 'l', 't')), 0),
        COALESCE(COUNT(*) FILTER (WHERE LOWER(ar.status) IN ('excused', 'e', 'excused absence')), 0),
        COALESCE(COUNT(*), 0)
    INTO v_present_computed, v_unexcused_computed, v_late_computed, v_excused_computed, v_total_computed
    FROM public.attendance_records ar
    INNER JOIN public.class_group_members cgm ON ar.member_id = cgm.id
    WHERE cgm.student_id = p_student_id
      AND ar.session_date IS NOT NULL
      AND (v_term_start IS NULL OR ar.session_date >= v_term_start)
      AND (v_term_end IS NULL OR ar.session_date <= v_term_end);

    -- Calculate total absences (excused + unexcused)
    v_absent_computed := v_excused_computed + v_unexcused_computed;

    -- Calculate attendance rate
    IF v_total_computed > 0 THEN
        v_attendance_rate_computed := ROUND((v_present_computed::NUMERIC / v_total_computed::NUMERIC) * 100, 2);
    ELSE
        v_attendance_rate_computed := 0;
    END IF;

    v_computed_attendance := jsonb_build_object(
        'present', v_present_computed,
        'absent', v_absent_computed,
        'late', v_late_computed,
        'excused', v_excused_computed,
        'unexcused', v_unexcused_computed,
        'total', v_total_computed,
        'rate', v_attendance_rate_computed
    );

    -- 9. Apply overrides when present for this class/term/student
    IF v_class_group_id IS NOT NULL THEN
        SELECT * INTO v_override
        FROM public.attendance_overrides ao
        WHERE ao.student_id = p_student_id
          AND ao.term_id = p_term_id
          AND ao.group_id = v_class_group_id
        ORDER BY ao.updated_at DESC
        LIMIT 1;
        IF FOUND THEN
            v_override_found := true;
        END IF;
    END IF;

    IF v_override_found THEN
        v_present_count := COALESCE(v_override.days_present, 0);
        v_total_count := COALESCE(v_override.total_days, 0);
        v_absent_count := GREATEST(COALESCE(v_override.total_days, 0) - COALESCE(v_override.days_present, 0), 0);
        v_late_count := 0;
        v_excused_count := 0;
        v_unexcused_count := v_absent_count;
        v_attendance_source := 'override';
    ELSE
        v_present_count := v_present_computed;
        v_absent_count := v_absent_computed;
        v_late_count := v_late_computed;
        v_excused_count := v_excused_computed;
        v_unexcused_count := v_unexcused_computed;
        v_total_count := v_total_computed;
        v_attendance_source := 'computed';
    END IF;

    IF v_total_count > 0 THEN
        v_attendance_rate := ROUND((v_present_count::NUMERIC / v_total_count::NUMERIC) * 100, 2);
    ELSE
        v_attendance_rate := 0;
    END IF;

    -- Build attendance object with detailed metrics
    v_attendance := jsonb_build_object(
        'present', v_present_count,
        'absent', v_absent_count,
        'late', v_late_count,
        'excused', v_excused_count,
        'unexcused', v_unexcused_count,
        'total', v_total_count,
        'rate', v_attendance_rate,
        'source', v_attendance_source,
        'overrideApplied', (v_attendance_source = 'override'),
        'computed', v_computed_attendance,
        'overrideMeta', CASE WHEN v_attendance_source = 'override' THEN jsonb_build_object(
            'group_id', v_override.group_id,
            'comment', v_override.comment,
            'updated_by', v_override.updated_by,
            'updated_at', v_override.updated_at
        ) ELSE NULL END
    );

    RETURN jsonb_build_object(
        'student', v_student,
        'term', v_term,
        'schoolConfig', v_school_config,
        'subjects', COALESCE(v_subjects, '[]'::jsonb),
        'summary', jsonb_build_object(
            'average', v_report_row.average_score,
            'positionInArm', COALESCE(v_cohort_rank, v_report_row.position_in_class),
            'cohortSize', v_cohort_size,
            'positionInLevel', v_level_rank,
            'levelSize', v_level_size,
            'campusPercentile', v_campus_percentile,
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
    
    -- Add policy_acknowledgments column to user_profiles table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='policy_acknowledgments') THEN
        ALTER TABLE public.user_profiles ADD COLUMN policy_acknowledgments JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add policy_acknowledgments column to students table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='policy_acknowledgments') THEN
        ALTER TABLE public.students ADD COLUMN policy_acknowledgments JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- SECTION 4: SEED DATA
INSERT INTO public.classes (name) VALUES 
('JSS 1'), ('JSS 2'), ('JSS 3'),
('SS 1'), ('SS 2'), ('SS 3')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.arms (name) VALUES 
('Gold'), ('Silver'), ('Diamond'), ('Blue'), ('Red')
ON CONFLICT (name) DO NOTHING;

-- Insert subjects with school_id (requires at least one school to exist)
INSERT INTO public.subjects (name, school_id) 
SELECT t.name, s.id
FROM (VALUES 
    ('Mathematics'), 
    ('English Language'), 
    ('Basic Science'), 
    ('Civic Education'), 
    ('ICT')
) AS t(name)
CROSS JOIN (SELECT id FROM public.schools ORDER BY id LIMIT 1) AS s
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

-- ============================================
-- SECTION 7: ENROLLMENT SYNCHRONIZATION
-- ============================================
-- Resolves dual source of truth between students table and academic_class_students
-- Source of truth: students.class_id and students.arm_id
-- Target: academic_class_students enrollment records

-- Function: Sync a single student's enrollment for a specific term
CREATE OR REPLACE FUNCTION sync_student_enrollment(
    p_student_id INTEGER,
    p_term_id INTEGER,
    p_school_id INTEGER,
    p_preserve_manual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_academic_class_id INTEGER;
    v_result JSONB;
    v_action TEXT;
    v_class_name TEXT;
    v_arm_name TEXT;
    v_existing_enrollment RECORD;
BEGIN
    -- Get student's current class and arm
    SELECT class_id, arm_id, name
    INTO v_student
    FROM students
    WHERE id = p_student_id AND school_id = p_school_id;
    
    -- If student not found or has no class/arm assignment
    IF v_student IS NULL OR v_student.class_id IS NULL OR v_student.arm_id IS NULL THEN
        -- Check if there's a manual enrollment to preserve
        IF p_preserve_manual THEN
            SELECT * INTO v_existing_enrollment
            FROM academic_class_students
            WHERE student_id = p_student_id
              AND enrolled_term_id = p_term_id
              AND manually_enrolled = TRUE;
            
            IF FOUND THEN
                -- Preserve manual enrollment, just log a warning
                RETURN jsonb_build_object(
                    'action', 'preserved_manual',
                    'student_id', p_student_id,
                    'reason', CASE 
                        WHEN v_student IS NULL THEN 'student_not_found_but_manual_enrollment_preserved'
                        ELSE 'no_class_or_arm_assigned_but_manual_enrollment_preserved'
                    END,
                    'academic_class_id', v_existing_enrollment.academic_class_id
                );
            END IF;
        END IF;
        
        -- Remove only auto-synced enrollments
        DELETE FROM academic_class_students
        WHERE student_id = p_student_id
          AND enrolled_term_id = p_term_id
          AND (NOT p_preserve_manual OR manually_enrolled = FALSE);
        
        RETURN jsonb_build_object(
            'action', 'removed',
            'student_id', p_student_id,
            'reason', CASE 
                WHEN v_student IS NULL THEN 'student_not_found'
                ELSE 'no_class_or_arm_assigned'
            END
        );
    END IF;
    
    -- Get student's class and arm names
    SELECT name INTO v_class_name FROM classes WHERE id = v_student.class_id;
    SELECT name INTO v_arm_name FROM arms WHERE id = v_student.arm_id;
    
    -- If class or arm not found, can't proceed
    IF v_class_name IS NULL OR v_arm_name IS NULL THEN
        RETURN jsonb_build_object(
            'action', 'error',
            'student_id', p_student_id,
            'reason', 'class_or_arm_not_found',
            'class_id', v_student.class_id,
            'arm_id', v_student.arm_id
        );
    END IF;
    
    -- Find the matching academic class
    SELECT id INTO v_academic_class_id
    FROM academic_classes
    WHERE school_id = p_school_id
      AND level = v_class_name
      AND arm = v_arm_name
      AND is_active = TRUE
    LIMIT 1;
    
    -- If no matching academic class found
    IF v_academic_class_id IS NULL THEN
        -- Check if there's a manual enrollment to preserve
        IF p_preserve_manual THEN
            SELECT * INTO v_existing_enrollment
            FROM academic_class_students
            WHERE student_id = p_student_id
              AND enrolled_term_id = p_term_id
              AND manually_enrolled = TRUE;
            
            IF FOUND THEN
                -- Preserve manual enrollment, just log a warning
                RETURN jsonb_build_object(
                    'action', 'preserved_manual',
                    'student_id', p_student_id,
                    'reason', 'no_matching_academic_class_but_manual_enrollment_preserved',
                    'class_name', v_class_name,
                    'arm_name', v_arm_name,
                    'academic_class_id', v_existing_enrollment.academic_class_id
                );
            END IF;
        END IF;
        
        -- Remove only auto-synced enrollments
        DELETE FROM academic_class_students
        WHERE student_id = p_student_id
          AND enrolled_term_id = p_term_id
          AND (NOT p_preserve_manual OR manually_enrolled = FALSE);
        
        RETURN jsonb_build_object(
            'action', 'removed',
            'student_id', p_student_id,
            'reason', 'no_matching_academic_class',
            'class_name', v_class_name,
            'arm_name', v_arm_name
        );
    END IF;
    
    -- Check if enrollment already exists
    SELECT * INTO v_existing_enrollment
    FROM academic_class_students
    WHERE student_id = p_student_id
      AND enrolled_term_id = p_term_id;
    
    IF FOUND THEN
        -- If it's a manual enrollment and matches the target class, preserve it
        IF v_existing_enrollment.manually_enrolled AND 
           v_existing_enrollment.academic_class_id = v_academic_class_id THEN
            RETURN jsonb_build_object(
                'action', 'preserved_manual',
                'student_id', p_student_id,
                'academic_class_id', v_academic_class_id,
                'class_name', v_class_name,
                'arm_name', v_arm_name,
                'reason', 'manual_enrollment_already_correct'
            );
        END IF;
        
        -- If it's a manual enrollment but for different class
        IF v_existing_enrollment.manually_enrolled AND 
           v_existing_enrollment.academic_class_id != v_academic_class_id AND
           p_preserve_manual THEN
            -- Keep the manual enrollment, don't override
            RETURN jsonb_build_object(
                'action', 'preserved_manual',
                'student_id', p_student_id,
                'academic_class_id', v_existing_enrollment.academic_class_id,
                'expected_class_id', v_academic_class_id,
                'class_name', v_class_name,
                'arm_name', v_arm_name,
                'reason', 'manual_enrollment_for_different_class_preserved'
            );
        END IF;
        
        -- Update the enrollment (it's either auto-synced or we're not preserving manual)
        UPDATE academic_class_students
        SET academic_class_id = v_academic_class_id,
            manually_enrolled = FALSE  -- Reset to auto-synced
        WHERE student_id = p_student_id
          AND enrolled_term_id = p_term_id;
        
        RETURN jsonb_build_object(
            'action', 'updated',
            'student_id', p_student_id,
            'academic_class_id', v_academic_class_id,
            'class_name', v_class_name,
            'arm_name', v_arm_name
        );
    ELSE
        -- Create new enrollment (auto-synced)
        INSERT INTO academic_class_students (academic_class_id, student_id, enrolled_term_id, manually_enrolled)
        VALUES (v_academic_class_id, p_student_id, p_term_id, FALSE);
        
        RETURN jsonb_build_object(
            'action', 'created',
            'student_id', p_student_id,
            'academic_class_id', v_academic_class_id,
            'class_name', v_class_name,
            'arm_name', v_arm_name
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Sync all students for a specific term
CREATE OR REPLACE FUNCTION sync_all_students_for_term(
    p_term_id INTEGER,
    p_school_id INTEGER,
    p_preserve_manual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_student RECORD;
    v_result JSONB;
    v_stats JSONB;
    v_created INTEGER := 0;
    v_updated INTEGER := 0;
    v_removed INTEGER := 0;
    v_errors INTEGER := 0;
    v_preserved INTEGER := 0;
BEGIN
    -- Process each student
    FOR v_student IN 
        SELECT id FROM students WHERE school_id = p_school_id
    LOOP
        v_result := sync_student_enrollment(v_student.id, p_term_id, p_school_id, p_preserve_manual);
        
        CASE v_result->>'action'
            WHEN 'created' THEN v_created := v_created + 1;
            WHEN 'updated' THEN v_updated := v_updated + 1;
            WHEN 'removed' THEN v_removed := v_removed + 1;
            WHEN 'error' THEN v_errors := v_errors + 1;
            WHEN 'preserved_manual' THEN v_preserved := v_preserved + 1;
        END CASE;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'term_id', p_term_id,
        'school_id', p_school_id,
        'stats', jsonb_build_object(
            'created', v_created,
            'updated', v_updated,
            'removed', v_removed,
            'errors', v_errors,
            'preserved_manual', v_preserved,
            'total_processed', v_created + v_updated + v_removed + v_errors + v_preserved
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger Function: Auto-sync student enrollment when class/arm changes
CREATE OR REPLACE FUNCTION trigger_sync_student_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_active_term RECORD;
    v_result JSONB;
BEGIN
    -- Only sync if class_id or arm_id changed
    IF (TG_OP = 'UPDATE' AND (
        OLD.class_id IS DISTINCT FROM NEW.class_id OR 
        OLD.arm_id IS DISTINCT FROM NEW.arm_id
    )) OR TG_OP = 'INSERT' THEN
        
        -- Get all active terms for this school
        FOR v_active_term IN 
            SELECT id FROM terms 
            WHERE school_id = NEW.school_id 
              AND is_active = TRUE
        LOOP
            -- Sync student for this term (preserve manual enrollments by default)
            PERFORM sync_student_enrollment(NEW.id, v_active_term.id, NEW.school_id, TRUE);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on students table
DROP TRIGGER IF EXISTS student_enrollment_sync_trigger ON students;
CREATE TRIGGER student_enrollment_sync_trigger
    AFTER INSERT OR UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_student_enrollment();

-- Trigger Function: Auto-enroll all students when a new term is created or activated
CREATE OR REPLACE FUNCTION trigger_sync_enrollments_on_term()
RETURNS TRIGGER AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- When a term becomes active (created as active or changed to active)
    IF (TG_OP = 'INSERT' AND NEW.is_active = TRUE) OR 
       (TG_OP = 'UPDATE' AND OLD.is_active = FALSE AND NEW.is_active = TRUE) THEN
        
        -- Sync all students for this term (preserve manual enrollments by default)
        PERFORM sync_all_students_for_term(NEW.id, NEW.school_id, TRUE);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on terms table
DROP TRIGGER IF EXISTS term_enrollment_sync_trigger ON terms;
CREATE TRIGGER term_enrollment_sync_trigger
    AFTER INSERT OR UPDATE ON terms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_enrollments_on_term();

-- Function: Admin sync with detailed statistics
CREATE OR REPLACE FUNCTION admin_sync_student_enrollments(
    p_term_id INTEGER,
    p_school_id INTEGER,
    p_preserve_manual BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_before_count INTEGER;
    v_after_count INTEGER;
BEGIN
    -- Count enrollments before sync
    SELECT COUNT(*) INTO v_before_count
    FROM academic_class_students
    WHERE enrolled_term_id = p_term_id;
    
    -- Perform sync
    v_result := sync_all_students_for_term(p_term_id, p_school_id, p_preserve_manual);
    
    -- Count enrollments after sync
    SELECT COUNT(*) INTO v_after_count
    FROM academic_class_students
    WHERE enrolled_term_id = p_term_id;
    
    -- Return detailed stats
    RETURN jsonb_build_object(
        'success', true,
        'term_id', p_term_id,
        'school_id', p_school_id,
        'before_count', v_before_count,
        'after_count', v_after_count,
        'preserve_manual', p_preserve_manual,
        'sync_stats', v_result->'stats'
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Get enrollment sync diagnostics
CREATE OR REPLACE FUNCTION get_enrollment_sync_diagnostics(
    p_term_id INTEGER,
    p_school_id INTEGER
) RETURNS TABLE(
    student_id INTEGER,
    student_name TEXT,
    current_class_id INTEGER,
    current_arm_id INTEGER,
    current_class_name TEXT,
    current_arm_name TEXT,
    expected_academic_class_id INTEGER,
    expected_academic_class_name TEXT,
    enrolled_academic_class_id INTEGER,
    enrolled_academic_class_name TEXT,
    sync_status TEXT,
    issue_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH student_info AS (
        SELECT 
            s.id as student_id,
            s.name as student_name,
            s.class_id,
            s.arm_id,
            c.name as class_name,
            a.name as arm_name
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN arms a ON s.arm_id = a.id
        WHERE s.school_id = p_school_id
    ),
    expected_classes AS (
        SELECT 
            si.student_id,
            si.student_name,
            si.class_id,
            si.arm_id,
            si.class_name,
            si.arm_name,
            ac.id as expected_ac_id,
            ac.name as expected_ac_name
        FROM student_info si
        LEFT JOIN academic_classes ac ON 
            ac.school_id = p_school_id AND
            ac.level = si.class_name AND
            ac.arm = si.arm_name AND
            ac.is_active = TRUE
    ),
    current_enrollments AS (
        SELECT 
            acs.student_id,
            acs.academic_class_id as enrolled_ac_id,
            ac.name as enrolled_ac_name
        FROM academic_class_students acs
        JOIN academic_classes ac ON acs.academic_class_id = ac.id
        WHERE acs.enrolled_term_id = p_term_id
    )
    SELECT 
        ec.student_id,
        ec.student_name,
        ec.class_id as current_class_id,
        ec.arm_id as current_arm_id,
        ec.class_name as current_class_name,
        ec.arm_name as current_arm_name,
        ec.expected_ac_id as expected_academic_class_id,
        ec.expected_ac_name as expected_academic_class_name,
        ce.enrolled_ac_id as enrolled_academic_class_id,
        ce.enrolled_ac_name as enrolled_academic_class_name,
        CASE 
            WHEN ec.class_id IS NULL OR ec.arm_id IS NULL THEN 'no_assignment'
            WHEN ec.expected_ac_id IS NULL THEN 'no_matching_class'
            WHEN ce.enrolled_ac_id IS NULL THEN 'not_enrolled'
            WHEN ce.enrolled_ac_id != ec.expected_ac_id THEN 'mismatched'
            ELSE 'synced'
        END as sync_status,
        CASE 
            WHEN ec.class_id IS NULL OR ec.arm_id IS NULL THEN 
                'Student has no class or arm assignment in students table'
            WHEN ec.expected_ac_id IS NULL THEN 
                'No active academic class found for ' || ec.class_name || ' ' || ec.arm_name
            WHEN ce.enrolled_ac_id IS NULL THEN 
                'Student not enrolled in any class for this term'
            WHEN ce.enrolled_ac_id != ec.expected_ac_id THEN 
                'Student enrolled in ' || ce.enrolled_ac_name || ' but should be in ' || ec.expected_ac_name
            ELSE 'Student correctly enrolled'
        END as issue_description
    FROM expected_classes ec
    LEFT JOIN current_enrollments ce ON ec.student_id = ce.student_id
    WHERE 
        -- Only return students with issues
        CASE 
            WHEN ec.class_id IS NULL OR ec.arm_id IS NULL THEN TRUE
            WHEN ec.expected_ac_id IS NULL THEN TRUE
            WHEN ce.enrolled_ac_id IS NULL THEN TRUE
            WHEN ce.enrolled_ac_id != ec.expected_ac_id THEN TRUE
            ELSE FALSE
        END
    ORDER BY ec.student_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION sync_student_enrollment(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_all_students_for_term(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_sync_student_enrollments(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrollment_sync_diagnostics(INTEGER, INTEGER) TO authenticated;

-- Create index for optimal sync performance
-- This index significantly speeds up the academic class lookup in sync operations
CREATE INDEX IF NOT EXISTS idx_academic_classes_sync_lookup 
    ON academic_classes(school_id, level, arm, is_active)
    WHERE is_active = TRUE;

-- ============================================
-- LESSON PLAN ENHANCEMENT TABLES
-- ============================================

-- 1. Per-Arm Coverage Tracking
CREATE TABLE IF NOT EXISTS public.lesson_plan_coverage (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    arm_id INTEGER,
    coverage_status TEXT DEFAULT 'Pending', -- Pending, Fully Covered, Partially Covered, Not Covered
    coverage_percentage INTEGER DEFAULT 0,
    topics_covered TEXT,
    topics_pending TEXT,
    notes TEXT,
    covered_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Learning Materials
CREATE TABLE IF NOT EXISTS public.learning_materials (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    material_type TEXT DEFAULT 'document', -- pdf, video, link, document, presentation
    file_url TEXT,
    external_url TEXT,
    tags TEXT[],
    is_shared BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Student Material Access Tracking
CREATE TABLE IF NOT EXISTS public.student_material_access (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES public.learning_materials(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, material_id)
);

-- 4. Lesson Plan Reviews (Approval Workflow)
CREATE TABLE IF NOT EXISTS public.lesson_plan_reviews (
    id SERIAL PRIMARY KEY,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    review_status TEXT DEFAULT 'pending', -- pending, approved, rejected, revision_requested
    feedback TEXT,
    revision_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Homework Management
CREATE TABLE IF NOT EXISTS public.homework (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    lesson_plan_id INTEGER REFERENCES public.lesson_plans(id) ON DELETE SET NULL,
    teaching_assignment_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    due_date DATE NOT NULL,
    due_time TIME,
    max_score INTEGER DEFAULT 100,
    is_graded BOOLEAN DEFAULT TRUE,
    allow_late_submission BOOLEAN DEFAULT FALSE,
    late_penalty_percent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, closed, archived
    notify_parents BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Homework Attachments
CREATE TABLE IF NOT EXISTS public.homework_attachments (
    id SERIAL PRIMARY KEY,
    homework_id INTEGER REFERENCES public.homework(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Homework Submissions
CREATE TABLE IF NOT EXISTS public.homework_submissions (
    id SERIAL PRIMARY KEY,
    homework_id INTEGER REFERENCES public.homework(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    submission_status TEXT DEFAULT 'pending', -- pending, submitted, late, missing
    submitted_at TIMESTAMP WITH TIME ZONE,
    submission_text TEXT,
    submission_files TEXT[], -- Array of file URLs
    score NUMERIC,
    feedback TEXT,
    graded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    graded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(homework_id, student_id)
);

-- 8. Notes Compliance Tracking
CREATE TABLE IF NOT EXISTS public.notes_checks (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    teaching_assignment_id INTEGER REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    academic_class_id INTEGER REFERENCES public.academic_classes(id) ON DELETE CASCADE,
    check_date DATE NOT NULL,
    topic TEXT NOT NULL,
    checked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Notes Compliance Records
CREATE TABLE IF NOT EXISTS public.notes_compliance (
    id SERIAL PRIMARY KEY,
    notes_check_id INTEGER REFERENCES public.notes_checks(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'incomplete', -- complete, incomplete, partial
    notes TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(notes_check_id, student_id)
);

-- 10. WhatsApp Message Templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL, -- homework_reminder, homework_missing, notes_incomplete, lesson_published
    template_type TEXT NOT NULL, -- template, conversational
    template_id TEXT, -- Termii template ID if using templates
    message_content TEXT NOT NULL,
    variables TEXT[], -- Array of variable placeholders
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, template_name)
);

-- 11. WhatsApp Notifications Log
CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    template_name TEXT,
    message_content TEXT,
    notification_type TEXT, -- homework_reminder, homework_missing, notes_incomplete, lesson_published
    reference_id INTEGER, -- ID of related entity (homework_id, notes_check_id, etc.)
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
    termii_message_id TEXT,
    error_message TEXT,
    sent_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update lesson_plans table with new fields for publishing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='published_at') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='published_by') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='publish_target') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN publish_target TEXT; -- 'all', 'class', 'arm'
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='smart_goals') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN smart_goals TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='sessions') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN sessions JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_plans' AND column_name='grade_level') THEN
        ALTER TABLE public.lesson_plans ADD COLUMN grade_level TEXT;
    END IF;
END $$;

-- Add whatsapp_settings to schools table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='whatsapp_settings') THEN
        ALTER TABLE public.schools ADD COLUMN whatsapp_settings JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lesson_plan_coverage_lesson_id ON public.lesson_plan_coverage(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_coverage_class_id ON public.lesson_plan_coverage(academic_class_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_lesson_id ON public.learning_materials(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_published ON public.learning_materials(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_lesson_plan_reviews_plan_id ON public.lesson_plan_reviews(lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plan_reviews_status ON public.lesson_plan_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_homework_class_id ON public.homework(academic_class_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON public.homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework_id ON public.homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_id ON public.homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_notes_compliance_check_id ON public.notes_compliance(notes_check_id);
CREATE INDEX IF NOT EXISTS idx_notes_compliance_student_id ON public.notes_compliance(student_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_student_id ON public.whatsapp_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_status ON public.whatsapp_notifications(status);
CREATE INDEX IF NOT EXISTS idx_student_term_reports_scope ON public.student_term_reports(term_id, academic_class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_score_entries_scope ON public.score_entries(term_id, academic_class_id, student_id, subject_name);
CREATE INDEX IF NOT EXISTS idx_students_campus_status ON public.students(campus_id, status);

-- Harden payroll and finance tables with deny-by-default RLS
CREATE OR REPLACE FUNCTION public.user_has_permission(target_permission text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
    WITH me AS (SELECT id, role FROM public.user_profiles WHERE id = auth.uid())
    SELECT
        EXISTS (
            SELECT 1 FROM public.roles r
            JOIN me m ON r.title = m.role
            WHERE r.permissions @> ARRAY[target_permission]
        )
        OR EXISTS (
            SELECT 1 FROM public.user_role_assignments ura
            JOIN public.roles r ON ura.role_id = r.id
            WHERE ura.user_id = auth.uid() AND r.permissions @> ARRAY[target_permission]
        )
        OR EXISTS (
            SELECT 1 FROM me m WHERE m.role IN ('Admin', 'Super Admin')
        );
$$;

-- Payroll runs: admins only
DROP POLICY IF EXISTS "Auth read payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Auth write payroll_runs" ON public.payroll_runs;
CREATE POLICY "Payroll admins manage payroll_runs" ON public.payroll_runs
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

-- Payroll items: allow staff to view only their own records
DROP POLICY IF EXISTS "Auth read payroll_items" ON public.payroll_items;
DROP POLICY IF EXISTS "Auth write payroll_items" ON public.payroll_items;
CREATE POLICY "Payroll items view self or admin" ON public.payroll_items
    FOR SELECT TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance') OR user_id = auth.uid());
CREATE POLICY "Payroll items manage" ON public.payroll_items
    FOR INSERT TO authenticated
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));
CREATE POLICY "Payroll items update" ON public.payroll_items
    FOR UPDATE TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));
CREATE POLICY "Payroll items delete" ON public.payroll_items
    FOR DELETE TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

-- Payroll adjustments
DROP POLICY IF EXISTS "Auth read payroll_adjustments" ON public.payroll_adjustments;
DROP POLICY IF EXISTS "Auth write payroll_adjustments" ON public.payroll_adjustments;
CREATE POLICY "Payroll adjustments view" ON public.payroll_adjustments
    FOR SELECT TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance') OR user_id = auth.uid());
CREATE POLICY "Payroll adjustments manage" ON public.payroll_adjustments
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

-- Payroll components and line items (admin-only)
DROP POLICY IF EXISTS "Auth read payroll_components" ON public.payroll_components;
DROP POLICY IF EXISTS "Auth write payroll_components" ON public.payroll_components;
CREATE POLICY "Payroll components manage" ON public.payroll_components
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

DROP POLICY IF EXISTS "Auth read payroll_line_items" ON public.payroll_line_items;
DROP POLICY IF EXISTS "Auth write payroll_line_items" ON public.payroll_line_items;
CREATE POLICY "Payroll line items manage" ON public.payroll_line_items
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

-- Next-gen payroll tables
DROP POLICY IF EXISTS "Auth read payroll_runs_v2" ON public.payroll_runs_v2;
DROP POLICY IF EXISTS "Auth write payroll_runs_v2" ON public.payroll_runs_v2;
CREATE POLICY "Payroll v2 manage" ON public.payroll_runs_v2
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

DROP POLICY IF EXISTS "Auth read payslips" ON public.payslips;
DROP POLICY IF EXISTS "Auth write payslips" ON public.payslips;
CREATE POLICY "Payslips view" ON public.payslips
    FOR SELECT TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance') OR staff_id = auth.uid());
CREATE POLICY "Payslips manage" ON public.payslips
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

DROP POLICY IF EXISTS "Auth read payslip_line_items" ON public.payslip_line_items;
DROP POLICY IF EXISTS "Auth write payslip_line_items" ON public.payslip_line_items;
CREATE POLICY "Payslip line items manage" ON public.payslip_line_items
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

DROP POLICY IF EXISTS "Auth read payslip_queries" ON public.payslip_queries;
DROP POLICY IF EXISTS "Auth write payslip_queries" ON public.payslip_queries;
CREATE POLICY "Payslip queries manage" ON public.payslip_queries
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

-- Paystack recipient details (banking data)
DROP POLICY IF EXISTS "Auth read paystack_recipients" ON public.paystack_recipients;
DROP POLICY IF EXISTS "Auth write paystack_recipients" ON public.paystack_recipients;
CREATE POLICY "Paystack recipients view" ON public.paystack_recipients
    FOR SELECT TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));
CREATE POLICY "Paystack recipients manage" ON public.paystack_recipients
    FOR ALL TO authenticated
    USING (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'))
    WITH CHECK (user_has_permission('manage-payroll') OR user_has_permission('manage-finance'));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload config';
