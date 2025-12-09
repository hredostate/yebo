-- Create report templates table
CREATE TABLE IF NOT EXISTS public.report_templates (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create generated reports history table
CREATE TABLE IF NOT EXISTS public.generated_reports_history (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES public.report_templates(id) ON DELETE SET NULL,
    report_type VARCHAR(100),
    report_name VARCHAR(255),
    parameters JSONB,
    file_url TEXT,
    format VARCHAR(20),
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create scheduled reports table
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES public.report_templates(id) ON DELETE CASCADE,
    schedule_config JSONB NOT NULL,
    recipients TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_report_templates_school_id ON public.report_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON public.report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_generated_reports_school_id ON public.generated_reports_history(school_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_template_id ON public.generated_reports_history(template_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_school_id ON public.scheduled_reports(school_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_template_id ON public.scheduled_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON public.scheduled_reports(next_run_at) WHERE is_active = TRUE;

-- Add updated_at trigger for report_templates
CREATE OR REPLACE FUNCTION update_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_templates_updated_at
    BEFORE UPDATE ON public.report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_report_templates_updated_at();

-- Add updated_at trigger for scheduled_reports
CREATE OR REPLACE FUNCTION update_scheduled_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scheduled_reports_updated_at
    BEFORE UPDATE ON public.scheduled_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_reports_updated_at();

-- Add RLS policies (Row Level Security)
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Policies for report_templates
CREATE POLICY "Users can view report templates in their school"
    ON public.report_templates FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        )
        OR is_public = TRUE
    );

CREATE POLICY "Users can create report templates in their school"
    ON public.report_templates FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own report templates"
    ON public.report_templates FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own report templates"
    ON public.report_templates FOR DELETE
    USING (created_by = auth.uid());

-- Policies for generated_reports_history
CREATE POLICY "Users can view reports in their school"
    ON public.generated_reports_history FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create reports in their school"
    ON public.generated_reports_history FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

-- Policies for scheduled_reports
CREATE POLICY "Users can view scheduled reports in their school"
    ON public.scheduled_reports FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create scheduled reports in their school"
    ON public.scheduled_reports FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own scheduled reports"
    ON public.scheduled_reports FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own scheduled reports"
    ON public.scheduled_reports FOR DELETE
    USING (created_by = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE public.report_templates IS 'Stores custom report templates created by users';
COMMENT ON TABLE public.generated_reports_history IS 'Tracks history of generated reports';
COMMENT ON TABLE public.scheduled_reports IS 'Manages scheduled report generation and distribution';
