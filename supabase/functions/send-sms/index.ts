
// Supabase Edge Function for sending messages via Termii WhatsApp API.
// Migrated from BulkSMSNigeria to Termii for better delivery and cost efficiency.
// This function maintains backward compatibility with the original send-sms interface.
// It internally delegates to the termii-send-whatsapp function.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

// CORS headers for preflight and actual requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, body, reference } = await req.json();

    // Input validation
    if (!to || !Array.isArray(to) || to.length === 0) {
      throw new Error('"to" field must be a non-empty array of phone numbers.');
    }
    if (!body) {
      throw new Error('"body" field is required.');
    }

    // Create Supabase client for logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Server configuration error: Supabase credentials are not set.');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Send WhatsApp messages by calling termii-send-whatsapp for each recipient
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Get authorization header to pass through
    const authHeader = req.headers.get('Authorization') || '';

    for (const phoneNumber of to) {
      try {
        // Call the termii-send-whatsapp function internally
        const response = await fetch(`${supabaseUrl}/functions/v1/termii-send-whatsapp`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
          },
          body: JSON.stringify({
            phone_number: phoneNumber,
            message_type: 'conversational',
            message: body,
          }),
        });

        const responseData = await response.json();
        const isSuccess = response.ok && responseData.success;
        
        if (isSuccess) {
          successCount++;
        } else {
          failureCount++;
        }

        results.push({
          phone_number: phoneNumber,
          success: isSuccess,
          message_id: responseData.message_id || null,
          error: !isSuccess ? (responseData.message || responseData.error || 'Unknown error') : null,
        });

        // Also log to communications_audit for backward compatibility
        const auditLog = {
          recipients: [phoneNumber],
          message_body: body,
          reference_id: reference || null,
          provider_message_id: responseData.message_id || null,
          provider_code: 'TERMII',
          cost: null, // Termii balance updates happen in real-time
          currency: 'NGN',
          ok: isSuccess,
          friendly_message: isSuccess ? 'WhatsApp message sent via Termii' : (responseData.message || responseData.error || 'Failed to send'),
        };

        const { error: auditError } = await supabaseClient
          .from('communications_audit')
          .insert(auditLog);
          
        if (auditError) {
          console.error('Failed to log to communications_audit table:', auditError);
        }

      } catch (individualError) {
        failureCount++;
        console.error(`Error sending to ${phoneNumber}:`, individualError);
        results.push({
          phone_number: phoneNumber,
          success: false,
          message_id: null,
          error: individualError.message,
        });
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Return a success response to the client
    return new Response(JSON.stringify({ 
      ok: successCount > 0,
      message: `WhatsApp messages sent: ${successCount} succeeded, ${failureCount} failed.`,
      results: results,
      success_count: successCount,
      failure_count: failureCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    // Catch any errors and return a standardized error response
    console.error('Error in send-sms function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
