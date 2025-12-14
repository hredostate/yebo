// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Kudi SMS Balance Check Function
 * 
 * Retrieves SMS credit balance from Kudi SMS API
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const kudiSmsToken = Deno.env.get('KUDI_SMS_TOKEN');
    const kudiSmsBaseUrl = Deno.env.get('KUDI_SMS_BASE_URL') || 'https://my.kudisms.net/api';

    if (!kudiSmsToken) {
      console.error('KUDI_SMS_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authorization header to determine school_id
    let schoolId: number | null = null;
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
          schoolId = profile.school_id;
        }
      }
    }

    // Get school-specific Kudi SMS settings if available
    let effectiveToken = kudiSmsToken;

    if (schoolId) {
      const { data: settings } = await supabaseAdmin
        .from('kudisms_settings')
        .select('token, is_active')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .single();

      if (settings) {
        effectiveToken = settings.token;
      }
    }

    // Prepare Kudi SMS API request
    const balanceUrl = `${kudiSmsBaseUrl}/balance?token=${encodeURIComponent(effectiveToken)}`;

    // Get balance from Kudi SMS API
    console.log('Fetching balance from Kudi SMS');
    
    const kudiResponse = await fetch(balanceUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const kudiResult = await kudiResponse.json();
    console.log('Kudi SMS balance response:', kudiResult);

    // Parse response based on Kudi SMS API format
    // Kudi SMS returns: { error_code: "000", balance: 123.45, ... } or error
    const isSuccess = kudiResponse.ok && kudiResult && kudiResult.error_code === '000';
    const balance = isSuccess ? (kudiResult.balance || 0) : 0;

    if (!isSuccess) {
      const errorMessage = kudiResult?.msg || kudiResult?.status_msg || 'Failed to fetch balance';
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch balance',
        message: errorMessage,
        error_code: kudiResult?.error_code,
        balanceRaw: 0,
        balanceFormatted: '₦0.00',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with error in body for consistent error handling
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      balanceRaw: balance,
      balanceFormatted: `₦${balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      currency: 'NGN',
      response: kudiResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Balance check error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message,
      balanceRaw: 0,
      balanceFormatted: '₦0.00',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 with error in body for consistent error handling
    });
  }
});
