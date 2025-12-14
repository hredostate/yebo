/**
 * Kudi SMS Integration Service
 * Handles all interactions with the Kudi SMS API for WhatsApp and SMS messaging
 */

const KUDI_SMS_BASE_URL = 'https://my.kudisms.net/api';

export interface KudiWhatsAppParams {
  token: string;
  recipient: string;
  template_code: string;
  parameters?: string;
  button_parameters?: string;
  header_parameters?: string;
}

export interface KudiSmsParams {
  token: string;
  senderID: string;
  message: string;
  csvHeaders: string[];
  recipients: Array<{
    phone_number: string;
    [key: string]: string;
  }>;
}

export interface KudiSmsResponse {
  status: 'success' | 'error';
  error_code: string;
  cost?: number;
  data?: string;
  msg: string;
  balance?: string;
}

export interface KudiBalanceResponse {
  status: 'success' | 'error';
  balance?: string;
  msg?: string;
}

/**
 * Send WhatsApp message using template
 */
export async function sendWhatsAppMessage(params: KudiWhatsAppParams): Promise<KudiSmsResponse> {
  const formData = new URLSearchParams();
  formData.append('token', params.token);
  formData.append('recipient', params.recipient);
  formData.append('template_code', params.template_code);
  formData.append('parameters', params.parameters || '');
  formData.append('button_parameters', params.button_parameters || '');
  formData.append('header_parameters', params.header_parameters || '');

  const response = await fetch(`${KUDI_SMS_BASE_URL}/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const result = await response.json();
  
  // Handle error responses
  if (!response.ok || result.status === 'error') {
    return {
      status: 'error',
      error_code: result.error_code || '401',
      msg: result.msg || 'Request could not be completed',
      balance: result.balance
    };
  }

  return result;
}

/**
 * Send personalised SMS messages
 */
export async function sendPersonalisedSms(params: KudiSmsParams): Promise<KudiSmsResponse> {
  const response = await fetch(`${KUDI_SMS_BASE_URL}/personalisedsms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const result = await response.json();
  
  // Handle error responses
  if (!response.ok || result.status === 'error') {
    return {
      status: 'error',
      error_code: result.error_code || '401',
      msg: result.msg || 'Request could not be completed',
      balance: result.balance
    };
  }

  return result;
}

/**
 * Check Kudi SMS account balance
 */
export async function checkBalance(token: string): Promise<KudiBalanceResponse> {
  const formData = new URLSearchParams();
  formData.append('token', token);

  const response = await fetch(`${KUDI_SMS_BASE_URL}/balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const result = await response.json();
  
  if (!response.ok || result.status === 'error') {
    return {
      status: 'error',
      msg: result.msg || 'Could not fetch balance'
    };
  }

  return result;
}

/**
 * Get human-readable error message from error code
 */
export function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    '000': 'Message Sent Successfully',
    '009': 'Maximum 6 pages of SMS allowed',
    '100': 'Token provided is invalid',
    '101': 'Account has been deactivated',
    '103': 'Gateway does not exist',
    '104': 'Blocked message keyword(s)',
    '105': 'Sender ID has been blocked',
    '106': 'Sender ID does not exist',
    '107': 'Invalid phone number',
    '108': 'Recipients exceed batch size of 100',
    '109': 'Insufficient credit balance',
    '111': 'Only approved promotional Sender ID allowed',
    '114': 'No package attached to this service',
    '185': 'No route attached to this package',
    '187': 'Request could not be processed',
    '188': 'Sender ID is unapproved',
    '300': 'Missing parameters',
    '401': 'Request could not be completed',
  };
  return errorMessages[errorCode] || 'Unknown error';
}

/**
 * Format phone number to Nigerian international format (234XXXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 234
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  }
  
  // If doesn't start with 234, prepend it
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  
  return cleaned;
}
