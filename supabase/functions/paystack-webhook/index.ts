// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

interface WebhookEvent {
  event: string;
  data: {
    amount: number;
    authorization?: any;
    customer?: {
      email: string;
      customer_code: string;
      id: number;
    };
    dedicated_account?: {
      account_number: string;
      account_name: string;
      bank: {
        name: string;
        id: number;
        slug: string;
      };
    };
    reference: string;
    status: string;
    paid_at: string;
  };
}

/**
 * Paystack Webhook Handler
 * 
 * Handles webhook events from Paystack, particularly for dedicated virtual account credits.
 * When a payment is made to a student's DVA, this function automatically:
 * - Verifies the webhook signature
 * - Finds the student by account number
 * - Finds their unpaid invoice
 * - Records the payment
 * - Updates the invoice status
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
    // Get environment variables
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      // Return 200 to prevent Paystack from retrying
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Get request body
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    // Verify webhook signature
    if (!signature) {
      console.error('Missing x-paystack-signature header');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Compute hash
    const hash = createHmac('sha512', paystackSecretKey)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Parse webhook payload
    const event: WebhookEvent = JSON.parse(body);
    console.log('Webhook event received:', event.event);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the webhook event for audit trail
    try {
      const { error: insertError } = await supabaseAdmin.from('webhook_events').insert({
        event_type: event.event,
        payload: event,
        signature: signature,
        processed: false,
        created_at: new Date().toISOString(),
      });
      
      if (insertError) {
        // Table might not exist or other error occurred
        console.log('Could not log to webhook_events table:', insertError.message);
      }
    } catch (error: any) {
      // Catch any unexpected errors (network issues, etc.)
      console.log('Error logging webhook event:', error?.message || 'Unknown error');
    }

    // Handle dedicatedaccount.credit event
    if (event.event === 'dedicatedaccount.credit') {
      const { data } = event;
      
      // Validate required fields
      if (!data.dedicated_account?.account_number) {
        console.error('Missing account_number in webhook data');
        return new Response(JSON.stringify({ error: 'Invalid webhook data' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 to acknowledge receipt
        });
      }

      const accountNumber = data.dedicated_account.account_number;
      const amount = data.amount / 100; // Convert from kobo to naira
      const reference = data.reference;
      const paidAt = data.paid_at;

      console.log(`Processing payment: ${amount} NGN to account ${accountNumber}, reference: ${reference}`);

      // Check for duplicate payment (idempotency)
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('reference', reference)
        .single();

      if (existingPayment) {
        console.log(`Payment with reference ${reference} already exists, skipping`);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Payment already processed' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Find the DVA record by account number
      const { data: dvaRecord, error: dvaError } = await supabaseAdmin
        .from('dedicated_virtual_accounts')
        .select('student_id, school_id')
        .eq('account_number', accountNumber)
        .single();

      if (dvaError || !dvaRecord) {
        console.error('DVA not found for account number:', accountNumber, dvaError);
        return new Response(JSON.stringify({ 
          error: 'Account not found',
          message: 'DVA record not found for this account number'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 to acknowledge receipt
        });
      }

      console.log(`Found DVA for student ${dvaRecord.student_id} in school ${dvaRecord.school_id}`);

      // Get current term from school config
      const { data: schoolConfig, error: configError } = await supabaseAdmin
        .from('school_config')
        .select('current_term_id')
        .eq('school_id', dvaRecord.school_id)
        .single();

      if (configError || !schoolConfig?.current_term_id) {
        console.error('Could not get current term for school:', dvaRecord.school_id, configError);
        // Still record the payment, but without invoice association
        await supabaseAdmin.from('payments').insert({
          school_id: dvaRecord.school_id,
          invoice_id: null,
          amount: amount,
          payment_date: paidAt,
          payment_method: 'Bank Transfer (DVA)',
          reference: reference,
          verified: true,
          created_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Payment recorded without invoice (no current term configured)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const currentTermId = schoolConfig.current_term_id;

      // Find unpaid or partially paid invoice for this student in current term
      const { data: invoices, error: invoiceError } = await supabaseAdmin
        .from('student_invoices')
        .select('id, total_amount, amount_paid, status')
        .eq('student_id', dvaRecord.student_id)
        .eq('term_id', currentTermId)
        .in('status', ['Unpaid', 'Partial'])
        .order('created_at', { ascending: true });

      if (invoiceError) {
        console.error('Error fetching invoices:', invoiceError);
        // Record payment without invoice association
        await supabaseAdmin.from('payments').insert({
          school_id: dvaRecord.school_id,
          invoice_id: null,
          amount: amount,
          payment_date: paidAt,
          payment_method: 'Bank Transfer (DVA)',
          reference: reference,
          verified: true,
          created_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Payment recorded without invoice (error fetching invoices)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Take the first unpaid/partial invoice
      const invoice = invoices && invoices.length > 0 ? invoices[0] : null;

      if (!invoice) {
        console.log('No open invoice found for student, recording payment without invoice');
        await supabaseAdmin.from('payments').insert({
          school_id: dvaRecord.school_id,
          invoice_id: null,
          amount: amount,
          payment_date: paidAt,
          payment_method: 'Bank Transfer (DVA)',
          reference: reference,
          verified: true,
          created_at: new Date().toISOString(),
        });

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Payment recorded without invoice (no open invoice found)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Create payment record
      const { error: paymentError } = await supabaseAdmin.from('payments').insert({
        school_id: dvaRecord.school_id,
        invoice_id: invoice.id,
        amount: amount,
        payment_date: paidAt,
        payment_method: 'Bank Transfer (DVA)',
        reference: reference,
        verified: true,
        created_at: new Date().toISOString(),
      });

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
        return new Response(JSON.stringify({ 
          error: 'Failed to record payment',
          message: paymentError.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 to acknowledge receipt
        });
      }

      // Update invoice
      const newAmountPaid = (parseFloat(invoice.amount_paid?.toString() || '0') + amount);
      const totalAmount = parseFloat(invoice.total_amount?.toString() || '0');
      const newStatus = newAmountPaid >= totalAmount ? 'Paid' : 'Partial';

      const { error: updateError } = await supabaseAdmin
        .from('student_invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        return new Response(JSON.stringify({ 
          error: 'Payment recorded but invoice update failed',
          message: updateError.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      console.log(`Payment processed successfully: ${amount} NGN, invoice ${invoice.id} updated to ${newStatus}`);

      // Mark webhook as processed
      try {
        // Note: reference is stored in the payload JSONB field
        // Using ->> operator for text extraction
        const { data, error: updateError } = await supabaseAdmin
          .from('webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('event_type', event.event)
          .filter('payload->>reference', 'eq', reference);
        
        if (updateError) {
          console.log('Could not update webhook_events:', updateError.message);
        }
      } catch (error: any) {
        // Table might not exist or other error occurred
        console.log('Could not update webhook_events table:', error?.message);
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Payment processed successfully',
        data: {
          amount: amount,
          invoice_id: invoice.id,
          new_status: newStatus,
          reference: reference,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // For other event types, just acknowledge
    console.log(`Received ${event.event} event, no action taken`);
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Event received but not processed' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Always return 200 to prevent Paystack from retrying
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
