/**
 * Report Card Service
 * Handles generation and distribution of report card links via SMS
 */

import { supa as supabase } from '../offline/client';
import { sendSmsNotification } from './smsService';

interface SendReportCardParams {
    studentId: number;
    termId: number;
    schoolId: number;
    recipientPhone: string;
    studentName: string;
    termName: string;
    className: string;
}

interface BulkSendStudent {
    studentId: number;
    studentName: string;
    parentPhone: string;
    className: string;
}

interface BulkSendParams {
    students: BulkSendStudent[];
    termId: number;
    termName: string;
    schoolId: number;
    userId: string;
}

interface SendResult {
    success: boolean;
    error?: string;
    token?: string;
}

interface BulkSendResult {
    sent: number;
    failed: number;
    errors: Array<{ studentId: number; studentName: string; error: string }>;
}

/**
 * Generate and send report card link to a single parent
 */
export async function sendReportCardToParent(params: SendReportCardParams): Promise<SendResult> {
    const { studentId, termId, schoolId, recipientPhone, studentName, termName, className } = params;

    try {
        // 1. Get or create the student term report
        const { data: existingReport, error: fetchError } = await supabase
            .from('student_term_reports')
            .select('id, public_token, token_expires_at')
            .eq('student_id', studentId)
            .eq('term_id', termId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching student term report:', fetchError);
            return { success: false, error: 'Failed to fetch report' };
        }

        let reportId: number;
        let token: string;

        // 2. Check if we need to generate a new token
        const now = new Date();
        const needsNewToken = !existingReport?.public_token || 
            !existingReport?.token_expires_at || 
            new Date(existingReport.token_expires_at) <= now;

        if (needsNewToken) {
            // Generate new token with 30-day expiry
            // Use crypto.randomUUID() with fallback for compatibility
            token = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            if (existingReport) {
                // Update existing report with new token
                const { error: updateError } = await supabase
                    .from('student_term_reports')
                    .update({
                        public_token: token,
                        token_expires_at: expiresAt.toISOString()
                    })
                    .eq('id', existingReport.id);

                if (updateError) {
                    console.error('Error updating token:', updateError);
                    return { success: false, error: 'Failed to update token' };
                }
                reportId = existingReport.id;
            } else {
                // Create new report with token
                const { data: newReport, error: createError } = await supabase
                    .from('student_term_reports')
                    .insert({
                        student_id: studentId,
                        term_id: termId,
                        school_id: schoolId,
                        public_token: token,
                        token_expires_at: expiresAt.toISOString()
                    })
                    .select('id')
                    .single();

                if (createError || !newReport) {
                    console.error('Error creating report:', createError);
                    return { success: false, error: 'Failed to create report' };
                }
                reportId = newReport.id;
            }
        } else {
            // Use existing valid token
            token = existingReport.public_token!;
            reportId = existingReport.id;
        }

        // 3. Build the public URL
        const downloadLink = `${window.location.origin}/report/${token}`;

        // 4. Send SMS notification
        const smsSuccess = await sendSmsNotification({
            schoolId,
            studentId,
            recipientPhone,
            templateName: 'report_card_ready',
            variables: {
                student_name: studentName,
                term: termName,
                class_name: className,
                download_link: downloadLink
            },
            referenceId: reportId,
            notificationType: 'report_card_ready',
            sentBy: 'system'
        });

        if (!smsSuccess) {
            return { success: false, error: 'Failed to send SMS' };
        }

        return { success: true, token };
    } catch (error) {
        console.error('Error in sendReportCardToParent:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Bulk send report cards to multiple parents
 */
export async function bulkSendReportCards(params: BulkSendParams): Promise<BulkSendResult> {
    const { students, termId, termName, schoolId } = params;

    const result: BulkSendResult = {
        sent: 0,
        failed: 0,
        errors: []
    };

    // Rate limiting: 100-150ms delay between sends
    for (const student of students) {
        const sendResult = await sendReportCardToParent({
            studentId: student.studentId,
            termId,
            schoolId,
            recipientPhone: student.parentPhone,
            studentName: student.studentName,
            termName,
            className: student.className
        });

        if (sendResult.success) {
            result.sent++;
        } else {
            result.failed++;
            result.errors.push({
                studentId: student.studentId,
                studentName: student.studentName,
                error: sendResult.error || 'Unknown error'
            });
        }

        // Random delay between 100-150ms to avoid API throttling
        const delay = Math.floor(Math.random() * 51) + 100;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    return result;
}
