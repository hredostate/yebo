
// Supabase Edge Function for checking balance via Termii API.
// Migrated from BulkSMSNigeria to Termii for unified messaging platform.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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
    const termiiApiKey = Deno.env.get('TERMII_API_KEY');
    const termiiBaseUrl = Deno.env.get('TERMII_BASE_URL') || 'https://api.ng.termii.com';

    if (!termiiApiKey) {
      throw new Error('TERMII_API_KEY is not set in Supabase function secrets.');
    }

    const response = await fetch(`${termiiBaseUrl}/api/get-balance?api_key=${termiiApiKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
        // Handle non-2xx responses from the provider
        const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response from provider.' }));
        return new Response(JSON.stringify({
            ok: false,
            balanceRaw: null,
            balanceFormatted: null,
            currency: null,
            providerCode: errorBody.code || `HTTP-${response.status}`,
            providerMessage: errorBody.message || 'Provider returned an error.',
            friendlyMessage: 'Could not connect to Termii to fetch balance.',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    const providerResponse = await response.json();
    const isSuccess = providerResponse.balance !== undefined;

    // Format the balance for display
    const balanceRaw = providerResponse.balance || 0;
    const currency = providerResponse.currency || 'NGN';
    const balanceFormatted = `${currency} ${balanceRaw.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const normalizedResponse = {
      ok: isSuccess,
      balanceRaw: balanceRaw,
      balanceFormatted: balanceFormatted,
      currency: currency,
      providerCode: 'SUCCESS',
      providerMessage: 'Balance retrieved from Termii',
      friendlyMessage: isSuccess ? 'Balance retrieved successfully.' : 'There was a problem retrieving the balance from the provider.',
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
