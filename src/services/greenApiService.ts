/**
 * Green-API Service for WhatsApp Messaging
 * 
 * This service integrates with Green-API for WhatsApp messaging at $12/month
 * instead of per-message pricing from KudiSMS. SMS continues to use KudiSMS.
 * 
 * Green-API Methods:
 * 1. sendMessage - Text notifications
 * 2. sendFileByUrl - Send file from hosted URL
 * 3. sendFileByUpload - Upload and send file directly
 * 4. uploadFile - Pre-upload for bulk sending (valid 15 days)
 * 5. forwardMessages - Forward messages to multiple chats
 * 6. sendInteractiveButtons - Send messages with action buttons (Beta)
 */

import { requireSupabaseClient } from './supabaseClient';
import type {
    GreenApiSettings,
    GreenApiSendMessageParams,
    GreenApiSendFileParams,
    GreenApiSendButtonsParams,
    GreenApiForwardParams,
    GreenApiResponse,
    GreenApiUploadResponse,
    GreenApiForwardResponse
} from '../types';

/**
 * Format Nigerian phone number to WhatsApp chatId format
 * 234XXXXXXXXXX → 234XXXXXXXXXX@c.us
 */
export function formatWhatsAppChatId(phoneNumber: string): string {
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
    
    // Append @c.us for WhatsApp chat ID
    return `${cleaned}@c.us`;
}

/**
 * Get Green-API settings for a school/campus
 */
export async function getGreenApiSettings(
    schoolId: number,
    campusId?: number | null
): Promise<GreenApiSettings | null> {
    const supabase = requireSupabaseClient();
    let query = supabase
        .from('greenapi_settings')
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
        console.error('Error fetching Green-API settings:', error);
        return null;
    }

    return data;
}

/**
 * Build Green-API endpoint URL
 */
function buildEndpoint(
    settings: GreenApiSettings,
    method: string,
    useMediaUrl: boolean = false
): string {
    const baseUrl = useMediaUrl ? settings.media_url : settings.api_url;
    return `${baseUrl}/waInstance${settings.instance_id}/${method}/${settings.api_token}`;
}

/**
 * Make API request to Green-API with retry logic
 */
async function makeGreenApiRequest<T>(
    url: string,
    options: RequestInit,
    retries: number = 2
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Green-API request failed: ${response.status} ${errorText}`);
            }
            
            const data = await response.json();
            return data as T;
        } catch (error: any) {
            lastError = error;
            console.error(`Green-API request attempt ${attempt + 1} failed:`, error);
            
            // Don't retry on the last attempt
            if (attempt < retries) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error('Green-API request failed after retries');
}

/**
 * 1. Send text message via Green-API
 */
export async function sendMessage(
    schoolId: number,
    params: GreenApiSendMessageParams,
    campusId?: number | null
): Promise<GreenApiResponse> {
    const settings = await getGreenApiSettings(schoolId, campusId);
    
    if (!settings) {
        throw new Error('Green-API not configured for this school/campus');
    }
    
    const endpoint = buildEndpoint(settings, 'sendMessage');
    
    const response = await makeGreenApiRequest<GreenApiResponse>(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        }
    );
    
    return response;
}

/**
 * 2. Send file from URL via Green-API
 */
export async function sendFileByUrl(
    schoolId: number,
    params: GreenApiSendFileParams,
    campusId?: number | null
): Promise<GreenApiResponse> {
    const settings = await getGreenApiSettings(schoolId, campusId);
    
    if (!settings) {
        throw new Error('Green-API not configured for this school/campus');
    }
    
    const endpoint = buildEndpoint(settings, 'sendFileByUrl');
    
    const response = await makeGreenApiRequest<GreenApiResponse>(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        }
    );
    
    return response;
}

/**
 * 3. Upload and send file via Green-API
 * Note: This uses the media URL endpoint
 */
export async function sendFileByUpload(
    schoolId: number,
    chatId: string,
    file: File | Blob,
    fileName?: string,
    caption?: string,
    campusId?: number | null
): Promise<GreenApiResponse> {
    const settings = await getGreenApiSettings(schoolId, campusId);
    
    if (!settings) {
        throw new Error('Green-API not configured for this school/campus');
    }
    
    const endpoint = buildEndpoint(settings, 'sendFileByUpload', true); // Use media URL
    
    const formData = new FormData();
    formData.append('chatId', chatId);
    formData.append('file', file, fileName);
    
    if (fileName) {
        formData.append('fileName', fileName);
    }
    
    if (caption) {
        formData.append('caption', caption);
    }
    
    const response = await makeGreenApiRequest<GreenApiResponse>(
        endpoint,
        {
            method: 'POST',
            body: formData,
        }
    );
    
    return response;
}

/**
 * 4. Upload file for later use (bulk sending)
 * Returns URL valid for 15 days
 */
export async function uploadFile(
    schoolId: number,
    file: File | Blob,
    fileName?: string,
    mimeType?: string,
    campusId?: number | null
): Promise<GreenApiUploadResponse> {
    const settings = await getGreenApiSettings(schoolId, campusId);
    
    if (!settings) {
        throw new Error('Green-API not configured for this school/campus');
    }
    
    const endpoint = buildEndpoint(settings, 'uploadFile', true); // Use media URL
    
    const headers: Record<string, string> = {};
    
    if (mimeType) {
        headers['Content-Type'] = mimeType;
    }
    
    if (fileName) {
        headers['GA-Filename'] = fileName;
    }
    
    const response = await makeGreenApiRequest<GreenApiUploadResponse>(
        endpoint,
        {
            method: 'POST',
            headers,
            body: file,
        }
    );
    
    return response;
}

/**
 * 5. Forward messages to another chat
 */
export async function forwardMessages(
    schoolId: number,
    params: GreenApiForwardParams,
    campusId?: number | null
): Promise<GreenApiForwardResponse> {
    const settings = await getGreenApiSettings(schoolId, campusId);
    
    if (!settings) {
        throw new Error('Green-API not configured for this school/campus');
    }
    
    const endpoint = buildEndpoint(settings, 'forwardMessages');
    
    const response = await makeGreenApiRequest<GreenApiForwardResponse>(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        }
    );
    
    return response;
}

/**
 * 6. Send interactive buttons message (Beta)
 * Limitations:
 * - Max 3 buttons
 * - Max 25 characters per button text
 * - Button types: copy, call, url, reply
 */
export async function sendInteractiveButtons(
    schoolId: number,
    params: GreenApiSendButtonsParams,
    campusId?: number | null
): Promise<GreenApiResponse> {
    const settings = await getGreenApiSettings(schoolId, campusId);
    
    if (!settings) {
        throw new Error('Green-API not configured for this school/campus');
    }
    
    // Validate button constraints
    if (params.buttons.length > 3) {
        throw new Error('Maximum 3 buttons allowed');
    }
    
    for (const button of params.buttons) {
        if (button.buttonText.length > 25) {
            throw new Error(`Button text "${button.buttonText}" exceeds 25 character limit`);
        }
    }
    
    const endpoint = buildEndpoint(settings, 'sendInteractiveButtons');
    
    const response = await makeGreenApiRequest<GreenApiResponse>(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        }
    );
    
    return response;
}

/**
 * Send WhatsApp message via Green-API (wrapper for sendMessage)
 * This is the main function used by notification services
 */
export async function sendWhatsAppMessage(params: {
    schoolId: number;
    recipientPhone: string;
    message: string;
    campusId?: number | null;
    quotedMessageId?: string;
    linkPreview?: boolean;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const chatId = formatWhatsAppChatId(params.recipientPhone);
        
        const response = await sendMessage(
            params.schoolId,
            {
                chatId,
                message: params.message,
                quotedMessageId: params.quotedMessageId,
                linkPreview: params.linkPreview,
            },
            params.campusId
        );
        
        return {
            success: true,
            messageId: response.idMessage,
        };
    } catch (error: any) {
        console.error('Failed to send WhatsApp message via Green-API:', error);
        return {
            success: false,
            error: error.message || 'Failed to send WhatsApp message',
        };
    }
}

/**
 * Test Green-API connection
 */
export async function testGreenApiConnection(
    schoolId: number,
    testPhoneNumber: string,
    campusId?: number | null
): Promise<{ success: boolean; error?: string }> {
    try {
        const chatId = formatWhatsAppChatId(testPhoneNumber);
        
        await sendMessage(
            schoolId,
            {
                chatId,
                message: '🟢 Green-API connection test successful! Your WhatsApp integration is working.',
            },
            campusId
        );
        
        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Connection test failed',
        };
    }
}
