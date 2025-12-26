// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GreenApiSendRequest {
  school_id: number;
  campus_id?: number | null;
  recipient_phone: string;
  message?: string;
  url_file?: string;
  file_name?: string;
  caption?: string;
  quoted_message_id?: string;
  link_preview?: boolean;
  send_type: 'text' | 'file_url';
}

/**
 * Format Nigerian phone number to WhatsApp chatId format
 * 234XXXXXXXXXX → 234XXXXXXXXXX@c.us
 */
function formatWhatsAppChatId(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // If doesn't start with 234, add it
  if (!cleaned.startsWith('234')) {
    cleaned = '234' + cleaned;
  }
  
  // Append @c.us for WhatsApp chat ID
  return `${cleaned}@c.us`;
}

/**
 * Green-API Send Function
 * 
 * Sends text messages and files via Green-API WhatsApp integration.
 * Supports:
 * - sendMessage (text)
 * - sendFileByUrl (hosted files)
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
    const body: GreenApiSendRequest = await req.json();
    const {
      school_id,
      campus_id,
      recipient_phone,
      message,
      url_file,
      file_name,
      caption,
      quoted_message_id,
      link_preview,
      send_type,
    } = body;

    // Validate required fields
    if (!school_id) {
      throw new Error('school_id is required');
    }

    if (!recipient_phone) {
      throw new Error('recipient_phone is required');
    }

    if (send_type === 'text' && !message) {
      throw new Error('message is required for text messages');
    }

    if (send_type === 'file_url' && (!url_file || !file_name)) {
      throw new Error('url_file and file_name are required for file messages');
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Green-API settings
    let query = supabaseAdmin
      .from('greenapi_settings')
      .select('*')
      .eq('school_id', school_id)
      .eq('is_active', true);

    if (campus_id) {
      query = query.eq('campus_id', campus_id);
    } else {
      query = query.is('campus_id', null);
    }

    const { data: settings, error: settingsError } = await query.single();

    if (settingsError || !settings) {
      console.error('Green-API settings not found:', settingsError);
      return new Response(JSON.stringify({ 
        error: 'Green-API not configured for this school/campus',
        details: settingsError?.message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Format phone number to WhatsApp chatId
    const chatId = formatWhatsAppChatId(recipient_phone);
    console.log('Formatted chatId:', chatId);

    // Build Green-API endpoint
    const method = send_type === 'text' ? 'sendMessage' : 'sendFileByUrl';
    const endpoint = `${settings.api_url}/waInstance${settings.instance_id}/${method}/${settings.api_token}`;

    // Prepare request body based on send type
    let greenApiPayload: any;
    if (send_type === 'text') {
      greenApiPayload = {
        chatId,
        message,
      };
      
      if (quoted_message_id) {
        greenApiPayload.quotedMessageId = quoted_message_id;
      }
      
      if (link_preview !== undefined) {
        greenApiPayload.linkPreview = link_preview;
      }
    } else {
      greenApiPayload = {
        chatId,
        urlFile: url_file,
        fileName: file_name,
      };
      
      if (caption) {
        greenApiPayload.caption = caption;
      }
      
      if (quoted_message_id) {
        greenApiPayload.quotedMessageId = quoted_message_id;
      }
    }

    console.log('Sending to Green-API:', { endpoint, payload: greenApiPayload });

    // Send request to Green-API
    const greenApiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(greenApiPayload),
    });

    if (!greenApiResponse.ok) {
      const errorText = await greenApiResponse.text();
      console.error('Green-API error:', errorText);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to send via Green-API',
        status: greenApiResponse.status,
        details: errorText 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: greenApiResponse.status,
      });
    }

    const greenApiResult = await greenApiResponse.json();
    console.log('Green-API response:', greenApiResult);

    // Log to database
    const logEntry = {
      school_id,
      recipient_phone: chatId,
      message_type: 'greenapi',
      message_content: send_type === 'text' ? message : `File: ${file_name}`,
      kudi_response: greenApiResult,
      status: 'sent',
      channel: 'whatsapp',
      fallback_used: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: logError } = await supabaseAdmin
      .from('sms_message_logs')
      .insert(logEntry);

    if (logError) {
      console.error('Failed to log Green-API message:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Message sent successfully via Green-API',
      response: greenApiResult,
      channel: 'whatsapp',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Green-API send error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
