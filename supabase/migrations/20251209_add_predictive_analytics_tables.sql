-- ============================================
-- Predictive Analytics Tables Migration
-- ============================================

-- Risk predictions table
CREATE TABLE IF NOT EXISTS public.risk_predictions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  factors JSONB,
  recommended_actions TEXT[],
  predicted_for DATE,
  trend VARCHAR(20) CHECK (trend IN ('improving', 'stable', 'declining')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Learning paths table
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  path_data JSONB NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated reports table
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
  report_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule optimizations table
CREATE TABLE IF NOT EXISTS public.schedule_optimizations (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  term_id INTEGER REFERENCES public.terms(id) ON DELETE CASCADE,
  optimization_score INTEGER CHECK (optimization_score >= 0 AND optimization_score <= 100),
  schedule_data JSONB NOT NULL,
  constraints_satisfied TEXT[],
  constraints_violated TEXT[],
  applied BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prediction accuracy tracking
CREATE TABLE IF NOT EXISTS public.prediction_accuracy (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  prediction_type VARCHAR(50),
  total_predictions INTEGER DEFAULT 0,
  accurate_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_risk_predictions_student ON public.risk_predictions(student_id);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_school ON public.risk_predictions(school_id);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_date ON public.risk_predictions(predicted_for);
CREATE INDEX IF NOT EXISTS idx_learning_paths_student ON public.learning_paths(student_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_school ON public.learning_paths(school_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_student ON public.generated_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_term ON public.generated_reports(term_id);
CREATE INDEX IF NOT EXISTS idx_schedule_optimizations_term ON public.schedule_optimizations(term_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.risk_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_accuracy ENABLE ROW LEVEL SECURITY;

-- RLS Policies for risk_predictions
CREATE POLICY "Users can view risk predictions for their school"
  ON public.risk_predictions FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert risk predictions for their school"
  ON public.risk_predictions FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update risk predictions for their school"
  ON public.risk_predictions FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for learning_paths
CREATE POLICY "Users can view learning paths for their school"
  ON public.learning_paths FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert learning paths for their school"
  ON public.learning_paths FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update learning paths for their school"
  ON public.learning_paths FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for generated_reports
CREATE POLICY "Users can view generated reports for their school"
  ON public.generated_reports FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert generated reports for their school"
  ON public.generated_reports FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update generated reports for their school"
  ON public.generated_reports FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for schedule_optimizations
CREATE POLICY "Users can view schedule optimizations for their school"
  ON public.schedule_optimizations FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert schedule optimizations for their school"
  ON public.schedule_optimizations FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update schedule optimizations for their school"
  ON public.schedule_optimizations FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for prediction_accuracy
CREATE POLICY "Users can view prediction accuracy for their school"
  ON public.prediction_accuracy FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert prediction accuracy for their school"
  ON public.prediction_accuracy FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );
