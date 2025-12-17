// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmsRequest {
  phone_number: string;
  message?: string;
  school_id?: number;
  recipient_name?: string;
  gateway?: '1' | '2'; // '1' for SMS, '2' for WhatsApp
  template_code?: string; // WhatsApp template code
  params?: string; // Comma-separated parameters for WhatsApp template
  template_name?: string; // SMS template name from database
  variables?: Record<string, string>; // Variables to replace in template
}

/**
 * Format phone number to Nigerian format (234XXXXXXXXXX)
 */
function formatPhoneNumber(phoneNumber: string): string {
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
 * Kudi SMS Send Function
 * 
 * Sends SMS messages via Kudi SMS API and logs them to the database.
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // Get environment variables
    const kudiSmsToken = Deno.env.get('KUDI_SMS_TOKEN');
    const kudiSenderId = Deno.env.get('KUDI_SENDER_ID');
    const kudiSmsBaseUrl = Deno.env.get('KUDI_SMS_BASE_URL') || 'https://my.kudisms.net/api';

    if (!kudiSmsToken || !kudiSenderId) {
      console.error('KUDI_SMS_TOKEN or KUDI_SENDER_ID not configured');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Parse request body
    const body: SmsRequest = await req.json();
    const {
      phone_number,
      message,
      school_id,
      recipient_name = '',
      gateway = '1', // Default to SMS
      template_code,
      params,
      template_name,
      variables,
    } = body;

    // Validate required fields
    if (!phone_number) {
      throw new Error('phone_number is required');
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // If template_name is provided, fetch template and replace variables
    let finalMessage = message;
    if (template_name && school_id) {
      const { data: template, error: templateError } = await supabaseAdmin
        .from('sms_templates')
        .select('message_content')
        .eq('school_id', school_id)
        .eq('template_name', template_name)
        .eq('is_active', true)
        .single();

      if (template && !templateError) {
        finalMessage = template.message_content;
        
        // Replace variables in the template
        // Escape special regex characters in keys to prevent ReDoS attacks
        if (variables) {
          Object.entries(variables).forEach(([key, value]) => {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            finalMessage = finalMessage?.replace(new RegExp(`{{${escapedKey}}}`, 'g'), value);
          });
        }
      } else {
        console.error('Template not found or error:', templateError);
        throw new Error(`Template '${template_name}' not found`);
      }
    }

    // For SMS (gateway=1), message is required
    // For WhatsApp (gateway=2), template_code is required
    if (gateway === '1' && !finalMessage) {
      throw new Error('message or template_name is required for SMS');
    }

    if (gateway === '2' && !template_code) {
      throw new Error('template_code is required for WhatsApp');
    }

    // Get authorization header to determine school_id if not provided
    let finalSchoolId = school_id;
    if (!finalSchoolId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        
        if (!userError && userData?.user) {
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('school_id')
            .eq('id', userData.user.id)
            .single();
          
          if (profile) {
            finalSchoolId = profile.school_id;
          }
        }
      }
    }

    // Get school-specific Kudi SMS settings if available
    let effectiveToken = kudiSmsToken;
    let effectiveSenderId = kudiSenderId;

    if (finalSchoolId) {
      const { data: settings } = await supabaseAdmin
        .from('kudisms_settings')
        .select('token, sender_id, is_active')
        .eq('school_id', finalSchoolId)
        .eq('is_active', true)
        .single();

      if (settings) {
        effectiveToken = settings.token;
        effectiveSenderId = settings.sender_id;
      }
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone_number);

    let kudiResponse: Response;
    let kudiResult: any;
    let channel: string;

    if (gateway === '2') {
      // Send WhatsApp via Kudi SMS API (application/x-www-form-urlencoded)
      channel = 'whatsapp';
      console.log('Sending WhatsApp via Kudi SMS:', { sender: effectiveSenderId, template: template_code });
      
      const whatsappParams = new URLSearchParams({
        token: effectiveToken,
        senderID: effectiveSenderId,
        recipients: formattedPhone,
        gateway: '2',
        template_code: template_code || '',
      });

      if (params) {
        whatsappParams.append('params', params);
      }

      kudiResponse = await fetch(`${kudiSmsBaseUrl}/corporate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: whatsappParams.toString(),
      });

      kudiResult = await kudiResponse.json();
      console.log('Kudi SMS WhatsApp response:', kudiResult);
    } else {
      // Send SMS via Kudi SMS API (personalized SMS endpoint)
      channel = 'sms';
      console.log('Sending SMS via Kudi SMS:', { sender: effectiveSenderId });
      
      const kudiPayload = {
        token: effectiveToken,
        senderID: effectiveSenderId,
        message: finalMessage,
        csvHeaders: ['phone_number', 'name'],
        recipients: [
          {
            phone_number: formattedPhone,
            name: recipient_name
          }
        ]
      };
      
      kudiResponse = await fetch(`${kudiSmsBaseUrl}/personalisedsms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(kudiPayload),
      });

      kudiResult = await kudiResponse.json();
      console.log('Kudi SMS response:', kudiResult);
    }

    const isSuccess = kudiResponse.ok && kudiResult && kudiResult.error_code === '000';
    const status = isSuccess ? 'sent' : 'failed';
    const errorMessage = !isSuccess ? (kudiResult?.msg || kudiResult?.status_msg || 'Failed to send message') : null;

    // Log to database
    const logEntry = {
      school_id: finalSchoolId,
      recipient_phone: formattedPhone,
      message_type: gateway === '2' ? 'whatsapp' : 'personalised',
      message_content: finalMessage || `WhatsApp Template: ${template_code}`,
      kudi_response: kudiResult,
      status: status,
      error_message: errorMessage,
      channel: channel,
      fallback_used: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: logError } = await supabaseAdmin
      .from('sms_message_logs')
      .insert(logEntry);

    if (logError) {
      console.error('Failed to log SMS message:', logError);
    }

    if (!isSuccess) {
      return new Response(JSON.stringify({ 
        error: 'Failed to send SMS message',
        message: errorMessage,
        error_code: kudiResult.error_code
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'SMS message sent successfully',
      response: kudiResult,
      channel: channel,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('SMS send error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
