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
    const kudiSmsBaseUrl = Deno.env.get('KUDI_SMS_BASE_URL') || 'https://my.kudisms.net/api';

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body to get school_id and campus_id if provided
    let schoolId: number | null = null;
    let campusId: number | null = null;
    try {
      const body = await req.json();
      if (body?.school_id) {
        schoolId = body.school_id;
      }
      if (body?.campus_id) {
        campusId = body.campus_id;
      }
    } catch (e) {
      // If no body or invalid JSON, continue without school_id/campus_id from body
    }

    // Fallback: Get authorization header to determine school_id if not provided in body
    if (!schoolId) {
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
    }

    // Determine effective token source
    let effectiveToken: string | null = null;
    let tokenSource = 'none';

    // 1. If school_id provided, try database first
    if (schoolId) {
      let query = supabaseAdmin
        .from('kudisms_settings')
        .select('token, is_active')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      // Filter by campus_id if provided
      if (campusId) {
        query = query.eq('campus_id', campusId);
      } else {
        query = query.is('campus_id', null);
      }

      const { data: settings, error: settingsError } = await query.single();

      if (settings?.token) {
        effectiveToken = settings.token;
        tokenSource = 'database';
        console.log(`Using database token for school_id: ${schoolId}${campusId ? `, campus_id: ${campusId}` : ''}`);
      } else {
        console.log(`No active settings found for school_id: ${schoolId}${campusId ? `, campus_id: ${campusId}` : ''}, error: ${settingsError?.message || 'No data'}`);
      }
    }

    // 2. Fallback to environment variable if no database token
    if (!effectiveToken) {
      const envToken = Deno.env.get('KUDI_SMS_TOKEN');
      if (envToken) {
        effectiveToken = envToken;
        tokenSource = 'environment';
        console.log('Using environment variable token');
      }
    }

    // 3. If still no token, return clear error
    if (!effectiveToken) {
      console.error('No Kudi SMS token available from any source');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No Kudi SMS token configured',
        message: schoolId 
          ? `No active Kudi SMS settings found for school_id: ${schoolId}${campusId ? `, campus_id: ${campusId}` : ''}` 
          : 'No school_id provided and KUDI_SMS_TOKEN env var not set',
        balanceRaw: 0,
        balanceFormatted: '₦0.00',
        debug: { 
          schoolId, 
          campusId,
          tokenSource,
          hasEnvToken: !!Deno.env.get('KUDI_SMS_TOKEN')
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Prepare Kudi SMS API request
    const balanceUrl = `${kudiSmsBaseUrl}/balance?token=${encodeURIComponent(effectiveToken)}`;

    // Get balance from Kudi SMS API
    console.log(`Fetching balance from Kudi SMS using ${tokenSource} token`);
    
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
      console.error(`Kudi SMS API error: ${errorMessage}, error_code: ${kudiResult?.error_code}`);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to fetch balance',
        message: errorMessage,
        error_code: kudiResult?.error_code,
        balanceRaw: 0,
        balanceFormatted: '₦0.00',
        debug: {
          schoolId,
          campusId,
          tokenSource,
          apiErrorCode: kudiResult?.error_code,
          apiResponse: kudiResult
        }
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
      debug: {
        schoolId,
        campusId,
        tokenSource
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Balance check error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      message: error.message,
      balanceRaw: 0,
      balanceFormatted: '₦0.00',
      debug: {
        errorType: error.name,
        errorStack: error.stack?.split('\n').slice(0, 3).join('\n')
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 with error in body for consistent error handling
    });
  }
});
