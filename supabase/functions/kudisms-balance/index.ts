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
 * Kudi SMS Balance Check Edge Function
 * 
 * Checks the account balance for a school's Kudi SMS account
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
    const { school_id } = body;

    if (!school_id) {
      return new Response(JSON.stringify({ error: 'School ID is required' }), {
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
      return new Response(JSON.stringify({ 
        error: 'Kudi SMS not configured',
        message: 'No active Kudi SMS configuration found for this school'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Check balance
    const formData = new URLSearchParams();
    formData.append('token', settings.api_token);

    const response = await fetch(`${KUDI_SMS_BASE_URL}/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in kudisms-balance function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
