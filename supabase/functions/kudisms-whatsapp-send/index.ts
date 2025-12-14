// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  phone_number: string;
  template_code: string;
  parameters: string[]; // Array of parameters for template
  school_id?: number;
  button_parameters?: string; // Optional button parameters
  header_parameters?: string; // Optional header parameters
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
 * Kudi SMS WhatsApp Send Function
 * 
 * Sends WhatsApp messages via Kudi SMS API and logs them to the database.
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
    const kudiSmsBaseUrl = Deno.env.get('KUDI_SMS_BASE_URL') || 'https://my.kudisms.net/api';

    // Parse request body
    const body: WhatsAppRequest = await req.json();
    const {
      phone_number,
      template_code,
      parameters = [],
      school_id,
      button_parameters = '',
      header_parameters = '',
    } = body;

    // Validate required fields
    if (!phone_number) {
      throw new Error('phone_number is required');
    }

    if (!template_code) {
      throw new Error('template_code is required');
    }

    if (!school_id) {
      throw new Error('school_id is required');
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Kudi SMS settings for this school
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('kudisms_settings')
      .select('token, sender_id, is_active')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      console.error('Kudi SMS settings not found for school:', school_id);
      return new Response(JSON.stringify({ 
        error: 'Kudi SMS not configured for this school',
        message: 'Please configure Kudi SMS settings in the admin panel'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { token: kudiSmsToken, sender_id: kudiSenderId } = settings;

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone_number);

    // Convert parameters array to comma-separated string
    const parametersString = parameters.join(',');

    console.log('Sending WhatsApp via Kudi SMS:', { 
      sender: kudiSenderId, 
      template: template_code,
      recipient: formattedPhone,
      params: parametersString
    });

    // Send WhatsApp via Kudi SMS API (application/x-www-form-urlencoded)
    const whatsappParams = new URLSearchParams({
      token: kudiSmsToken,
      recipient: formattedPhone,
      template_code: template_code,
      parameters: parametersString,
    });

    // Add optional parameters if provided
    if (button_parameters) {
      whatsappParams.append('button_parameters', button_parameters);
    }

    if (header_parameters) {
      whatsappParams.append('header_parameters', header_parameters);
    }

    const kudiResponse = await fetch(`${kudiSmsBaseUrl}/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: whatsappParams.toString(),
    });

    const kudiResult = await kudiResponse.json();
    console.log('Kudi SMS WhatsApp response:', kudiResult);

    // Parse response
    const isSuccess = kudiResponse.ok && kudiResult && (
      kudiResult.error_code === '000' || 
      kudiResult.status === 'success' ||
      kudiResult.status_msg?.toLowerCase().includes('success')
    );
    const status = isSuccess ? 'sent' : 'failed';
    const errorMessage = !isSuccess ? (kudiResult?.msg || kudiResult?.status_msg || kudiResult?.message || 'Failed to send WhatsApp message') : null;

    // Extract balance and cost information if available
    const balance = kudiResult?.current_balance || kudiResult?.balance || null;
    const cost = kudiResult?.units_used || kudiResult?.cost || null;

    // Log to database
    const logEntry = {
      school_id: school_id,
      recipient_phone: formattedPhone,
      message_type: 'whatsapp_template',
      message_content: `WhatsApp Template: ${template_code} (Parameters: ${parametersString})`,
      kudi_response: kudiResult,
      status: status,
      error_message: errorMessage,
      channel: 'whatsapp',
      fallback_used: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: logError } = await supabaseAdmin
      .from('sms_message_logs')
      .insert(logEntry);

    if (logError) {
      console.error('Failed to log WhatsApp message:', logError);
    }

    if (!isSuccess) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to send WhatsApp message',
        message: errorMessage,
        error_code: kudiResult.error_code,
        response: kudiResult,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'WhatsApp message sent successfully',
      balance: balance,
      cost: cost,
      response: kudiResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('WhatsApp send error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
