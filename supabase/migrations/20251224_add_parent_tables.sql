-- Migration: Add parent/guardian account system
-- This adds support for parent accounts that can be linked to multiple students

-- 1. Create parent_profiles table
CREATE TABLE IF NOT EXISTS public.parent_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone_number TEXT NOT NULL,  -- Primary contact for SMS
    phone_number_2 TEXT,
    address TEXT,
    occupation TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on parent_profiles
ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parent_profiles
CREATE POLICY "Parents can view own profile" ON public.parent_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Parents can update own profile" ON public.parent_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Staff can view parent profiles" ON public.parent_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND school_id = parent_profiles.school_id
        )
    );

CREATE POLICY "Staff can manage parent profiles" ON public.parent_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND school_id = parent_profiles.school_id
            AND role IN ('Admin', 'Super_Admin', 'School_Admin', 'Principal')
        )
    );

-- 2. Create parent_student_links table
CREATE TABLE IF NOT EXISTS public.parent_student_links (
    id SERIAL PRIMARY KEY,
    parent_id UUID REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK (relationship IN ('Father', 'Mother', 'Guardian', 'Other')),
    is_primary_contact BOOLEAN DEFAULT FALSE,
    can_view_reports BOOLEAN DEFAULT TRUE,
    can_view_finances BOOLEAN DEFAULT TRUE,
    can_view_attendance BOOLEAN DEFAULT TRUE,
    can_communicate BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- Enable RLS on parent_student_links
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parent_student_links
CREATE POLICY "Parents can view own links" ON public.parent_student_links
    FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "Staff can manage links" ON public.parent_student_links
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.students s ON s.school_id = up.school_id
            WHERE up.id = auth.uid() AND s.id = parent_student_links.student_id
        )
    );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_parent_profiles_school_id ON public.parent_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_parent_profiles_phone ON public.parent_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent ON public.parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student ON public.parent_student_links(student_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
