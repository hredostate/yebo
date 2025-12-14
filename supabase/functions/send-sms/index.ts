
// Supabase Edge Function for sending messages via Kudi SMS WhatsApp API.
// Migrated from Termii to Kudi SMS for better delivery and cost efficiency.
// This function maintains backward compatibility with the original send-sms interface.
// It internally delegates to the kudisms-send-whatsapp function.

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

    // Get default template code from environment
    const defaultTemplateCode = Deno.env.get('KUDI_DEFAULT_TEMPLATE_CODE') || '';

    if (!defaultTemplateCode) {
      console.warn('KUDI_DEFAULT_TEMPLATE_CODE not set. Emergency broadcasts and free-form messages may not work.');
      console.warn('Please configure a default WhatsApp template in Supabase Edge Function secrets.');
    }

    for (const phoneNumber of to) {
      try {
        // For Kudi SMS, we need a template code and parameters
        // The body is passed as a single parameter to the template
        // Template should have a single {{message}} placeholder
        const response = await fetch(`${supabaseUrl}/functions/v1/kudisms-send-whatsapp`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
          },
          body: JSON.stringify({
            phone_number: phoneNumber,
            template_code: defaultTemplateCode,
            parameters: body, // Pass message body as single parameter
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
          provider_code: 'KUDISMS',
          cost: responseData.cost || null,
          currency: 'NGN',
          ok: isSuccess,
          friendly_message: isSuccess ? 'WhatsApp message sent via Kudi SMS' : (responseData.message || responseData.error || 'Failed to send'),
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
