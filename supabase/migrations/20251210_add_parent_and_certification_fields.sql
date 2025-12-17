-- Add parent contact fields to students and staff certification table

-- 1) Parent/Guardian fields on students
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'father_name') THEN
        ALTER TABLE public.students ADD COLUMN father_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'father_phone') THEN
        ALTER TABLE public.students ADD COLUMN father_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'father_email') THEN
        ALTER TABLE public.students ADD COLUMN father_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'mother_name') THEN
        ALTER TABLE public.students ADD COLUMN mother_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'mother_phone') THEN
        ALTER TABLE public.students ADD COLUMN mother_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'mother_email') THEN
        ALTER TABLE public.students ADD COLUMN mother_email TEXT;
    END IF;
END $$;

-- 2) Staff certifications table (multi-document)
CREATE TABLE IF NOT EXISTS public.staff_certifications (
    id BIGSERIAL PRIMARY KEY,
    staff_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    size BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    certification_type TEXT,
    certification_number TEXT,
    expiry_date DATE
);

CREATE INDEX IF NOT EXISTS staff_certifications_staff_id_idx ON public.staff_certifications(staff_id);

-- Enable RLS and add policies for owner/admin access
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

-- 3) Private storage bucket for certifications
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('staff-certifications', 'staff-certifications', false)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Scoped storage policies for the private bucket
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff certifications upload') THEN
            CREATE POLICY "Staff certifications upload" ON storage.objects
                FOR INSERT TO authenticated
                WITH CHECK (bucket_id = 'staff-certifications');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff certifications select') THEN
            CREATE POLICY "Staff certifications select" ON storage.objects
                FOR SELECT TO authenticated
                USING (
                    bucket_id = 'staff-certifications'
                );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff certifications delete') THEN
            CREATE POLICY "Staff certifications delete" ON storage.objects
                FOR DELETE TO authenticated
                USING (bucket_id = 'staff-certifications');
        END IF;
    END IF;
END $$;
