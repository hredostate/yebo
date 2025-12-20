// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const collectUserPermissions = async (client: any, userId: string, primaryRole?: string | null) => {
  const permissions = new Set<string>();
  const { data: roles } = await client.from('roles').select('id, title, permissions');

  const primary = roles?.find((r: any) => r.title === primaryRole);
  primary?.permissions?.forEach((p: string) => permissions.add(p));

  const { data: assignments } = await client.from('user_role_assignments').select('role_id').eq('user_id', userId);
  assignments?.forEach((assignment: any) => {
    const role = roles?.find((r: any) => r.id === assignment.role_id);
    role?.permissions?.forEach((p: string) => permissions.add(p));
  });

  if (primaryRole && (primaryRole === 'Admin' || primaryRole === 'Super Admin')) {
    permissions.add('*');
  }

  return permissions;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { runId } = await req.json();
    if (!runId) {
      throw new Error("Invalid request body. 'runId' is required.");
    }

    // Get user profile
    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .single();
    
    if (!userProfile) throw new Error('User profile not found.');

    // Check permissions
    const permissionSet = await collectUserPermissions(supabaseClient, user.id, userProfile.role);
    const hasPayrollAccess = permissionSet.has('*') || permissionSet.has('manage-payroll') || permissionSet.has('manage-finance');
    if (!hasPayrollAccess) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: insufficient permissions' }), 
        { status: 403, headers: corsHeaders }
      );
    }

    // Use Service Role for backend operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 1. Fetch the payroll run from V2
    const { data: run, error: runError } = await adminClient
      .from('payroll_runs_v2')
      .select('*')
      .eq('id', runId)
      .single();
    
    if (runError) throw new Error(`Failed to fetch payroll run: ${runError.message}`);
    if (!run) throw new Error('Payroll run not found');

    // 2. Verify the run is in FINALIZED status
    if (run.status !== 'FINALIZED') {
      throw new Error(`Payroll run must be in FINALIZED status. Current status: ${run.status}`);
    }

    // 3. Fetch all finalized payslips for this run
    const { data: payslips, error: payslipsError } = await adminClient
      .from('payslips')
      .select(`
        id,
        staff_id,
        gross_pay,
        total_deductions,
        net_pay,
        line_items:payslip_line_items(*),
        staff:user_profiles(id, name, account_number, bank_code, account_name)
      `)
      .eq('payroll_run_id', runId)
      .eq('status', 'FINAL');
    
    if (payslipsError) throw new Error(`Failed to fetch payslips: ${payslipsError.message}`);
    
    if (!payslips || payslips.length === 0) {
      throw new Error('No finalized payslips found for this run');
    }

    // 4. Create a record in payroll_runs table
    const totalAmount = payslips.reduce((sum: number, p: any) => sum + (p.net_pay || 0), 0);
    
    const { data: legacyRun, error: legacyRunError } = await adminClient
      .from('payroll_runs')
      .insert({
        school_id: run.school_id,
        period_label: run.period_key,
        total_amount: totalAmount,
        status: 'completed',
        processing_method: 'OFFLINE',
        created_by: user.id,
        meta: {
          v2_run_id: runId,
          processed_offline: true,
          processed_at: new Date().toISOString()
        }
      })
      .select()
      .single();
      
    if (legacyRunError) throw new Error(`Failed to create legacy payroll run: ${legacyRunError.message}`);

    // 5. Create records in payroll_items for each payslip
    const payrollItems = payslips.map((payslip: any) => {
      // Build deductions array from line items
      const lineItems = payslip.line_items || [];
      const deductions = lineItems
        .filter((item: any) => item.type === 'DEDUCTION')
        .map((item: any) => ({
          label: item.label,
          amount: -Math.abs(item.amount) // Ensure negative for deductions
        }));
      
      // Add earnings as positive amounts
      const earnings = lineItems
        .filter((item: any) => item.type === 'EARNING')
        .map((item: any) => ({
          label: item.label,
          amount: item.amount
        }));

      return {
        payroll_run_id: legacyRun.id,
        user_id: payslip.staff_id,
        gross_amount: payslip.gross_pay,
        deductions: [...earnings, ...deductions],
        net_amount: payslip.net_pay,
        narration: `Salary payment for ${run.period_key}`,
        payment_method: 'OFFLINE',
        status: 'pending_manual_transfer',
        paystack_recipient_code: null
      };
    });

    const { error: itemsError } = await adminClient
      .from('payroll_items')
      .insert(payrollItems);
      
    if (itemsError) throw new Error(`Failed to create payroll items: ${itemsError.message}`);

    // 6. Update payroll_runs_v2 status to PROCESSED_OFFLINE
    const { error: updateError } = await adminClient
      .from('payroll_runs_v2')
      .update({ 
        status: 'PROCESSED_OFFLINE',
        processing_method: 'OFFLINE',
        meta: {
          ...run.meta,
          legacy_run_id: legacyRun.id,
          processed_at: new Date().toISOString(),
          processed_by: user.id
        }
      })
      .eq('id', runId);
      
    if (updateError) throw new Error(`Failed to update V2 run status: ${updateError.message}`);

    // 7. Return success with summary
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Payroll processed offline successfully',
      data: {
        runId: runId,
        legacyRunId: legacyRun.id,
        staffCount: payslips.length,
        totalAmount: totalAmount,
        periodKey: run.period_key
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing offline payroll:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
