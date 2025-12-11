/**
 * WhatsApp Service for Parent Notifications
 * Supports Termii integration for sending WhatsApp messages
 */

import { supabase } from './supabaseClient';
import type { WhatsAppTemplate, WhatsAppNotification } from '../types';

interface SendWhatsAppParams {
    schoolId: number;
    studentId: number;
    recipientPhone: string;
    templateName: string;
    variables?: Record<string, string>;
    referenceId?: number;
    notificationType: 'homework_reminder' | 'homework_missing' | 'notes_incomplete' | 'lesson_published';
    sentBy: string;
}

interface BulkSendResult {
    sent: number;
    failed: number;
    errors: { phone: string; error: string }[];
}

/**
 * Send a WhatsApp message using Termii integration
 */
export async function sendWhatsAppNotification(params: SendWhatsAppParams): Promise<boolean> {
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
            .from('whatsapp_templates')
            .select('*')
            .eq('school_id', schoolId)
            .eq('template_name', templateName)
            .eq('is_active', true)
            .single();

        if (templateError || !template) {
            console.error('Template not found:', templateName);
            return false;
        }

        // 2. Replace variables in message content
        let messageContent = template.message_content;
        if (template.variables && template.variables.length > 0) {
            template.variables.forEach((variable: string) => {
                const value = variables[variable] || '';
                messageContent = messageContent.replace(`{{${variable}}}`, value);
            });
        }

        // 3. Create notification record
        const { data: notification, error: notificationError } = await supabase
            .from('whatsapp_notifications')
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

        // 4. Send via Termii edge function
        const { data: sendResult, error: sendError } = await supabase.functions.invoke(
            'termii-send-whatsapp',
            {
                body: {
                    phone_number: recipientPhone,
                    message: messageContent,
                    school_id: schoolId
                }
            }
        );

        if (sendError || !sendResult?.success) {
            // Update notification status to failed
            await supabase
                .from('whatsapp_notifications')
                .update({
                    status: 'failed',
                    error_message: sendError?.message || sendResult?.error || 'Unknown error'
                })
                .eq('id', notification.id);

            console.error('Failed to send WhatsApp message:', sendError || sendResult?.error);
            return false;
        }

        // 5. Update notification status to sent
        await supabase
            .from('whatsapp_notifications')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                termii_message_id: sendResult.message_id
            })
            .eq('id', notification.id);

        return true;
    } catch (error) {
        console.error('Error sending WhatsApp notification:', error);
        return false;
    }
}

/**
 * Send WhatsApp notifications to multiple recipients with rate limiting
 */
export async function bulkSendWhatsAppNotifications(
    recipients: Array<SendWhatsAppParams>
): Promise<BulkSendResult> {
    const result: BulkSendResult = {
        sent: 0,
        failed: 0,
        errors: []
    };

    // Rate limiting: 50-150ms delay between messages
    for (const recipient of recipients) {
        const success = await sendWhatsAppNotification(recipient);
        
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
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes);

    const { data, error } = await supabase
        .from('whatsapp_notifications')
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
): Promise<WhatsAppNotification[]> {
    const { data, error } = await supabase
        .from('whatsapp_notifications')
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
 * Create or update a WhatsApp template
 */
export async function saveWhatsAppTemplate(
    template: Partial<WhatsAppTemplate>
): Promise<WhatsAppTemplate | null> {
    if (template.id) {
        // Update existing template
        const { data, error } = await supabase
            .from('whatsapp_templates')
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
            .from('whatsapp_templates')
            .insert({
                school_id: template.school_id,
                template_name: template.template_name,
                template_type: template.template_type || 'conversational',
                template_id: template.template_id,
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
export async function getWhatsAppTemplates(schoolId: number): Promise<WhatsAppTemplate[]> {
    const { data, error } = await supabase
        .from('whatsapp_templates')
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
    const defaultTemplates = [
        {
            template_name: 'homework_reminder',
            message_content: 'Dear Parent,\n\nThis is a reminder that {{student_name}} has homework due on {{due_date}} for {{subject}}.\n\nHomework: {{homework_title}}\n\nPlease ensure it is submitted on time.\n\nThank you.',
            variables: ['student_name', 'due_date', 'subject', 'homework_title']
        },
        {
            template_name: 'homework_missing',
            message_content: 'Dear Parent,\n\n{{student_name}} has not submitted homework for {{subject}}. The homework "{{homework_title}}" was due on {{due_date}}.\n\nPlease follow up with your child.\n\nThank you.',
            variables: ['student_name', 'subject', 'homework_title', 'due_date']
        },
        {
            template_name: 'notes_incomplete',
            message_content: 'Dear Parent,\n\nDuring today\'s notes check for {{subject}}, {{student_name}}\'s notes were found to be {{status}}.\n\nTopic: {{topic}}\n\nPlease ensure your child keeps up with class notes.\n\nThank you.',
            variables: ['student_name', 'subject', 'status', 'topic']
        },
        {
            template_name: 'lesson_published',
            message_content: 'Dear Parent,\n\nA new lesson plan has been published for {{student_name}}\'s {{subject}} class.\n\nWeek: {{week_date}}\nTopic: {{lesson_title}}\n\nLearning materials are now available in the student portal.\n\nThank you.',
            variables: ['student_name', 'subject', 'week_date', 'lesson_title']
        }
    ];

    for (const template of defaultTemplates) {
        await supabase
            .from('whatsapp_templates')
            .insert({
                school_id: schoolId,
                ...template,
                template_type: 'conversational',
                is_active: true
            })
            .select()
            .single();
    }
}
