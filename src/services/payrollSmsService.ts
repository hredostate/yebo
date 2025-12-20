import { requireSupabaseClient } from './supabaseClient';
import { sendNotificationWithChannel } from './kudiSmsService';

/**
 * Notify a single staff member that their payslip is published
 */
export async function notifyStaffPayslipPublished(params: {
    schoolId: number;
    staffId: string;
    staffName: string;
    staffPhone: string;
    periodKey: string;
}): Promise<boolean> {
    const { schoolId, staffId, staffName, staffPhone, periodKey } = params;
    
    if (!staffPhone) {
        console.warn(`No phone number for staff ${staffId}`);
        return false;
    }

    try {
        const result = await sendNotificationWithChannel('payslip_published' as any, {
            schoolId,
            recipientPhone: staffPhone,
            templateName: 'payslip_published',
            variables: {
                staff_name: staffName,
                period: periodKey
            }
        });

        return result.success;
    } catch (error) {
        console.error('Failed to send payslip notification:', error);
        return false;
    }
}

/**
 * Notify all staff in a payroll run that their payslips are published
 */
export async function notifyAllStaffPayslipsPublished(
    runId: string,
    schoolId: number
): Promise<{ sent: number; failed: number }> {
    const supabase = requireSupabaseClient();
    
    // Get all payslips with staff details
    const { data: payslips, error } = await supabase
        .from('payslips')
        .select('staff_id, staff:user_profiles(id, name, phone_number)')
        .eq('payroll_run_id', runId);

    if (error || !payslips) {
        console.error('Failed to fetch payslips:', error);
        return { sent: 0, failed: 0 };
    }

    // Get the period key from the run
    const { data: run } = await supabase
        .from('payroll_runs_v2')
        .select('period_key')
        .eq('id', runId)
        .single();

    const periodKey = run?.period_key || 'current period';

    let sent = 0;
    let failed = 0;

    for (const payslip of payslips) {
        const staff = payslip.staff as any;
        if (!staff?.phone_number) {
            failed++;
            continue;
        }

        const success = await notifyStaffPayslipPublished({
            schoolId,
            staffId: payslip.staff_id,
            staffName: staff.name || 'Staff',
            staffPhone: staff.phone_number,
            periodKey
        });

        if (success) {
            sent++;
        } else {
            failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { sent, failed };
}
