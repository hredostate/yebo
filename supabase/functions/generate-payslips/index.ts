// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured HTML template for a comprehensive payslip
const generatePayslipHtml = (item: any, run: any, school: any) => {
    const normalizeLineItems = (payload: any) => {
        if (payload.line_items && payload.line_items.length > 0) return payload.line_items;
        return (payload.deductions || []).map((d: any, idx: number) => ({
            id: `${payload.id}-${idx}`,
            label: d.label,
            category: d.amount >= 0 ? 'earning' : 'deduction',
            amount: d.amount,
        }));
    };

    const lineItems = normalizeLineItems(item);
    const earnings = lineItems.filter((li: any) => li.category === 'earning');
    const deductions = lineItems.filter((li: any) => li.category === 'deduction');
    const employer = lineItems.filter((li: any) => li.category === 'employer_contrib');
    const toCurrency = (num: number) => `₦${Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const gross = earnings.reduce((sum: number, li: any) => sum + Number(li.amount || 0), item.gross_amount || 0);
    const totalDeductions = deductions.reduce((sum: number, li: any) => sum + Math.abs(Number(li.amount || 0)), 0);
    const employerTotal = employer.reduce((sum: number, li: any) => sum + Number(li.amount || 0), item.total_employer_contributions || 0);
    const ytdGross = item.meta?.ytd?.gross || gross;
    const ytdTax = item.meta?.ytd?.tax || deductions
        .filter((d: any) => (d.label || '').toLowerCase().includes('tax'))
        .reduce((sum: number, d: any) => sum + Math.abs(Number(d.amount || 0)), 0);
    const ytdPensionEmployee = item.meta?.ytd?.pension_employee || deductions
        .filter((d: any) => (d.label || '').toLowerCase().includes('pension'))
        .reduce((sum: number, d: any) => sum + Math.abs(Number(d.amount || 0)), 0);
    const ytdPensionEmployer = item.meta?.ytd?.pension_employer || employer
        .filter((d: any) => (d.label || '').toLowerCase().includes('pension'))
        .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
    const ytdNet = item.meta?.ytd?.net || ytdGross - totalDeductions;

    const paymentDate = item.pay_date || run.pay_date || run.created_at;

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #0f172a; background: #f8fafc; }
        .container { width: 900px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(15,23,42,0.05); }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e0f2fe; color: #075985; font-weight: 600; font-size: 11px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; text-align: left; color: #475569; font-size: 11px; letter-spacing: 0.03em; }
        .totals { background: #0ea5e9; color: #fff; font-weight: 700; }
        .section-title { margin-top: 12px; font-size: 12px; font-weight: 700; color: #0f172a; }
        .note { font-size: 11px; color: #475569; margin-top: 12px; }
        .summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="brand">
                <div>
                    <div style="font-size:18px;font-weight:800;">${school.display_name || 'Employer'}</div>
                    <div style="color:#475569;font-size:11px;">${school.address || ''}</div>
                </div>
            </div>
            <div style="text-align:right;">
                <div class="badge">${(item.status || run.status || 'Final').toUpperCase()}</div>
                <div style="font-size:12px;font-weight:700;">Payslip • ${run.pay_period_label || run.period_label}</div>
                <div style="color:#475569;font-size:11px;">Pay date: ${new Date(paymentDate).toLocaleDateString()}</div>
                <div style="color:#475569;font-size:11px;">Reference: ${item.reference_number || run.reference_number || `RUN-${run.id}`}</div>
            </div>
        </div>

        <div class="grid" style="margin-bottom:12px;">
            <div class="summary">
                <div class="section-title">Staff Details</div>
                <div style="font-size:11px;">
                    <div><strong>Name:</strong> ${item.user?.name || 'N/A'}</div>
                    <div><strong>Staff ID:</strong> ${item.user?.staff_code || 'N/A'}</div>
                    <div><strong>Department:</strong> ${item.department || 'N/A'}</div>
                    <div><strong>Role:</strong> ${item.role_title || item.user?.role || 'N/A'}</div>
                    <div><strong>Employment Type:</strong> ${item.employment_type || 'N/A'}</div>
                </div>
            </div>
            <div class="summary">
                <div class="section-title">Payment Info</div>
                <div style="font-size:11px;">
                    <div><strong>Method:</strong> ${item.payment_method || run.payment_method || 'Offline/Manual'}</div>
                    <div><strong>Status:</strong> ${item.transfer_status || run.status || 'Finalized'}</div>
                    <div><strong>Bank:</strong> ${item.user?.bank_name || 'N/A'}</div>
                    <div><strong>Account:</strong> ${item.user?.account_number ? '******' + String(item.user.account_number).slice(-4) : 'N/A'}</div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div>
                <div class="section-title">Earnings</div>
                <table>
                    <thead><tr><th>Component</th><th style="text-align:right;">Amount</th></tr></thead>
                    <tbody>
                        ${earnings.map((e: any) => `<tr><td>${e.label}</td><td style="text-align:right;">${toCurrency(e.amount)}</td></tr>`).join('')}
                        <tr class="totals"><td>Gross Pay</td><td style="text-align:right;">${toCurrency(gross)}</td></tr>
                    </tbody>
                </table>
            </div>
            <div>
                <div class="section-title">Deductions</div>
                <table>
                    <thead><tr><th>Component</th><th style="text-align:right;">Amount</th></tr></thead>
                    <tbody>
                        ${deductions.map((d: any) => `<tr><td>${d.label}</td><td style="text-align:right;">${toCurrency(Math.abs(d.amount))}</td></tr>`).join('') || '<tr><td colspan="2">None</td></tr>'}
                        <tr class="totals"><td>Total Deductions</td><td style="text-align:right;">${toCurrency(totalDeductions)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div style="margin-top:10px;">
            <table>
                <tbody>
                    <tr class="totals" style="background:#16a34a;">
                        <td>Net Pay (Take Home)</td>
                        <td style="text-align:right;">${toCurrency(item.net_amount)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="grid">
            <div>
                <div class="section-title">Employer Contributions</div>
                <table>
                    <thead><tr><th>Component</th><th style="text-align:right;">Amount</th></tr></thead>
                    <tbody>
                        ${employer.map((e: any) => `<tr><td>${e.label}</td><td style="text-align:right;">${toCurrency(e.amount)}</td></tr>`).join('') || '<tr><td colspan="2">None</td></tr>'}
                        <tr class="totals"><td>Total Employer Cost</td><td style="text-align:right;">${toCurrency(employerTotal)}</td></tr>
                    </tbody>
                </table>
            </div>
            <div>
                <div class="section-title">YTD Summary</div>
                <table>
                    <tbody>
                        <tr><td>Year-to-date Gross</td><td style="text-align:right;">${toCurrency(ytdGross)}</td></tr>
                        <tr><td>Year-to-date Tax</td><td style="text-align:right;">${toCurrency(ytdTax)}</td></tr>
                        <tr><td>Year-to-date Pension (EE)</td><td style="text-align:right;">${toCurrency(ytdPensionEmployee)}</td></tr>
                        <tr><td>Year-to-date Pension (ER)</td><td style="text-align:right;">${toCurrency(ytdPensionEmployer)}</td></tr>
                        <tr><td>Year-to-date Net</td><td style="text-align:right;">${toCurrency(ytdNet)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="note">
            <p>This payslip is computer-generated. For queries, contact Payroll.</p>
            <p>${school.motto || ''}</p>
        </div>
    </div>
</body>
</html>`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Get secrets and initialize clients
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const pdfApiKey = Deno.env.get('PDF_API_KEY');
    const pdfApiSecret = Deno.env.get('PDF_API_SECRET');
    const pdfApiWorkspace = Deno.env.get('PDF_API_WORKSPACE');
    if (!pdfApiKey || !pdfApiSecret || !pdfApiWorkspace) {
        throw new Error('PDF generation secrets are not configured.');
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    // 2. Get request body and validate
    const { run_id } = await req.json();
    if (!run_id) throw new Error("Missing 'run_id' in request body.");

    // 3. Fetch all necessary data
    const { data: run, error: runError } = await adminClient.from('payroll_runs').select('*').eq('id', run_id).single();
    if (runError) throw runError;

    const { data: items, error: itemsError } = await adminClient
        .from('payroll_items')
        .select('*, user:user_profiles(*), line_items:payroll_line_items(*, component:payroll_components(*))')
        .eq('payroll_run_id', run_id);
    if (itemsError) throw itemsError;

    const { data: school, error: schoolError } = await adminClient.from('school_config').select('*').eq('school_id', run.school_id).single();
    if (schoolError) throw schoolError;

    const pdfAuthToken = btoa(`${pdfApiKey}:${pdfApiSecret}`);
    const pdfEndpoint = 'https://us1.pdfgeneratorapi.com/api/v4/documents/generate';

    // 4. Loop through items, generate PDF, and update record
    for (const item of items) {
        if (!item.user) {
            console.warn(`Skipping payslip for item ${item.id} because user data is missing.`);
            continue;
        }

        const htmlContent = generatePayslipHtml(item, run, school);

        const pdfPayload = {
            template: { "format": "html", "content": htmlContent },
            format: "pdf",
            output: "url",
            name: `payslip_${item.user.name.replace(/\s/g, '_')}_${run.period_label.replace(/\s/g, '_')}`
        };

        const generationResponse = await fetch(pdfEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pdfAuthToken}`,
                'X-Auth-Workspace': pdfApiWorkspace,
            },
            body: JSON.stringify(pdfPayload)
        });

        if (!generationResponse.ok) {
            const errorBody = await generationResponse.json();
            throw new Error(`PDF API failed for ${item.user.name}: ${JSON.stringify(errorBody)}`);
        }

        const genData = await generationResponse.json();
        const pdfUrl = genData.response;

        const pdfFileResponse = await fetch(pdfUrl);
        if (!pdfFileResponse.ok) throw new Error(`Failed to download generated PDF from ${pdfUrl}`);
        const pdfBlob = await pdfFileResponse.blob();

        // --- Upload to Supabase Storage ---
        const filePath = `payslips/${run.id}/${item.user.id}_${run.period_label.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const { error: uploadError } = await adminClient.storage
            .from('documents')
            .upload(filePath, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) throw uploadError;

        // --- Update item with URL ---
        const { data: { publicUrl } } = adminClient.storage.from('documents').getPublicUrl(filePath);
        await adminClient.from('payroll_items').update({ payslip_url: publicUrl }).eq('id', item.id);
    }

    return new Response(JSON.stringify({ success: true, message: `${items.length} payslips generated successfully.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in generate-payslips function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
