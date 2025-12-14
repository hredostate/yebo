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
  message: string;
  school_id?: number;
  recipient_name?: string;
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
    } = body;

    // Validate required fields
    if (!phone_number) {
      throw new Error('phone_number is required');
    }

    if (!message) {
      throw new Error('message is required');
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Prepare Kudi SMS API request (using personalized SMS endpoint)
    const kudiPayload = {
      token: effectiveToken,
      senderID: effectiveSenderId,
      message: message,
      csvHeaders: ['phone_number', 'name'],
      recipients: [
        {
          phone_number: formattedPhone,
          name: recipient_name
        }
      ]
    };

    // Send SMS via Kudi SMS API
    console.log('Sending SMS via Kudi SMS:', { phone: formattedPhone, sender: effectiveSenderId });
    
    const kudiResponse = await fetch(`${kudiSmsBaseUrl}/personalisedsms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kudiPayload),
    });

    const kudiResult = await kudiResponse.json();
    console.log('Kudi SMS response:', kudiResult);

    const isSuccess = kudiResponse.ok && kudiResult.error_code === '000';
    const status = isSuccess ? 'sent' : 'failed';
    const errorMessage = !isSuccess ? (kudiResult.msg || kudiResult.status_msg || 'Failed to send message') : null;

    // Log to database
    const logEntry = {
      school_id: finalSchoolId,
      recipient_phone: formattedPhone,
      message_type: 'personalised',
      message_content: message,
      kudi_response: kudiResult,
      status: status,
      error_message: errorMessage,
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
