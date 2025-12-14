/**
 * Kudi SMS Integration Service
 * Handles all interactions with the Kudi SMS API for messaging
 */

import type {
    KudiSmsResponse,
    KudiSmsRecipient
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
