// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

interface PayrollStaffInput {
  user_id: string;
  gross_amount: number;
  adjustment_ids: number[];
  narration?: string;
  bank_code: string;
  account_number: string;
  name: string; 
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { periodLabel, items, reason } = await req.json();
    if (!periodLabel || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Invalid request body. 'periodLabel' and 'items' array are required.");
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key is not configured.');
    }

    const { data: userProfile } = await supabaseClient.from('user_profiles').select('school_id').eq('id', user.id).single();
    if (!userProfile) throw new Error('User profile not found.');

    // Use Service Role for backend operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const allAdjustmentIds = items.flatMap((item: PayrollStaffInput) => item.adjustment_ids);
    let totalAmount = 0;
    const transfers = [];
    const itemsToInsert = [];
    
    // 1. Pre-calculation and recipient resolution loop
    for (const item of items as PayrollStaffInput[]) {
        // Fetch adjustments to calculate net pay
        const { data: adjustments, error: adjError } = await adminClient
            .from('payroll_adjustments')
            .select('id, amount, reason, adjustment_type')
            .in('id', item.adjustment_ids);

        if (adjError) throw new Error(`Could not fetch adjustments for ${item.name}: ${adjError.message}`);

        const totalAdjustments = adjustments.reduce((sum: number, adj: { amount: number; adjustment_type: string }) => {
            return adj.adjustment_type === 'addition' ? sum + adj.amount : sum - adj.amount;
        }, 0);
        const net_amount = item.gross_amount + totalAdjustments;

        if (net_amount <= 0) {
            console.log(`Skipping payment for ${item.name} due to non-positive net amount.`);
            continue;
        }

        totalAmount += net_amount;

        // Resolve Paystack recipient (create or retrieve existing)
        let recipientCode = null;
        const { data: existingRecipient } = await adminClient
            .from('paystack_recipients')
            .select('recipient_code')
            .eq('user_id', item.user_id)
            .single();

        if (existingRecipient) {
            recipientCode = existingRecipient.recipient_code;
        } else {
            // Create new recipient via Paystack API
            const recipientPayload = {
                type: "nuban",
                name: item.name,
                account_number: item.account_number,
                bank_code: item.bank_code,
                currency: "NGN"
            };
            
            const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${paystackSecretKey}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(recipientPayload)
            });
            
            const recipientData = await recipientResponse.json();
            if (!recipientResponse.ok || !recipientData.status) {
                throw new Error(`Failed to create Paystack recipient for ${item.name}: ${recipientData.message}`);
            }
            
            recipientCode = recipientData.data.recipient_code;
            
            // Cache recipient in database
            await adminClient.from('paystack_recipients').insert({ 
                user_id: item.user_id, 
                recipient_code: recipientCode, 
                bank_details: recipientData.data.details 
            });
        }
        
        // Add to transfers array for bulk payment
        transfers.push({
            amount: Math.round(net_amount * 100), // Paystack uses kobo (must be integer)
            recipient: recipientCode,
            reason: item.narration || reason || 'Staff salary payment',
        });
        
        const deductionsForDb = adjustments.map((adj: { reason: string; amount: number; adjustment_type: string }) => ({ 
            label: adj.reason, 
            amount: adj.adjustment_type === 'addition' ? adj.amount : -adj.amount 
        }));
        
        // Prepare individual payroll items for later insertion
        itemsToInsert.push({
            // payroll_run_id will be added later
            user_id: item.user_id,
            gross_amount: item.gross_amount,
            deductions: deductionsForDb,
            net_amount: net_amount,
            narration: item.narration || reason,
            paystack_recipient_code: recipientCode,
        });
    }

    if (transfers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No valid payments to process.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // 2. Create the main payroll run entry
    const { data: runData, error: runError } = await adminClient
      .from('payroll_runs')
      .insert({
        school_id: userProfile.school_id, period_label: periodLabel,
        total_amount: totalAmount, status: 'processing', created_by: user.id
      }).select().single();
      
    if (runError) throw runError;

    // 3. Associate items with the run and insert them
    const finalItemsToInsert = itemsToInsert.map(item => ({...item, payroll_run_id: runData.id }));
    const { data: insertedItems, error: itemsError } = await adminClient
        .from('payroll_items')
        .insert(finalItemsToInsert)
        .select('id, user_id, transfer_reference');
        
    if (itemsError) throw itemsError;

    // 4. Initiate bulk transfer with Paystack
    const bulkTransferResponse = await fetch('https://api.paystack.co/transfer/bulk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${paystackSecretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: "NGN", source: "balance", transfers: transfers })
    });
    
    const bulkData = await bulkTransferResponse.json();
    
    
    // Check if bulk transfer was successful
    if (!bulkTransferResponse.ok || !bulkData.status) {
        // Update run status to failed and store error details
        await adminClient
            .from('payroll_runs')
            .update({ 
                status: 'failed', 
                meta: { 
                    error: bulkData.message,
                    paystack_response: bulkData 
                } 
            })
            .eq('id', runData.id);
            
        throw new Error(`Paystack bulk transfer initiation failed: ${bulkData.message}`);
    }

    // 5. Update payroll items with individual transfer codes
    // Paystack bulk transfer response contains array of transfer results
    if (bulkData.data && Array.isArray(bulkData.data)) {
        for (let i = 0; i < bulkData.data.length; i++) {
            const transferResult = bulkData.data[i];
            const itemToUpdate = insertedItems?.[i];
            
            if (itemToUpdate && transferResult.transfer_code) {
                await adminClient
                    .from('payroll_items')
                    .update({ 
                        transfer_status: transferResult.status,
                        transfer_code: transferResult.transfer_code
                    })
                    .eq('id', itemToUpdate.id);
            }
        }
    }

    // 6. Update the payroll run status to success
    await adminClient
        .from('payroll_runs')
        .update({ 
            status: 'success',
            meta: {
                total_transfers: bulkData.data?.length || 0,
                paystack_message: bulkData.message
            }
        })
        .eq('id', runData.id);
        
    // 7. Mark adjustments as processed
    if (allAdjustmentIds.length > 0) {
        await adminClient
            .from('payroll_adjustments')
            .update({ payroll_run_id: runData.id })
            .in('id', allAdjustmentIds);
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: bulkData.message || 'Payroll run initiated successfully.',
        data: {
            payroll_run_id: runData.id,
            total_amount: totalAmount,
            transfers_count: transfers.length,
            paystack_response: bulkData.data
        }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});