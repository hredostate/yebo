/**
 * Kudi SMS Integration Service
 * Handles all interactions with the Kudi SMS API for messaging
 * Supports both SMS and WhatsApp with per-notification channel preferences
 */

import { requireSupabaseClient } from './supabaseClient';
import type {
    KudiSmsResponse,
    KudiSmsRecipient,
    KudiSmsSettings,
    NotificationType
} from '../types';

const KUDI_SMS_BASE_URL = 'https://my.kudisms.net/api';

export interface KudiSmsApiResponse {
    status: 'success' | 'error';
    status_msg: string;
    error_code: string;
    msg: string;
    length?: number;
    page?: number;
    initial_balance?: string;
    units_used?: string;
    current_balance?: string;
}

export interface KudiSmsPersonalisedRequest {
    token: string;
    senderID: string;
    message: string;
    csvHeaders: string[];
    recipients: KudiSmsRecipient[];
}

export interface KudiSmsAutoComposeRequest {
    token: string;
    senderID: string;
    message: string;
    recipients: string; // Comma-separated phone numbers
}

/**
 * Error code mapping for Kudi SMS responses
 */
export const KUDI_ERROR_CODES: Record<string, string> = {
    '000': 'Message Sent Successfully',
    '009': 'You are only allowed to send maximum of 6 pages of SMS at once',
    '401': 'The request could not be completed',
    '100': 'Token provided is invalid',
    '101': 'The account has been deactivated',
    '103': 'The gateway selected doesn\'t exist',
    '104': 'Blocked message keyword(s)',
    '105': 'The sender ID used has been blocked',
    '106': 'The sender ID used does not exist',
    '107': 'Please provide a valid phone number',
    '108': 'Total recipients more than batch size of 100',
    '109': 'Insufficient credit balance',
    '111': 'Only approved promotional Sender ID allowed',
    '114': 'No package attached to this service',
    '185': 'No route attached to this package',
    '187': 'The request could not be processed',
    '188': 'The sender ID is unapproved',
    '300': 'There are missing parameters'
};

/**
 * Format phone number to Nigerian format (234XXXXXXXXXX)
 */
export function formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If starts with 0, remove it
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }
    
    // If doesn't start with 234, add it
    if (!cleaned.startsWith('234')) {
        cleaned = '234' + cleaned;
    }
    
    return cleaned;
}

/**
 * Send personalized SMS to multiple recipients
 */
export async function sendPersonalisedSms(
    params: KudiSmsPersonalisedRequest
): Promise<KudiSmsApiResponse> {
    const response = await fetch(`${KUDI_SMS_BASE_URL}/personalisedsms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        throw new Error(`Failed to send personalized SMS: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
}

/**
 * Send auto-compose SMS to multiple recipients (same message to all)
 */
export async function sendAutoComposeSms(
    params: KudiSmsAutoComposeRequest
): Promise<KudiSmsApiResponse> {
    const response = await fetch(`${KUDI_SMS_BASE_URL}/autocomposesms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        throw new Error(`Failed to send auto-compose SMS: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
}

/**
 * Send SMS to a single recipient (convenience function)
 */
export async function sendSingleSms(
    token: string,
    senderID: string,
    phoneNumber: string,
    message: string,
    recipientName?: string
): Promise<KudiSmsApiResponse> {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    return sendPersonalisedSms({
        token,
        senderID,
        message,
        csvHeaders: ['phone_number', 'name'],
        recipients: [
            {
                phone_number: formattedPhone,
                name: recipientName || ''
            }
        ]
    });
}

/**
 * Send SMS to multiple recipients with the same message
 */
export async function sendBulkSms(
    token: string,
    senderID: string,
    phoneNumbers: string[],
    message: string
): Promise<KudiSmsApiResponse> {
    // Format all phone numbers
    const formattedPhones = phoneNumbers.map(formatPhoneNumber);
    
    // Kudi SMS has a batch limit of 100 recipients
    if (formattedPhones.length > 100) {
        throw new Error('Total recipients more than batch size of 100. Please split into multiple batches.');
    }
    
    // Use auto-compose for bulk messages with same content
    return sendAutoComposeSms({
        token,
        senderID,
        message,
        recipients: formattedPhones.join(',')
    });
}

/**
 * Interpret Kudi SMS response
 */
export function interpretKudiResponse(response: KudiSmsApiResponse): {
    success: boolean;
    message: string;
} {
    const isSuccess = response.error_code === '000';
    const message = KUDI_ERROR_CODES[response.error_code] || response.msg || 'Unknown response';
    
    return {
        success: isSuccess,
        message
    };
}

/**
 * Validate SMS message length
 * Kudi SMS allows maximum 6 pages of SMS
 * 1 page = 160 characters (GSM-7) or 70 characters (Unicode)
 */
export function validateMessageLength(message: string): {
    valid: boolean;
    pages: number;
    error?: string;
} {
    // Check if message contains non-GSM characters (Unicode)
    const hasUnicode = /[^\x00-\x7F]/.test(message);
    const charLimit = hasUnicode ? 70 : 160;
    const pages = Math.ceil(message.length / charLimit);
    
    if (pages > 6) {
        return {
            valid: false,
            pages,
            error: 'Message exceeds maximum of 6 pages (6 × ' + charLimit + ' = ' + (6 * charLimit) + ' characters)'
        };
    }
    
    return {
        valid: true,
        pages
    };
}

// ============================================
// Multi-Channel Messaging Functions
// ============================================

interface SendNotificationParams {
    schoolId: number;
    recipientPhone: string;
    templateName: string;
    variables: Record<string, string>;
    studentId?: number;
    campusId?: number;
}

interface SendResult {
    success: boolean;
    channel: 'sms' | 'whatsapp';
    fallback?: boolean;
    message?: string;
    error?: string;
}

/**
 * Get Kudi SMS settings for a school/campus
 */
export async function getKudiSmsSettings(
    schoolId: number,
    campusId?: number
): Promise<KudiSmsSettings | null> {
    const supabase = requireSupabaseClient();
    let query = supabase
        .from('kudisms_settings')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true);

    if (campusId) {
        query = query.eq('campus_id', campusId);
    } else {
        query = query.is('campus_id', null);
    }

    const { data, error } = await query.single();

    if (error || !data) {
        console.error('Error fetching Kudi SMS settings:', error);
        return null;
    }

    return data;
}

/**
 * Send SMS message via Kudi SMS
 */
export async function sendSms(params: SendNotificationParams): Promise<SendResult> {
    const supabase = requireSupabaseClient();
    const { schoolId, recipientPhone, templateName, variables } = params;

    try {
        // Get template
        const { data: template, error: templateError } = await supabase
            .from('sms_templates')
            .select('*')
            .eq('school_id', schoolId)
            .eq('template_name', templateName)
            .eq('is_active', true)
            .single();

        if (templateError || !template) {
            return {
                success: false,
                channel: 'sms',
                error: 'Template not found'
            };
        }

        // Replace variables in message
        let message = template.message_content;
        Object.entries(variables).forEach(([key, value]) => {
            message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        // Send via Kudi SMS edge function
        const { data: result, error: sendError } = await supabase.functions.invoke(
            'kudisms-send',
            {
                body: {
                    phone_number: recipientPhone,
                    message: message,
                    school_id: schoolId
                }
            }
        );

        if (sendError || !result?.success) {
            return {
                success: false,
                channel: 'sms',
                error: sendError?.message || result?.error || 'Failed to send SMS'
            };
        }

        return {
            success: true,
            channel: 'sms',
            message: 'SMS sent successfully'
        };
    } catch (error: any) {
        return {
            success: false,
            channel: 'sms',
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * Send WhatsApp message via Green-API (preferred) or fallback to Kudi SMS
 * 
 * This function now prioritizes Green-API for WhatsApp messaging ($12/month)
 * and falls back to Kudi SMS if Green-API is not configured.
 */
export async function sendWhatsAppMessage(
    params: SendNotificationParams & { templateCode?: string }
): Promise<SendResult> {
    const supabase = requireSupabaseClient();
    const { schoolId, recipientPhone, templateCode, variables, campusId, templateName } = params;

    try {
        // Check if Green-API is configured
        const { data: greenApiSettings } = await supabase
            .from('greenapi_settings')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .maybeSingle();

        // If Green-API is configured, use it
        if (greenApiSettings) {
            // Get template to build message
            const { data: template } = await supabase
                .from('sms_templates')
                .select('message_content')
                .eq('school_id', schoolId)
                .eq('template_name', templateName)
                .eq('is_active', true)
                .maybeSingle();

            if (!template) {
                return {
                    success: false,
                    channel: 'whatsapp',
                    error: 'Message template not found'
                };
            }

            // Replace variables in message
            let message = template.message_content;
            Object.entries(variables).forEach(([key, value]) => {
                message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
            });

            // Send via Green-API edge function
            const { data: result, error: sendError } = await supabase.functions.invoke(
                'greenapi-send',
                {
                    body: {
                        school_id: schoolId,
                        campus_id: campusId,
                        recipient_phone: recipientPhone,
                        message: message,
                        send_type: 'text'
                    }
                }
            );

            if (sendError || !result?.success) {
                console.error('Green-API send failed:', sendError || result);
                // Don't fallback to Kudi SMS - return error
                return {
                    success: false,
                    channel: 'whatsapp',
                    error: sendError?.message || result?.error || 'Failed to send via Green-API'
                };
            }

            return {
                success: true,
                channel: 'whatsapp',
                message: 'WhatsApp message sent via Green-API'
            };
        }

        // Fallback to Kudi SMS WhatsApp if Green-API not configured
        const settings = await getKudiSmsSettings(schoolId, campusId);
        
        if (!settings || !settings.whatsapp_template_codes) {
            return {
                success: false,
                channel: 'whatsapp',
                error: 'WhatsApp not configured (neither Green-API nor Kudi SMS)'
            };
        }

        const finalTemplateCode = templateCode || settings.whatsapp_template_codes[templateName];
        
        if (!finalTemplateCode) {
            return {
                success: false,
                channel: 'whatsapp',
                error: 'WhatsApp template code not found'
            };
        }

        // For WhatsApp, we need to use the Kudi SMS WhatsApp API
        // Variables should be passed as an array of values
        const variableValues = Object.values(variables);

        const { data: result, error: sendError } = await supabase.functions.invoke(
            'kudisms-whatsapp-send',
            {
                body: {
                    phone_number: recipientPhone,
                    template_code: finalTemplateCode,
                    parameters: variableValues,
                    school_id: schoolId
                }
            }
        );

        if (sendError || !result?.success) {
            return {
                success: false,
                channel: 'whatsapp',
                error: sendError?.message || result?.error || 'Failed to send WhatsApp via Kudi SMS'
            };
        }

        return {
            success: true,
            channel: 'whatsapp',
            message: 'WhatsApp message sent via Kudi SMS (fallback)'
        };
    } catch (error: any) {
        return {
            success: false,
            channel: 'whatsapp',
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * Send notification using the preferred channel for the notification type
 */
export async function sendNotificationWithChannel(
    type: NotificationType,
    params: SendNotificationParams
): Promise<SendResult> {
    const { schoolId, campusId } = params;

    try {
        // 1. Get settings for school
        const settings = await getKudiSmsSettings(schoolId, campusId);
        
        if (!settings) {
            return {
                success: false,
                channel: 'sms',
                error: 'Kudi SMS not configured'
            };
        }

        // 2. Get channel preference for this notification type
        const channel = settings.notification_channels?.[type] || 'sms';

        // 3. Try preferred channel
        if (channel === 'whatsapp' || channel === 'both') {
            const result = await sendWhatsAppMessage(params);
            
            if (result.success) {
                return result;
            }

            // Fallback to SMS if enabled and WhatsApp failed
            if (channel === 'both' || settings.enable_fallback) {
                const smsResult = await sendSms(params);
                return {
                    ...smsResult,
                    fallback: true
                };
            }

            return result;
        }

        // 4. SMS only
        return await sendSms(params);
    } catch (error: any) {
        return {
            success: false,
            channel: 'sms',
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * Get SMS balance from Kudi SMS
 */
export async function getKudiSmsBalance(schoolId: number): Promise<{ 
    success: boolean; 
    balance?: string; 
    currency?: string;
    error?: string;
}> {
    const supabase = requireSupabaseClient();
    try {
        const { data, error } = await supabase.functions.invoke('kudisms-balance', {
            body: { school_id: schoolId }
        });

        if (error || !data?.success) {
            return {
                success: false,
                error: error?.message || data?.error || 'Failed to get balance'
            };
        }

        return {
            success: true,
            balance: data.balance,
            currency: data.currency || '₦'
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * Test sending a message (for the test panel)
 */
export async function testSendMessage(params: {
    schoolId: number;
    recipientPhone: string;
    messageType: 'sms' | 'whatsapp';
    templateName: string;
    variables: Record<string, string>;
    campusId?: number;
}): Promise<SendResult> {
    const { messageType, ...restParams } = params;

    if (messageType === 'whatsapp') {
        return await sendWhatsAppMessage(restParams);
    } else {
        return await sendSms(restParams);
    }
}

