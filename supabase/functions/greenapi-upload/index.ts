// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GreenApiUploadRequest {
  school_id: number;
  campus_id?: number | null;
  recipient_phone?: string; // Optional - if provided, sends file immediately
  file_data: string; // Base64 encoded file data
  file_name: string;
  mime_type?: string;
  caption?: string;
  upload_only?: boolean; // If true, only uploads and returns URL (for bulk sending)
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
 * Green-API Upload Function
 * 
 * Handles file uploads to Green-API for WhatsApp messaging.
 * Supports two modes:
 * 1. Upload only - Returns URL valid for 15 days (for bulk sending)
 * 2. Upload and send - Uploads and immediately sends to recipient
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
    const body: GreenApiUploadRequest = await req.json();
    const {
      school_id,
      campus_id,
      recipient_phone,
      file_data,
      file_name,
      mime_type,
      caption,
      upload_only,
    } = body;

    // Validate required fields
    if (!school_id) {
      throw new Error('school_id is required');
    }

    if (!file_data || !file_name) {
      throw new Error('file_data and file_name are required');
    }

    if (!upload_only && !recipient_phone) {
      throw new Error('recipient_phone is required when not upload_only');
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

    // Decode base64 file data
    const fileBlob = Uint8Array.from(atob(file_data), c => c.charCodeAt(0));

    if (upload_only) {
      // Mode 1: Upload only (returns URL valid for 15 days)
      const uploadEndpoint = `${settings.media_url}/waInstance${settings.instance_id}/uploadFile/${settings.api_token}`;
      
      const uploadHeaders: Record<string, string> = {};
      if (mime_type) {
        uploadHeaders['Content-Type'] = mime_type;
      }
      if (file_name) {
        uploadHeaders['GA-Filename'] = file_name;
      }

      console.log('Uploading file to Green-API:', { uploadEndpoint, file_name, mime_type });

      const uploadResponse = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: uploadHeaders,
        body: fileBlob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Green-API upload error:', errorText);
        
        return new Response(JSON.stringify({ 
          error: 'Failed to upload to Green-API',
          status: uploadResponse.status,
          details: errorText 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: uploadResponse.status,
        });
      }

      const uploadResult = await uploadResponse.json();
      console.log('Green-API upload response:', uploadResult);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'File uploaded successfully to Green-API',
        url_file: uploadResult.urlFile,
        valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      // Mode 2: Upload and send immediately
      const chatId = formatWhatsAppChatId(recipient_phone!);
      console.log('Formatted chatId:', chatId);

      const sendEndpoint = `${settings.media_url}/waInstance${settings.instance_id}/sendFileByUpload/${settings.api_token}`;

      // Create FormData
      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('file', new Blob([fileBlob], { type: mime_type || 'application/octet-stream' }), file_name);
      
      if (file_name) {
        formData.append('fileName', file_name);
      }
      
      if (caption) {
        formData.append('caption', caption);
      }

      console.log('Sending file to Green-API:', { sendEndpoint, chatId, file_name });

      const sendResponse = await fetch(sendEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text();
        console.error('Green-API send error:', errorText);
        
        return new Response(JSON.stringify({ 
          error: 'Failed to send file via Green-API',
          status: sendResponse.status,
          details: errorText 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: sendResponse.status,
        });
      }

      const sendResult = await sendResponse.json();
      console.log('Green-API send response:', sendResult);

      // Log to database
      const logEntry = {
        school_id,
        recipient_phone: chatId,
        message_type: 'greenapi',
        message_content: `File upload: ${file_name}`,
        kudi_response: sendResult,
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
        message: 'File sent successfully via Green-API',
        response: sendResult,
        channel: 'whatsapp',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error) {
    console.error('Green-API upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
