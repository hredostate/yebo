import { requireSupabaseClient } from './supabaseClient';
import type {
    Payslip,
    PayslipQuery,
    PayrollProcessingMethod,
    PayrollRunV2,
    PayslipStatus,
    PayrollRunV2Status
} from '../types';

const AUDIT_ACTIONS = {
    publish: 'payroll.pre_run.publish',
    approve: 'payroll.payslip.approve',
    query: 'payroll.payslip.query',
    resolve: 'payroll.payslip.resolve',
    finalize: 'payroll.run.finalize',
    processOffline: 'payroll.run.process_offline',
    processPaystack: 'payroll.run.process_paystack'
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
    const { error } = await supabase
        .from('payroll_runs_v2')
        .update({ status: 'PRE_RUN_PUBLISHED' as PayrollRunV2Status, published_at: new Date().toISOString(), published_by: actorId })
        .eq('id', runId);

    if (error) throw error;
    await logAudit(AUDIT_ACTIONS.publish, actorId, { run_id: runId, status: 'PRE_RUN_PUBLISHED' });
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
