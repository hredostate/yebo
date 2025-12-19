/**
 * SMS Service for Parent Notifications
 * Supports Kudi SMS integration for sending SMS and WhatsApp messages
 * with channel selection and fallback logic
 */

import { requireSupabaseClient } from './supabaseClient';
import type { SmsTemplate, SmsNotification, NotificationType, NotificationChannel } from '../types';

interface SendSmsParams {
    schoolId: number;
    studentId: number;
    recipientPhone: string;
    templateName: string;
    variables?: Record<string, string>;
    referenceId?: number;
    notificationType: NotificationType;
    sentBy: string;
}

interface BulkSendResult {
    sent: number;
    failed: number;
    errors: { phone: string; error: string }[];
}

/**
 * Send a notification via specific channel (SMS or WhatsApp)
 */
async function sendViaChannel(
    channel: 'sms' | 'whatsapp',
    recipientPhone: string,
    messageContent: string,
    schoolId: number,
    templateCode?: string,
    templateParams?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = requireSupabaseClient();
    try {
        const body: any = {
            phone_number: recipientPhone,
            school_id: schoolId,
        };

        if (channel === 'whatsapp') {
            body.gateway = '2';
            body.template_code = templateCode || '';
            body.params = templateParams || '';
        } else {
            body.gateway = '1';
            body.message = messageContent;
        }

        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
            'kudisms-send',
            { body }
        );

        if (sendError || !sendResult?.success) {
            return {
                success: false,
                error: sendError?.message || sendResult?.error || 'Unknown error'
            };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Send an SMS/WhatsApp notification using Kudi SMS integration
 * with channel selection and fallback logic
 */
export async function sendSmsNotification(params: SendSmsParams): Promise<boolean> {
    const supabase = requireSupabaseClient();
    const {
        schoolId,
        studentId,
        recipientPhone,
        templateName,
        variables = {},
        referenceId,
        notificationType,
        sentBy
    } = params;

    try {
        // 1. Get the template
        const { data: template, error: templateError } = await supabase
            .from('sms_templates')
            .select('*')
            .eq('school_id', schoolId)
            .eq('template_name', templateName)
            .eq('is_active', true)
            .single();

        if (templateError || !template) {
            console.error('Template not found:', templateName);
            return false;
        }

        // 2. Get Kudi SMS settings to determine channel preference
        const { data: settings } = await supabase
            .from('kudisms_settings')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .single();

        const channel: NotificationChannel = settings?.notification_channels?.[notificationType] || 'sms';
        const enableFallback = settings?.enable_fallback ?? true;
        const whatsappTemplateCode = settings?.whatsapp_template_codes?.[notificationType];

        // 3. Replace variables in message content
        let messageContent = template.message_content;
        if (template.variables && template.variables.length > 0) {
            template.variables.forEach((variable: string) => {
                const value = variables[variable] || '';
                messageContent = messageContent.replace(`{{${variable}}}`, value);
            });
        }

        // 4. Create notification record
        const { data: notification, error: notificationError } = await supabase
            .from('sms_notifications')
            .insert({
                school_id: schoolId,
                student_id: studentId,
                recipient_phone: recipientPhone,
                template_name: templateName,
                message_content: messageContent,
                notification_type: notificationType,
                reference_id: referenceId,
                status: 'pending',
                sent_by: sentBy
            })
            .select()
            .single();

        if (notificationError) {
            console.error('Failed to create notification record:', notificationError);
            return false;
        }

        // 5. Send via selected channel with fallback logic
        let sendResult: { success: boolean; error?: string };
        let usedChannel: 'sms' | 'whatsapp' = 'sms';
        let fallbackUsed = false;

        // Prepare WhatsApp template parameters (comma-separated values)
        const templateParams = template.variables?.map((v: string) => variables[v] || '').join(',');

        if (channel === 'whatsapp' || channel === 'both') {
            // Try WhatsApp first
            usedChannel = 'whatsapp';
            sendResult = await sendViaChannel(
                'whatsapp',
                recipientPhone,
                messageContent,
                schoolId,
                whatsappTemplateCode,
                templateParams
            );

            // Fallback to SMS if WhatsApp fails and fallback is enabled
            if (!sendResult.success && (channel === 'both' || enableFallback)) {
                console.log('WhatsApp failed, falling back to SMS');
                usedChannel = 'sms';
                fallbackUsed = true;
                sendResult = await sendViaChannel('sms', recipientPhone, messageContent, schoolId);
            }
        } else {
            // Send via SMS directly
            usedChannel = 'sms';
            sendResult = await sendViaChannel('sms', recipientPhone, messageContent, schoolId);
        }

        if (!sendResult.success) {
            // Update notification status to failed
            await supabase
                .from('sms_notifications')
                .update({
                    status: 'failed',
                    error_message: sendResult.error || 'Unknown error'
                })
                .eq('id', notification.id);

            console.error('Failed to send message:', sendResult.error);
            return false;
        }

        // 6. Update notification status to sent
        await supabase
            .from('sms_notifications')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);

        return true;
    } catch (error) {
        console.error('Error sending SMS notification:', error);
        return false;
    }
}

/**
 * Send SMS notifications to multiple recipients with rate limiting
 */
export async function bulkSendSmsNotifications(
    recipients: Array<SendSmsParams>
): Promise<BulkSendResult> {
    const result: BulkSendResult = {
        sent: 0,
        failed: 0,
        errors: []
    };

    // Rate limiting: 50-150ms delay between messages
    for (const recipient of recipients) {
        const success = await sendSmsNotification(recipient);
        
        if (success) {
            result.sent++;
        } else {
            result.failed++;
            result.errors.push({
                phone: recipient.recipientPhone,
                error: 'Failed to send message'
            });
        }

        // Random delay between 50-150ms to avoid rate limiting
        const delay = Math.floor(Math.random() * 100) + 50;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    return result;
}

/**
 * Check if student was recently notified to prevent spam
 */
export async function wasRecentlyNotified(
    studentId: number,
    notificationType: string,
    withinMinutes: number = 60
): Promise<boolean> {
    const supabase = requireSupabaseClient();
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes);

    const { data, error } = await supabase
        .from('sms_notifications')
        .select('id')
        .eq('student_id', studentId)
        .eq('notification_type', notificationType)
        .gte('created_at', cutoffTime.toISOString())
        .limit(1);

    if (error) {
        console.error('Error checking notification history:', error);
        return false;
    }

    return (data && data.length > 0);
}

/**
 * Get notification history for a student
 */
export async function getNotificationHistory(
    studentId: number,
    limit: number = 50
): Promise<SmsNotification[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
        .from('sms_notifications')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching notification history:', error);
        return [];
    }

    return data || [];
}

/**
 * Create or update an SMS template
 */
export async function saveSmsTemplate(
    template: Partial<SmsTemplate>
): Promise<SmsTemplate | null> {
    const supabase = requireSupabaseClient();
    if (template.id) {
        // Update existing template
        const { data, error } = await supabase
            .from('sms_templates')
            .update({
                message_content: template.message_content,
                variables: template.variables,
                is_active: template.is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', template.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating template:', error);
            return null;
        }

        return data;
    } else {
        // Create new template
        const { data, error } = await supabase
            .from('sms_templates')
            .insert({
                school_id: template.school_id,
                template_name: template.template_name,
                message_content: template.message_content,
                variables: template.variables,
                is_active: template.is_active !== false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating template:', error);
            return null;
        }

        return data;
    }
}

/**
 * Get all active templates for a school
 */
export async function getSmsTemplates(schoolId: number): Promise<SmsTemplate[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('school_id', schoolId)
        .order('template_name');

    if (error) {
        console.error('Error fetching templates:', error);
        return [];
    }

    return data || [];
}

/**
 * Initialize default templates for a school
 */
export async function initializeDefaultTemplates(schoolId: number): Promise<void> {
    const supabase = requireSupabaseClient();
    const defaultTemplates = [
        {
            template_name: 'fee_reminder',
            message_content: 'Dear Parent,\n\n{{student_name}} has an outstanding fee of ₦{{amount}} due on {{due_date}} for {{term}}.\n\nPlease make payment to avoid late fees.\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'amount', 'due_date', 'term']
        },
        {
            template_name: 'payment_receipt',
            message_content: 'Dear Parent,\n\nPayment received for {{student_name}}.\n\nAmount: ₦{{amount}}\nReference: {{reference}}\nDate: {{date}}\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'amount', 'reference', 'date']
        },
        {
            template_name: 'attendance_present',
            message_content: 'Dear Parent,\n\n{{student_name}} has arrived at school.\n\nDate: {{date}}\nTime: {{time}}\nClass: {{class_name}}\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'date', 'time', 'class_name']
        },
        {
            template_name: 'absentee_alert',
            message_content: 'Dear Parent,\n\n{{student_name}} is marked absent from {{class_name}} on {{date}}.\n\nPlease contact the school if this is an error.\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'date', 'class_name']
        },
        {
            template_name: 'late_arrival',
            message_content: 'Dear Parent,\n\n{{student_name}} arrived late to {{class_name}} on {{date}} at {{time}}.\n\nPlease ensure punctuality.\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'date', 'time', 'class_name']
        },
        {
            template_name: 'report_card_ready',
            message_content: 'Dear Parent,\n\nYour child\'s report card is now ready! 📊\n\nStudent: {{student_name}}\nClass: {{class_name}}\nTerm: {{term}}\n\nView & Download Here:\n{{download_link}}\n\nThis link is valid for 30 days. For any questions, please contact the school office.\n\nBest regards,\nUPSS Administration',
            variables: ['student_name', 'term', 'class_name', 'download_link']
        },
        {
            template_name: 'exam_schedule',
            message_content: 'Dear Parent,\n\n{{student_name}} has an upcoming exam.\n\nSubject: {{subject}}\nDate: {{exam_date}}\nTime: {{time}}\n\nPlease ensure your child is prepared.\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'subject', 'exam_date', 'time']
        },
        {
            template_name: 'event_announcement',
            message_content: 'Dear Parent,\n\nSchool Event: {{event_name}}\n\nDate: {{event_date}}\n\n{{message}}\n\nThank you.\n\n- UPSS',
            variables: ['event_name', 'event_date', 'message']
        },
        {
            template_name: 'emergency_alert',
            message_content: 'Dear Parent,\n\nURGENT NOTICE:\n\n{{message}}\n\nDate: {{date}}\nTime: {{time}}\n\nThank you.\n\n- UPSS',
            variables: ['message', 'date', 'time']
        },
        {
            template_name: 'homework_reminder',
            message_content: 'Dear Parent,\n\n{{student_name}} has homework due on {{due_date}} for {{subject}}.\n\nHomework: {{homework_title}}\n\nPlease ensure it is submitted on time.\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'due_date', 'subject', 'homework_title']
        },
        {
            template_name: 'homework_missing',
            message_content: 'Dear Parent,\n\n{{student_name}} has not submitted homework for {{subject}}.\n\nHomework: {{homework_title}}\nDue Date: {{due_date}}\n\nPlease follow up with your child.\n\nThank you.\n\n- UPSS',
            variables: ['student_name', 'subject', 'homework_title', 'due_date']
        },
        {
            template_name: 'general_announcement',
            message_content: 'Dear Parent,\n\n{{message}}\n\nThank you.\n\n- UPSS',
            variables: ['message']
        }
    ];

    for (const template of defaultTemplates) {
        await supabase
            .from('sms_templates')
            .insert({
                school_id: schoolId,
                ...template,
                is_active: true
            })
            .select()
            .single();
    }
}
