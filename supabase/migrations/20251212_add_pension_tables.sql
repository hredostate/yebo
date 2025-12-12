-- Migration: Add comprehensive pension calculation tables
-- Created: 2025-12-12

-- Table: staff_pension - Staff pension configuration
CREATE TABLE IF NOT EXISTS staff_pension (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    is_enrolled BOOLEAN DEFAULT FALSE NOT NULL,
    enrollment_date DATE,
    pension_provider TEXT,
    pension_pin TEXT,
    
    -- Employee Contribution (always active when enrolled)
    employee_contribution_type TEXT DEFAULT 'percentage' NOT NULL CHECK (employee_contribution_type IN ('percentage', 'fixed')),
    employee_contribution_value NUMERIC DEFAULT 8.00 NOT NULL,
    
    -- Employer Contribution (TOGGLE ON/OFF)
    employer_contribution_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    employer_contribution_type TEXT DEFAULT 'percentage' NOT NULL CHECK (employer_contribution_type IN ('percentage', 'fixed')),
    employer_contribution_value NUMERIC DEFAULT 10.00 NOT NULL,
    
    -- Voluntary Contribution (TOGGLE ON/OFF)
    voluntary_contribution_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    voluntary_contribution_type TEXT DEFAULT 'fixed' NOT NULL CHECK (voluntary_contribution_type IN ('percentage', 'fixed')),
    voluntary_contribution_value NUMERIC DEFAULT 0 NOT NULL,
    
    -- Preexisting Pension
    has_preexisting_pension BOOLEAN DEFAULT FALSE NOT NULL,
    preexisting_pension_amount NUMERIC DEFAULT 0 NOT NULL,
    preexisting_pension_months INTEGER DEFAULT 0 NOT NULL,
    preexisting_pension_provider TEXT,
    preexisting_pension_pin TEXT,
    preexisting_pension_transfer_date DATE,
    preexisting_pension_verified BOOLEAN DEFAULT FALSE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table: pension_contributions - Monthly contribution records
CREATE TABLE IF NOT EXISTS pension_contributions (
    id SERIAL PRIMARY KEY,
    staff_pension_id INTEGER REFERENCES staff_pension(id) ON DELETE CASCADE NOT NULL,
    payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE SET NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    contribution_month DATE NOT NULL, -- first day of month
    period_label TEXT NOT NULL, -- e.g., 'December 2025'
    gross_salary NUMERIC NOT NULL,
    
    -- Config snapshot at time of calculation
    employee_type TEXT NOT NULL CHECK (employee_type IN ('percentage', 'fixed')),
    employee_value NUMERIC NOT NULL,
    employer_enabled BOOLEAN NOT NULL,
    employer_type TEXT NOT NULL CHECK (employer_type IN ('percentage', 'fixed')),
    employer_value NUMERIC NOT NULL,
    voluntary_enabled BOOLEAN NOT NULL,
    voluntary_type TEXT NOT NULL CHECK (voluntary_type IN ('percentage', 'fixed')),
    voluntary_value NUMERIC NOT NULL,
    
    -- This month's amounts
    employee_contribution NUMERIC NOT NULL,
    employer_contribution NUMERIC DEFAULT 0 NOT NULL,
    voluntary_contribution NUMERIC DEFAULT 0 NOT NULL,
    total_contribution NUMERIC NOT NULL,
    deduction_from_salary NUMERIC NOT NULL, -- employee + voluntary
    
    -- Cumulative totals
    cumulative_employee NUMERIC NOT NULL,
    cumulative_employer NUMERIC NOT NULL,
    cumulative_voluntary NUMERIC NOT NULL,
    cumulative_total NUMERIC NOT NULL,
    
    -- Month tracking
    month_number INTEGER NOT NULL, -- 1, 2, 3... excluding preexisting
    total_service_months INTEGER NOT NULL, -- including preexisting
    
    status TEXT DEFAULT 'recorded' NOT NULL CHECK (status IN ('recorded', 'remitted', 'confirmed')),
    remittance_reference TEXT,
    remitted_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Unique constraint: one contribution per user per month
    UNIQUE(user_id, contribution_month)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_pension_user_id ON staff_pension(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_pension_school_id ON staff_pension(school_id);
CREATE INDEX IF NOT EXISTS idx_pension_contributions_user_id ON pension_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_pension_contributions_school_id ON pension_contributions(school_id);
CREATE INDEX IF NOT EXISTS idx_pension_contributions_month ON pension_contributions(contribution_month);
CREATE INDEX IF NOT EXISTS idx_pension_contributions_staff_pension_id ON pension_contributions(staff_pension_id);
CREATE INDEX IF NOT EXISTS idx_pension_contributions_payroll_run_id ON pension_contributions(payroll_run_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_staff_pension_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on staff_pension
CREATE TRIGGER trigger_update_staff_pension_updated_at
    BEFORE UPDATE ON staff_pension
    FOR EACH ROW
    EXECUTE FUNCTION update_staff_pension_updated_at();

-- RLS Policies
ALTER TABLE staff_pension ENABLE ROW LEVEL SECURITY;
ALTER TABLE pension_contributions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own school's pension data
CREATE POLICY staff_pension_select_policy ON staff_pension
    FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users with appropriate permissions can insert pension configs
CREATE POLICY staff_pension_insert_policy ON staff_pension
    FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users with appropriate permissions can update pension configs
CREATE POLICY staff_pension_update_policy ON staff_pension
    FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can delete their own school's pension configs
CREATE POLICY staff_pension_delete_policy ON staff_pension
    FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can view their own school's pension contributions
CREATE POLICY pension_contributions_select_policy ON pension_contributions
    FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: System can insert pension contributions (typically via Edge Functions)
CREATE POLICY pension_contributions_insert_policy ON pension_contributions
    FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can update pension contributions in their school
CREATE POLICY pension_contributions_update_policy ON pension_contributions
    FOR UPDATE
    USING (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Policy: Users can delete pension contributions in their school
CREATE POLICY pension_contributions_delete_policy ON pension_contributions
    FOR DELETE
    USING (
        school_id IN (
            SELECT school_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TABLE staff_pension IS 'Stores pension configuration for staff members';
COMMENT ON TABLE pension_contributions IS 'Stores monthly pension contribution records';
COMMENT ON COLUMN staff_pension.employee_contribution_type IS 'Type of employee contribution: percentage or fixed amount';
COMMENT ON COLUMN staff_pension.employer_contribution_enabled IS 'Toggle to enable/disable employer contributions';
COMMENT ON COLUMN staff_pension.voluntary_contribution_enabled IS 'Toggle to enable/disable voluntary contributions';
COMMENT ON COLUMN pension_contributions.contribution_month IS 'First day of the month for this contribution';
COMMENT ON COLUMN pension_contributions.deduction_from_salary IS 'Total amount deducted from staff salary (employee + voluntary)';
COMMENT ON COLUMN pension_contributions.month_number IS 'Month number excluding preexisting pension months';
COMMENT ON COLUMN pension_contributions.total_service_months IS 'Total service months including preexisting pension';
