
// Supabase Edge Function for sending messages via Termii WhatsApp API.
// Migrated from BulkSMSNigeria to Termii for better delivery and cost efficiency.
// This function maintains backward compatibility with the original send-sms interface.
// This function is invoked via `supabase.functions.invoke('send-sms', ...)` from the client.

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

    // Retrieve Termii secrets from environment variables
    const termiiApiKey = Deno.env.get('TERMII_API_KEY');
    const termiiBaseUrl = Deno.env.get('TERMII_BASE_URL') || 'https://api.ng.termii.com';
    const senderId = Deno.env.get('TERMII_SENDER_ID') || 'SchoolGuardian';

    if (!termiiApiKey) {
      throw new Error('Server configuration error: TERMII_API_KEY secret is not set.');
    }
    
    // Create Supabase client to get school_id and log messages
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Server configuration error: Supabase credentials are not set.');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header to determine school_id
    const authHeader = req.headers.get('Authorization');
    let schoolId: number | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (!userError && userData?.user) {
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('school_id')
          .eq('id', userData.user.id)
          .single();
        
        if (profile) {
          schoolId = profile.school_id;
        }
      }
    }

    // Send WhatsApp messages via Termii to each recipient
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const phoneNumber of to) {
      try {
        // Prepare payload for Termii WhatsApp API (conversational message)
        const termiiPayload = {
          api_key: termiiApiKey,
          to: phoneNumber,
          from: senderId,
          sms: body,
          type: 'plain',
          channel: 'whatsapp',
        };
        
        // Send the WhatsApp message via Termii
        const response = await fetch(`${termiiBaseUrl}/api/sms/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(termiiPayload),
        });

        const responseData = await response.json();
        const isSuccess = response.ok && responseData.message_id;
        
        if (isSuccess) {
          successCount++;
        } else {
          failureCount++;
        }

        results.push({
          phone_number: phoneNumber,
          success: isSuccess,
          message_id: responseData.message_id || null,
          error: !isSuccess ? (responseData.message || 'Unknown error') : null,
        });

        // Log to whatsapp_message_logs table
        const logEntry = {
          school_id: schoolId,
          recipient_phone: phoneNumber,
          template_id: null,
          message_type: 'conversational',
          message_content: { message: body },
          media_url: null,
          termii_message_id: responseData.message_id || null,
          status: isSuccess ? 'sent' : 'failed',
          error_message: !isSuccess ? (responseData.message || 'Unknown error') : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: logError } = await supabaseClient
          .from('whatsapp_message_logs')
          .insert(logEntry);
          
        if (logError) {
          console.error('Failed to log WhatsApp message:', logError);
        }

        // Also log to communications_audit for backward compatibility
        const auditLog = {
          recipients: [phoneNumber],
          message_body: body,
          reference_id: reference || null,
          provider_message_id: responseData.message_id || null,
          provider_code: responseData.code || `HTTP-${response.status}`,
          cost: null, // Termii doesn't return cost in response
          currency: 'NGN',
          ok: isSuccess,
          friendly_message: isSuccess ? 'WhatsApp message sent via Termii' : (responseData.message || 'Failed to send'),
        };

        const { error: auditError } = await supabaseClient
          .from('communications_audit')
          .insert(auditLog);
          
        if (auditError) {
          console.error('Failed to log to communications_audit table:', auditError);
        }

      } catch (individualError) {
        failureCount++;
        results.push({
          phone_number: phoneNumber,
          success: false,
          message_id: null,
          error: individualError.message,
        });
      }
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
