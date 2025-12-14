/**
 * Kudi SMS Service
 * Handles WhatsApp and SMS messaging via Kudi SMS API
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

export interface KudiSmsResponse {
  status: 'success' | 'error';
  error_code: string;
  cost?: number;
  data?: string;
  msg: string;
  balance?: string;
}

export interface KudiPersonalisedSmsParams {
  token: string;
  senderID: string;
  message: string;
  csvHeaders: string[];
  recipients: Array<Record<string, string>>;
}

export interface KudiAutoComposeSmsParams {
  token: string;
  gateway: number;
  data: string[][];
}

/**
 * Send WhatsApp message via Kudi SMS
 * IMPORTANT: Uses application/x-www-form-urlencoded, NOT JSON
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  return await response.json();
}

/**
 * Send personalised SMS messages
 */
export async function sendPersonalisedSms(params: KudiPersonalisedSmsParams): Promise<KudiSmsResponse> {
  const response = await fetch(`${KUDI_SMS_BASE_URL}/personalisedsms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return await response.json();
}

/**
 * Send SMS using auto compose API
 */
export async function sendAutoComposeSms(params: KudiAutoComposeSmsParams): Promise<KudiSmsResponse> {
  const response = await fetch(`${KUDI_SMS_BASE_URL}/autocomposesms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return await response.json();
}

/**
 * Format phone number to Nigerian international format (234XXXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // If it doesn't start with 234, add it
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  
  return cleaned;
}

/**
 * Get error message from Kudi SMS error code
 */
export function getKudiSmsErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    '000': 'Message Sent Successfully',
    '009': 'Maximum 6 pages of SMS allowed',
    '401': 'Request could not be completed',
    '100': 'Token provided is invalid',
    '101': 'Account has been deactivated',
    '103': 'Gateway selected doesn\'t exist',
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
  };

  return errorMessages[errorCode] || `Unknown error (code: ${errorCode})`;
}
