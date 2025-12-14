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
 * Retrieves the SMS balance from Kudi SMS API
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
        const { school_id } = await req.json();
        
        if (!school_id) {
            return new Response(
                JSON.stringify({ error: 'school_id is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        
        // Get Kudi SMS settings
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        const { data: settings, error: settingsError } = await supabase
            .from('kudisms_settings')
            .select('token')
            .eq('school_id', school_id)
            .eq('is_active', true)
            .single();
        
        if (settingsError || !settings?.token) {
            return new Response(
                JSON.stringify({ 
                    success: false,
                    error: 'Kudi SMS not configured for this school' 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        
        // Get balance from Kudi SMS API
        const kudiSmsBaseUrl = Deno.env.get('KUDI_SMS_BASE_URL') || 'https://my.kudisms.net/api';
        
        const response = await fetch(`${kudiSmsBaseUrl}/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: settings.token }).toString()
        });
        
        if (!response.ok) {
            return new Response(
                JSON.stringify({ 
                    success: false,
                    error: 'Failed to connect to Kudi SMS API' 
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        
        const result = await response.json();
        
        // Kudi SMS balance API returns different response formats
        // Check for common fields
        const balance = result.balance || result.current_balance || result.data?.balance || '0';
        
        return new Response(
            JSON.stringify({
                success: true,
                balance: balance,
                currency: '₦',
                raw_response: result
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Balance check error:', error);
        return new Response(
            JSON.stringify({ 
                success: false,
                error: error.message || 'Internal server error' 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
