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
  template_code?: string;
  parameters?: string; // Comma-separated string
  button_parameters?: string;
  header_parameters?: string;
  school_id?: number;
  campus_id?: number;
}

/**
 * Kudi SMS WhatsApp Sender Function
 * 
 * Sends WhatsApp messages via Kudi SMS API and logs them to the database.
 * IMPORTANT: Uses application/x-www-form-urlencoded format, NOT JSON
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
    // Parse request body
    const body: WhatsAppRequest = await req.json();
    const {
      phone_number,
      template_code,
      parameters = '',
      button_parameters = '',
      header_parameters = '',
      school_id,
      campus_id,
    } = body;

    // Validate required fields
    if (!phone_number) {
      throw new Error('phone_number is required');
    }

    if (!template_code) {
      throw new Error('template_code is required');
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authorization header to determine school_id if not provided
    let effectiveSchoolId = school_id;
    let effectiveCampusId = campus_id;

    if (!effectiveSchoolId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        
        if (!userError && userData?.user) {
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('school_id, campus_id')
            .eq('id', userData.user.id)
            .single();
          
          if (profile) {
            effectiveSchoolId = profile.school_id;
            effectiveCampusId = effectiveCampusId || profile.campus_id;
          }
        }
      }
    }

    // Get Kudi SMS settings for this school/campus
    let kudiSettings: any = null;

    // Try campus-specific settings first, then fall back to school-wide
    if (effectiveCampusId) {
      const { data: campusSettings } = await supabaseAdmin
        .from('kudisms_settings')
        .select('*')
        .eq('school_id', effectiveSchoolId)
        .eq('campus_id', effectiveCampusId)
        .eq('is_active', true)
        .single();
      
      if (campusSettings) {
        kudiSettings = campusSettings;
      }
    }
    
    // Fallback to school-wide settings if campus-specific not found
    if (!kudiSettings) {
      const { data: schoolSettings, error: settingsError } = await supabaseAdmin
        .from('kudisms_settings')
        .select('*')
        .eq('school_id', effectiveSchoolId)
        .is('campus_id', null)
        .eq('is_active', true)
        .single();
      
      if (settingsError || !schoolSettings) {
        throw new Error('Kudi SMS not configured for this school');
      }
      
      kudiSettings = schoolSettings;
    }

    // Format phone number to Nigerian international format (234XXXXXXXXXX)
    let formattedPhone = phone_number.replace(/\D/g, '');
    formattedPhone = formattedPhone.replace(/^0+/, '');
    if (!formattedPhone.startsWith('234')) {
      formattedPhone = '234' + formattedPhone;
    }

    // Prepare form data for Kudi SMS WhatsApp API
    const formData = new URLSearchParams();
    formData.append('token', kudiSettings.token);
    formData.append('recipient', formattedPhone);
    formData.append('template_code', template_code);
    formData.append('parameters', parameters);
    formData.append('button_parameters', button_parameters);
    formData.append('header_parameters', header_parameters);

    // Send WhatsApp message via Kudi SMS
    console.log('Sending WhatsApp message via Kudi SMS:', { phone: formattedPhone, template: template_code });
    
    const kudiResponse = await fetch('https://my.kudisms.net/api/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const kudiResult = await kudiResponse.json();
    console.log('Kudi SMS response:', kudiResult);

    const isSuccess = kudiResponse.ok && kudiResult.status === 'success' && kudiResult.error_code === '000';
    const status = isSuccess ? 'sent' : 'failed';
    const errorMessage = !isSuccess ? (kudiResult.msg || 'Failed to send message') : null;

    // Log to database
    const logEntry = {
      school_id: effectiveSchoolId,
      recipient_phone: formattedPhone,
      template_code: template_code,
      message_type: 'whatsapp',
      message_content: { parameters, button_parameters, header_parameters },
      parameters: parameters,
      kudi_message_id: kudiResult.data,
      status: status,
      error_code: kudiResult.error_code,
      error_message: errorMessage,
      cost: kudiResult.cost,
      balance: kudiResult.balance,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: logError } = await supabaseAdmin
      .from('kudisms_message_logs')
      .insert(logEntry);

    if (logError) {
      console.error('Failed to log Kudi SMS message:', logError);
    }

    if (!isSuccess) {
      return new Response(JSON.stringify({ 
        error: 'Failed to send WhatsApp message',
        message: errorMessage,
        error_code: kudiResult.error_code,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'WhatsApp message sent successfully',
      message_id: kudiResult.data,
      cost: kudiResult.cost,
      balance: kudiResult.balance,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('WhatsApp send error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
