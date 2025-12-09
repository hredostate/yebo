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
 * Send WhatsApp payment receipt to parent
 */
async function sendWhatsAppPaymentReceipt(
  supabaseAdmin: any,
  schoolId: number,
  studentId: number,
  amountPaid: number,
  reference: string,
  paymentDate: string,
  totalPaid: number,
  totalAmount: number,
  paymentMethod: string
) {
  try {
    // Get student details
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('name, parent_phone_number_1')
      .eq('id', studentId)
      .single();

    if (studentError || !student || !student.parent_phone_number_1) {
      console.log('Cannot send receipt: No parent phone number found for student', studentId);
      return;
    }

    const remainingBalance = totalAmount - totalPaid;
    const formattedDate = new Date(paymentDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // Prepare WhatsApp message
    const message = `Dear Parent,\n\nPayment Receipt Confirmation\n\n` +
      `Student: ${student.name}\n` +
      `Amount Paid: ₦${amountPaid.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `Payment Method: ${paymentMethod}\n` +
      `Reference: ${reference}\n` +
      `Date: ${formattedDate}\n` +
      `Total Paid: ₦${totalPaid.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `Remaining Balance: ₦${remainingBalance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `Thank you for your payment.\n\n` +
      `School Guardian 360`;

    // Get Termii settings
    const { data: termiiSettings } = await supabaseAdmin
      .from('termii_settings')
      .select('api_key, device_id, base_url, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .single();

    if (!termiiSettings) {
      console.log('Termii not configured for school', schoolId);
      return;
    }

    // Send via Termii
    const termiiUrl = `${termiiSettings.base_url || 'https://api.ng.termii.com'}/api/sms/send`;
    const termiiPayload = {
      api_key: termiiSettings.api_key,
      to: student.parent_phone_number_1,
      from: 'SchoolGuardian',
      sms: message,
      type: 'plain',
      channel: 'whatsapp',
    };

    const termiiResponse = await fetch(termiiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(termiiPayload),
    });

    const termiiResult = await termiiResponse.json();
    
    // Log the message
    await supabaseAdmin.from('whatsapp_message_logs').insert({
      school_id: schoolId,
      recipient_phone: student.parent_phone_number_1,
      template_id: null,
      message_type: 'conversational',
      message_content: { message, reference },
      media_url: null,
      termii_message_id: termiiResult.message_id,
      status: termiiResponse.ok ? 'sent' : 'failed',
      error_message: termiiResponse.ok ? null : (termiiResult.message || 'Failed to send'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    console.log(`WhatsApp receipt sent to ${student.parent_phone_number_1} for payment ${reference}`);
  } catch (error) {
    console.error('Error sending WhatsApp receipt:', error);
    // Don't throw - receipt sending is non-critical
  }
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

      // Send WhatsApp payment receipt to parent
      await sendWhatsAppPaymentReceipt(
        supabaseAdmin,
        dvaRecord.school_id,
        dvaRecord.student_id,
        amount,
        reference,
        paidAt,
        newAmountPaid,
        totalAmount,
        'Bank Transfer (DVA)'
      );

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

    // Handle charge.success event (card payments)
    if (event.event === 'charge.success') {
      const { data } = event;
      
      // Validate required fields
      if (!data.reference || !data.amount) {
        console.error('Missing reference or amount in charge.success webhook data');
        console.error('Received data:', JSON.stringify(data, null, 2));
        return new Response(JSON.stringify({ error: 'Invalid webhook data' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      const reference = data.reference;
      const amount = data.amount / 100; // Convert from kobo to naira
      const paidAt = data.paid_at;
      const customerEmail = data.customer?.email;

      console.log(`Processing card payment: ${amount} NGN, reference: ${reference}`);

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

      // Try to find student by email or reference pattern
      // Reference format might be: INVOICE-{invoice_id}-{timestamp} or custom format
      let studentId: number | null = null;
      let schoolId: number | null = null;
      let invoiceId: number | null = null;

      // First, check if reference contains invoice ID
      const invoiceMatch = reference.match(/INVOICE-(\d+)/i);
      if (invoiceMatch) {
        const extractedInvoiceId = parseInt(invoiceMatch[1]);
        const { data: invoiceData } = await supabaseAdmin
          .from('student_invoices')
          .select('id, student_id, term_id, total_amount, amount_paid, status')
          .eq('id', extractedInvoiceId)
          .single();

        if (invoiceData) {
          invoiceId = invoiceData.id;
          
          // Get student and school info
          const { data: studentData } = await supabaseAdmin
            .from('students')
            .select('id, school_id, name, parent_phone_number_1')
            .eq('id', invoiceData.student_id)
            .single();

          if (studentData) {
            studentId = studentData.id;
            schoolId = studentData.school_id;
          }
        }
      }

      // If we couldn't find via reference, try via customer email
      if (!studentId && customerEmail) {
        const { data: studentData } = await supabaseAdmin
          .from('students')
          .select('id, school_id, name, parent_phone_number_1')
          .eq('email', customerEmail)
          .single();

        if (studentData) {
          studentId = studentData.id;
          schoolId = studentData.school_id;

          // Find unpaid invoice
          const { data: schoolConfig } = await supabaseAdmin
            .from('school_config')
            .select('current_term_id')
            .eq('school_id', schoolId)
            .single();

          if (schoolConfig?.current_term_id) {
            const { data: invoices } = await supabaseAdmin
              .from('student_invoices')
              .select('id, total_amount, amount_paid, status')
              .eq('student_id', studentId)
              .eq('term_id', schoolConfig.current_term_id)
              .in('status', ['Unpaid', 'Partial'])
              .order('created_at', { ascending: true });

            if (invoices && invoices.length > 0) {
              invoiceId = invoices[0].id;
            }
          }
        }
      }

      // If we still don't have school info, we can't process this properly
      if (!schoolId) {
        console.error('Could not determine school for card payment');
        console.error('Payment details:', { reference, amount, customerEmail });
        console.error('This payment requires manual review and association');
        
        // Record to a separate unmatched_payments table for manual review
        // If table doesn't exist, just log the issue
        try {
          await supabaseAdmin.from('unmatched_payments').insert({
            reference: reference,
            amount: amount,
            payment_date: paidAt,
            payment_method: 'Card Payment',
            customer_email: customerEmail,
            raw_data: data,
            verified: true,
            created_at: new Date().toISOString(),
          });
          
          console.log('Payment logged to unmatched_payments for manual review');
        } catch (unmatchedError) {
          // Table might not exist, log to default payments table with null school
          console.log('unmatched_payments table not available, using payments table');
          await supabaseAdmin.from('payments').insert({
            school_id: null,
            invoice_id: null,
            amount: amount,
            payment_date: paidAt,
            payment_method: 'Card Payment',
            reference: reference,
            verified: true,
            created_at: new Date().toISOString(),
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Payment recorded but requires manual school association',
          requires_manual_review: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Record payment
      const { error: paymentError } = await supabaseAdmin.from('payments').insert({
        school_id: schoolId,
        invoice_id: invoiceId,
        amount: amount,
        payment_date: paidAt,
        payment_method: 'Card Payment',
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
          status: 200,
        });
      }

      // Update invoice if found
      let newAmountPaid = amount;
      let totalAmount = amount;
      let newStatus = 'Paid';

      if (invoiceId) {
        const { data: invoice } = await supabaseAdmin
          .from('student_invoices')
          .select('id, total_amount, amount_paid, status')
          .eq('id', invoiceId)
          .single();

        if (invoice) {
          newAmountPaid = (parseFloat(invoice.amount_paid?.toString() || '0') + amount);
          totalAmount = parseFloat(invoice.total_amount?.toString() || '0');
          newStatus = newAmountPaid >= totalAmount ? 'Paid' : 'Partial';

          await supabaseAdmin
            .from('student_invoices')
            .update({
              amount_paid: newAmountPaid,
              status: newStatus,
            })
            .eq('id', invoice.id);

          console.log(`Card payment processed: ${amount} NGN, invoice ${invoice.id} updated to ${newStatus}`);
        }
      }

      // Send WhatsApp receipt if we have student info
      if (studentId) {
        await sendWhatsAppPaymentReceipt(
          supabaseAdmin,
          schoolId,
          studentId,
          amount,
          reference,
          paidAt,
          newAmountPaid,
          totalAmount,
          'Card Payment'
        );
      }

      // Mark webhook as processed
      try {
        await supabaseAdmin
          .from('webhook_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('event_type', event.event)
          .filter('payload->>reference', 'eq', reference);
      } catch (error: any) {
        console.log('Could not update webhook_events table:', error?.message);
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Card payment processed successfully',
        data: {
          amount: amount,
          reference: reference,
          invoice_id: invoiceId,
          new_status: newStatus,
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
