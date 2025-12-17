-- Migration: Enhance payslip schema with components, line items, and pension base tracking
-- Date: 2026-03-20

-- Payroll components allow admins to configure what appears on payslips
CREATE TABLE IF NOT EXISTS payroll_components (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_payroll_components_school_id ON payroll_components(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_components_type ON payroll_components(component_type);

-- Line items are the canonical record of what a staff member earned/deducted in a run
CREATE TABLE IF NOT EXISTS payroll_line_items (
    id SERIAL PRIMARY KEY,
    payroll_item_id INTEGER REFERENCES payroll_items(id) ON DELETE CASCADE NOT NULL,
    component_id INTEGER REFERENCES payroll_components(id) ON DELETE SET NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('earning', 'deduction', 'employer_contrib')),
    amount NUMERIC NOT NULL DEFAULT 0,
    units NUMERIC,
    rate NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_line_items_item ON payroll_line_items(payroll_item_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_component ON payroll_line_items(component_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_category ON payroll_line_items(category);

-- Enrich payroll runs and items with export and auditing metadata
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS pay_period_start DATE;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS pay_period_end DATE;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS pay_date DATE;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS pay_period_label TEXT;

ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS pay_date DATE;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS role_title TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS total_employer_contributions NUMERIC DEFAULT 0;

-- Pension base alias for easier reporting
ALTER TABLE pension_contributions ADD COLUMN IF NOT EXISTS pension_base NUMERIC;
UPDATE pension_contributions SET pension_base = gross_salary WHERE pension_base IS NULL;
