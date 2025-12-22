-- ============================================
-- Review Enforcement Tracking Migration
-- Add anti-rubber-stamping tracking columns
-- ============================================

-- Add anti-rubber-stamping tracking columns to review evidence
ALTER TABLE public.lesson_plan_review_evidence
ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0;

ALTER TABLE public.lesson_plan_review_evidence
ADD COLUMN IF NOT EXISTS scroll_depth_reached INTEGER DEFAULT 0;

ALTER TABLE public.lesson_plan_review_evidence
ADD COLUMN IF NOT EXISTS feedback_similarity_warning BOOLEAN DEFAULT false;

ALTER TABLE public.lesson_plan_review_evidence
ADD COLUMN IF NOT EXISTS active_review_time_seconds INTEGER;

ALTER TABLE public.lesson_plan_review_evidence
ADD COLUMN IF NOT EXISTS checklist_completion_order TEXT[];

-- Create index for review quality analysis
CREATE INDEX IF NOT EXISTS idx_review_evidence_quality_metrics
ON public.lesson_plan_review_evidence(pause_count, scroll_depth_reached, active_review_time_seconds);

-- Create view for review quality dashboard
CREATE OR REPLACE VIEW public.review_quality_metrics AS
SELECT 
    reviewer_id,
    COUNT(*) as total_reviews,
    AVG(time_spent_seconds) as avg_time_spent,
    AVG(active_review_time_seconds) as avg_active_time,
    AVG(scroll_depth_reached) as avg_scroll_depth,
    AVG(pause_count) as avg_pause_count,
    AVG(quality_rating) as avg_quality_given,
    COUNT(CASE WHEN decision = 'approved' THEN 1 END)::float / NULLIF(COUNT(*)::float, 0) as approval_rate,
    COUNT(CASE WHEN feedback_similarity_warning THEN 1 END) as similar_feedback_count
FROM public.lesson_plan_review_evidence
GROUP BY reviewer_id;

-- Grant access to the view
GRANT SELECT ON public.review_quality_metrics TO authenticated;
