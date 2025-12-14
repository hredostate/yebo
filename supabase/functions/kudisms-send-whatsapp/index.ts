// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KUDI_SMS_BASE_URL = 'https://my.kudisms.net/api';

/**
 * Kudi SMS WhatsApp Sending Edge Function
 * 
 * Sends WhatsApp messages using Kudi SMS API
 * Logs messages to whatsapp_message_logs table
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
    const body = await req.json();
    const { school_id, recipient, template_code, parameters, button_parameters, header_parameters } = body;

    if (!school_id || !recipient || !template_code) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Kudi SMS settings for this school
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('kudisms_settings')
      .select('api_token, is_active')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      console.error('Kudi SMS settings not found for school:', school_id);
      return new Response(JSON.stringify({ 
        error: 'Kudi SMS not configured',
        message: 'No active Kudi SMS configuration found for this school'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Send WhatsApp message via Kudi SMS
    const formData = new URLSearchParams();
    formData.append('token', settings.api_token);
    formData.append('recipient', recipient);
    formData.append('template_code', template_code);
    formData.append('parameters', parameters || '');
    formData.append('button_parameters', button_parameters || '');
    formData.append('header_parameters', header_parameters || '');

    const response = await fetch(`${KUDI_SMS_BASE_URL}/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();

    // Log the message
    const logData = {
      school_id: school_id,
      recipient_phone: recipient,
      template_code: template_code,
      message_type: 'whatsapp',
      message_content: { parameters, button_parameters, header_parameters },
      kudisms_message_id: result.data || null,
      status: (result.status === 'success' || result.error_code === '000') ? 'sent' : 'failed',
      error_message: result.status === 'error' ? result.msg : null,
      cost: result.cost || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from('whatsapp_message_logs').insert(logData);

    return new Response(JSON.stringify({ 
      success: result.status === 'success' || result.error_code === '000',
      result,
      message_id: result.data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in kudisms-send-whatsapp function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
