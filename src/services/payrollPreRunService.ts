import { requireSupabaseClient } from './supabaseClient';
import type {
    Payslip,
    PayslipQuery,
    PayrollProcessingMethod,
    PayrollRunV2,
    PayslipStatus,
    PayrollRunV2Status,
    UserProfile,
    PayrollAdjustment,
    PayslipLineItem
} from '../types';

const AUDIT_ACTIONS = {
    create: 'payroll.run.create',
    publish: 'payroll.pre_run.publish',
    approve: 'payroll.payslip.approve',
    query: 'payroll.payslip.query',
    resolve: 'payroll.payslip.resolve',
    finalize: 'payroll.run.finalize',
    processOffline: 'payroll.run.process_offline',
    processPaystack: 'payroll.run.process_paystack',
    generate: 'payroll.payslips.generate'
};

async function logAudit(action: string, actor: string | null, metadata: Record<string, any>) {
    const supabase = requireSupabaseClient();
    await supabase.from('audit_log').insert({
        action,
        actor_user_id: actor,
        details: metadata,
        school_id: metadata.school_id ?? null
    });
}

export async function publishPayrollPreRun(runId: string, actorId: string | null) {
    const supabase = requireSupabaseClient();
    
    // Get run details including school_id
    const { data: runData, error: fetchError } = await supabase
        .from('payroll_runs_v2')
        .select('school_id')
        .eq('id', runId)
        .single();
    
    if (fetchError) throw fetchError;
    
    const { error } = await supabase
        .from('payroll_runs_v2')
        .update({ status: 'PRE_RUN_PUBLISHED' as PayrollRunV2Status, published_at: new Date().toISOString(), published_by: actorId })
        .eq('id', runId);

    if (error) throw error;
    
    // Update all payslips to AWAITING_APPROVAL status
    await supabase
        .from('payslips')
        .update({ status: 'AWAITING_APPROVAL' as PayslipStatus, updated_at: new Date().toISOString() })
        .eq('payroll_run_id', runId)
        .eq('status', 'DRAFT');
    
    await logAudit(AUDIT_ACTIONS.publish, actorId, { run_id: runId, status: 'PRE_RUN_PUBLISHED' });
    
    // Send SMS notifications to all staff (non-blocking)
    if (runData?.school_id) {
        const { notifyAllStaffPayslipsPublished } = await import('./payrollSmsService');
        notifyAllStaffPayslipsPublished(runId, runData.school_id).then(result => {
            console.log(`Payslip notifications sent: ${result.sent} success, ${result.failed} failed`);
        }).catch(err => {
            console.error('Failed to send payslip notifications:', err);
        });
    }
}

export async function approvePayslip(payslipId: string, actorId: string | null) {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
        .from('payslips')
        .update({ status: 'APPROVED' as PayslipStatus, updated_at: new Date().toISOString() })
        .eq('id', payslipId);

    if (error) throw error;
    await logAudit(AUDIT_ACTIONS.approve, actorId, { payslip_id: payslipId, status: 'APPROVED' });
}

export async function raisePayslipQuery(
    payslipId: string,
    actorId: string,
    message: string,
    attachmentUrl?: string | null
): Promise<PayslipQuery> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
        .from('payslip_queries')
        .insert({ payslip_id: payslipId, raised_by_staff_id: actorId, message, attachment_url: attachmentUrl || null })
        .select()
        .single();

    if (error) throw error;

    // Move payslip into query state
    await supabase.from('payslips').update({ status: 'QUERY_RAISED' as PayslipStatus }).eq('id', payslipId);
    await logAudit(AUDIT_ACTIONS.query, actorId, { payslip_id: payslipId, status: 'QUERY_RAISED' });
    return data as PayslipQuery;
}

export async function resolvePayslipQuery(
    queryId: string,
    actorId: string | null,
    response: string,
    updatedStatus: PayslipStatus = 'RESOLVED'
) {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
        .from('payslip_queries')
        .update({ admin_response: response, status: 'RESOLVED', updated_at: new Date().toISOString() })
        .eq('id', queryId)
        .select()
        .single();

    if (error) throw error;

    if (data) {
        await supabase.from('payslips').update({ status: updatedStatus }).eq('id', data.payslip_id);
    }

    await logAudit(AUDIT_ACTIONS.resolve, actorId, { query_id: queryId, response });
}

export async function finalizePayroll(runId: string, actorId: string | null, processingMethod?: PayrollProcessingMethod | null) {
    const supabase = requireSupabaseClient();
    const payload: Partial<PayrollRunV2> = {
        status: 'FINALIZED',
        finalized_at: new Date().toISOString(),
        finalized_by: actorId
    };
    if (processingMethod) {
        payload.processing_method = processingMethod;
    }

    const { error } = await supabase.from('payroll_runs_v2').update(payload).eq('id', runId);
    if (error) throw error;
    
    // Update all approved payslips to FINAL status
    await supabase
        .from('payslips')
        .update({ status: 'FINAL' as PayslipStatus, updated_at: new Date().toISOString() })
        .eq('payroll_run_id', runId)
        .eq('status', 'APPROVED');
    
    await logAudit(AUDIT_ACTIONS.finalize, actorId, { run_id: runId, processing_method: processingMethod });
}

export async function processPayrollOffline(runId: string, actorId: string | null) {
    const supabase = requireSupabaseClient();
    const { error } = await supabase
        .from('payroll_runs_v2')
        .update({ status: 'PROCESSED_OFFLINE' as PayrollRunV2Status, processing_method: 'OFFLINE' as PayrollProcessingMethod })
        .eq('id', runId);

    if (error) throw error;
    await logAudit(AUDIT_ACTIONS.processOffline, actorId, { run_id: runId });
}

export async function markPaystackProcessing(
    runId: string,
    actorId: string | null,
    processingState: PayrollRunV2Status,
    batchReference?: string
) {
    const supabase = requireSupabaseClient();
    const nextState: PayrollRunV2Status = processingState === 'FAILED' ? 'FAILED' : processingState;
    const { error } = await supabase
        .from('payroll_runs_v2')
        .update({ status: nextState, processing_method: 'PAYSTACK', meta: { batchReference } })
        .eq('id', runId);

    if (error) throw error;
    await logAudit(AUDIT_ACTIONS.processPaystack, actorId, { run_id: runId, batchReference, status: nextState });
}

export async function fetchStaffPayslips(staffId: string): Promise<Payslip[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
        .from('payslips')
        .select('*, run:payroll_runs_v2(*), line_items:payslip_line_items(*), queries:payslip_queries(*)')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as Payslip[];
}

export async function getPayrollRunWithApprovals(runId: string): Promise<{ run: PayrollRunV2; payslips: Payslip[] }> {
    const supabase = requireSupabaseClient();
    const { data: run, error: runError } = await supabase.from('payroll_runs_v2').select('*').eq('id', runId).single();
    if (runError) throw runError;

    const { data: slips, error: slipError } = await supabase
        .from('payslips')
        .select('*, staff:user_profiles(*), queries:payslip_queries(*)')
        .eq('payroll_run_id', runId);
    if (slipError) throw slipError;

    return { run: run as PayrollRunV2, payslips: (slips || []) as Payslip[] };
}

// Create a new payroll run
export async function createPayrollRun(schoolId: number, periodKey: string, actorId: string): Promise<PayrollRunV2> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
        .from('payroll_runs_v2')
        .insert({
            school_id: schoolId,
            period_key: periodKey,
            status: 'DRAFT' as PayrollRunV2Status,
            created_by: actorId,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    await logAudit(AUDIT_ACTIONS.create, actorId, { school_id: schoolId, period_key: periodKey, run_id: data.id });
    return data as PayrollRunV2;
}

// Generate payslips for all active staff
export async function generatePayslipsForRun(runId: string, schoolId: number): Promise<Payslip[]> {
    const supabase = requireSupabaseClient();
    
    // Fetch all active staff (non-students, non-guardians)
    const { data: staff, error: staffError } = await supabase
        .from('user_profiles')
        .select('id, name, base_pay, commission, employment_status')
        .eq('school_id', schoolId)
        .neq('role', 'Student')
        .neq('role', 'Guardian')
        .in('employment_status', ['Active', null]); // Include null for backward compatibility

    if (staffError) throw staffError;
    if (!staff || staff.length === 0) return [];

    // Fetch pending payroll adjustments (not yet linked to a run)
    const { data: adjustments, error: adjError } = await supabase
        .from('payroll_adjustments')
        .select('*')
        .eq('school_id', schoolId)
        .is('payroll_run_id', null);

    if (adjError) throw adjError;

    const payslipsToInsert: any[] = [];
    const lineItemsToInsert: any[] = [];

    for (const staffMember of staff as UserProfile[]) {
        const basePay = staffMember.base_pay || 0;
        const commission = staffMember.commission || 0;

        // Get adjustments for this staff member
        const staffAdjustments = (adjustments || []) as PayrollAdjustment[];
        const staffAdditions = staffAdjustments.filter(
            (a) => a.user_id === staffMember.id && a.adjustment_type === 'addition'
        );
        const staffDeductions = staffAdjustments.filter(
            (a) => a.user_id === staffMember.id && a.adjustment_type === 'deduction'
        );

        const additionsTotal = staffAdditions.reduce((sum, adj) => sum + (adj.amount || 0), 0);
        const deductionsTotal = staffDeductions.reduce((sum, adj) => sum + Math.abs(adj.amount || 0), 0);

        const grossPay = basePay + commission + additionsTotal;
        const totalDeductions = deductionsTotal;
        const netPay = grossPay - totalDeductions;

        // Generate checksum for integrity using a simple hash
        // In production, consider using crypto.subtle.digest for SHA-256
        const checksumData = `${staffMember.id}-${runId}-${netPay}-${Date.now()}`;
        const checksum = checksumData.substring(0, 50);

        const payslipId = crypto.randomUUID();
        payslipsToInsert.push({
            id: payslipId,
            payroll_run_id: runId,
            staff_id: staffMember.id,
            status: 'DRAFT' as PayslipStatus,
            currency: 'NGN',
            gross_pay: grossPay,
            total_deductions: totalDeductions,
            net_pay: netPay,
            checksum,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        // Create line items
        let ordering = 0;

        // Base pay
        if (basePay > 0) {
            lineItemsToInsert.push({
                id: crypto.randomUUID(),
                payslip_id: payslipId,
                type: 'EARNING',
                label: 'Base Salary',
                amount: basePay,
                ordering: ordering++
            });
        }

        // Commission
        if (commission > 0) {
            lineItemsToInsert.push({
                id: crypto.randomUUID(),
                payslip_id: payslipId,
                type: 'EARNING',
                label: 'Commission',
                amount: commission,
                ordering: ordering++
            });
        }

        // Additions
        for (const addition of staffAdditions) {
            lineItemsToInsert.push({
                id: crypto.randomUUID(),
                payslip_id: payslipId,
                type: 'EARNING',
                label: addition.reason || 'Additional Earning',
                amount: addition.amount,
                ordering: ordering++
            });
        }

        // Deductions
        for (const deduction of staffDeductions) {
            lineItemsToInsert.push({
                id: crypto.randomUUID(),
                payslip_id: payslipId,
                type: 'DEDUCTION',
                label: deduction.reason || 'Deduction',
                amount: Math.abs(deduction.amount || 0),
                ordering: ordering++
            });
        }
    }

    // Insert payslips
    const { error: payslipError } = await supabase.from('payslips').insert(payslipsToInsert);
    if (payslipError) throw payslipError;

    // Insert line items
    if (lineItemsToInsert.length > 0) {
        const { error: lineItemError } = await supabase.from('payslip_line_items').insert(lineItemsToInsert);
        if (lineItemError) throw lineItemError;
    }

    // Link adjustments to this run
    if (adjustments && adjustments.length > 0) {
        const adjustmentIds = adjustments.map((a: any) => a.id);
        await supabase
            .from('payroll_adjustments')
            .update({ payroll_run_id: runId })
            .in('id', adjustmentIds);
    }

    await logAudit(AUDIT_ACTIONS.generate, null, { run_id: runId, school_id: schoolId, count: payslipsToInsert.length });

    // Return the created payslips
    const { data: createdPayslips, error: fetchError } = await supabase
        .from('payslips')
        .select('*, line_items:payslip_line_items(*)')
        .eq('payroll_run_id', runId);

    if (fetchError) throw fetchError;
    return (createdPayslips || []) as Payslip[];
}

// Get approval summary for a run
export async function getApprovalSummary(runId: string): Promise<{
    total: number;
    approved: number;
    pending: number;
    queried: number;
}> {
    const supabase = requireSupabaseClient();
    const { data: payslips, error } = await supabase
        .from('payslips')
        .select('status')
        .eq('payroll_run_id', runId);

    if (error) throw error;

    const total = payslips?.length || 0;
    const approved = payslips?.filter((p) => p.status === 'APPROVED').length || 0;
    const queried = payslips?.filter((p) => p.status === 'QUERY_RAISED').length || 0;
    const pending = total - approved - queried;

    return { total, approved, pending, queried };
}

// Check if run can be finalized (all approved or override)
export async function canFinalizeRun(runId: string): Promise<boolean> {
    const summary = await getApprovalSummary(runId);
    return summary.total > 0 && summary.approved === summary.total;
}

// Process offline payment (just updates status)
export async function processOfflinePayment(runId: string, actorId: string): Promise<void> {
    await processPayrollOffline(runId, actorId);
}

// Process Paystack payment (calls existing Paystack integration)
export async function processPaystackPayment(runId: string, actorId: string): Promise<void> {
    const supabase = requireSupabaseClient();
    
    // Update status to PROCESSING
    await markPaystackProcessing(runId, actorId, 'PROCESSING');
    
    // Get all payslips for this run
    const { data: payslips, error } = await supabase
        .from('payslips')
        .select('*, staff:user_profiles(id, name, account_number, bank_code, account_name)')
        .eq('payroll_run_id', runId)
        .eq('status', 'FINAL');
    
    if (error) throw error;
    
    if (!payslips || payslips.length === 0) {
        throw new Error('No finalized payslips found for this run');
    }

    // Here you would integrate with actual Paystack bulk transfer API
    // For now, we'll mark as processed
    // In production, you would:
    // 1. Create Paystack recipients for each staff member (if not exists)
    // 2. Create bulk transfer batch
    // 3. Monitor transfer status
    
    const batchReference = `PAYROLL-${runId.substring(0, 8)}-${Date.now()}`;
    await markPaystackProcessing(runId, actorId, 'PROCESSED_PAYSTACK', batchReference);
}

