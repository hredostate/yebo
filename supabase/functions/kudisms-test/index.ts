// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KUDI_SMS_BASE_URL = 'https://my.kudisms.net/api';

/**
 * Kudi SMS Test Edge Function
 * 
 * Handles test requests for WhatsApp and SMS messages
 * Also provides balance checking functionality
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
    const { action, type, recipient, template_code, parameters, message, senderID, token } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: 'API token is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Handle balance check
    if (action === 'check_balance') {
      const formData = new URLSearchParams();
      formData.append('token', token);

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
    }

    // Handle test message sending
    if (action === 'send_test') {
      if (type === 'whatsapp') {
        // Send WhatsApp message
        if (!recipient || !template_code) {
          return new Response(JSON.stringify({ error: 'Recipient and template code are required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const formData = new URLSearchParams();
        formData.append('token', token);
        formData.append('recipient', recipient);
        formData.append('template_code', template_code);
        formData.append('parameters', parameters || '');
        formData.append('button_parameters', '');
        formData.append('header_parameters', '');

        const response = await fetch(`${KUDI_SMS_BASE_URL}/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        const result = await response.json();
        
        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else if (type === 'sms') {
        // Send SMS message
        if (!recipient || !message || !senderID) {
          return new Response(JSON.stringify({ error: 'Recipient, message, and sender ID are required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const smsBody = {
          token: token,
          senderID: senderID,
          message: message,
          csvHeaders: ['phone_number'],
          recipients: [{ phone_number: recipient }]
        };

        const response = await fetch(`${KUDI_SMS_BASE_URL}/personalisedsms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(smsBody),
        });

        const result = await response.json();
        
        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        return new Response(JSON.stringify({ error: 'Invalid message type' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (error: any) {
    console.error('Error in kudisms-test function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
