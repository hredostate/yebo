
// Supabase Edge Function for checking balance via Kudi SMS.
// Balance is retrieved from the last message log entry, as Kudi SMS returns balance with each message sent.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
      },
    });
  }

  try {
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

    if (!schoolId) {
      throw new Error('Could not determine school ID');
    }

    // Get the most recent message log with a balance
    const { data: lastMessage, error: messageError } = await supabaseAdmin
      .from('kudisms_message_logs')
      .select('balance, created_at')
      .eq('school_id', schoolId)
      .not('balance', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (messageError || !lastMessage || !lastMessage.balance) {
      return new Response(JSON.stringify({
        ok: false,
        balanceRaw: null,
        balanceFormatted: null,
        currency: null,
        providerCode: 'NO_DATA',
        providerMessage: 'No recent message with balance information found',
        friendlyMessage: 'Send a message to see your balance. Balance is updated with each message sent.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Parse balance - Kudi SMS returns balance as string with commas (e.g., "161,864.98")
    const balanceStr = lastMessage.balance.replace(/,/g, '');
    const balanceRaw = parseFloat(balanceStr);
    const currency = 'NGN'; // Kudi SMS uses Nigerian Naira
    const balanceFormatted = `${currency} ${balanceRaw.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const normalizedResponse = {
      ok: true,
      balanceRaw: balanceRaw,
      balanceFormatted: balanceFormatted,
      currency: currency,
      providerCode: 'SUCCESS',
      providerMessage: 'Balance retrieved from Kudi SMS',
      friendlyMessage: 'Balance retrieved successfully.',
    };

    return new Response(JSON.stringify(normalizedResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error('Error in sms-balance function:', error.message);
    return new Response(JSON.stringify({
      ok: false,
      balanceRaw: null,
      balanceFormatted: null,
      currency: null,
      providerCode: 'INTERNAL_ERROR',
      providerMessage: error.message,
      friendlyMessage: 'An internal error occurred while fetching the balance.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
