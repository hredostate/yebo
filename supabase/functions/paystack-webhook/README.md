# Paystack Webhook Handler Deployment Guide

## Overview
This edge function handles webhook events from Paystack for Dedicated Virtual Account (DVA) payments. When students transfer money to their virtual accounts, this function automatically reconciles the payment and updates invoices.

## Prerequisites

1. **Supabase CLI** installed:
   ```bash
   npm install -g supabase
   ```

2. **Supabase Project** set up and linked:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

3. **Environment Variables** configured in Supabase:
   - `PAYSTACK_SECRET_KEY`: Your Paystack secret key (starts with `sk_test_` or `sk_live_`)
   - `SUPABASE_URL`: Automatically provided by Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Automatically provided by Supabase

## Deployment Steps

### 1. Deploy the Edge Function

From the repository root, run:

```bash
supabase functions deploy paystack-webhook
```

This will deploy the function to your Supabase project.

### 2. Set Environment Variables

If not already set, configure the Paystack secret key:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
```

For production, use your live key:
```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your_secret_key_here
```

### 3. Apply Database Migration (Optional)

The webhook_events table provides audit logging. To create it:

```bash
supabase db push --include-all
```

Or run the migration manually:
```bash
psql <your-database-url> < supabase/migrations/20250107_add_webhook_events_table.sql
```

### 4. Get Your Webhook URL

Your webhook URL will be:
```
https://<project-ref>.supabase.co/functions/v1/paystack-webhook
```

To find your project reference:
- Check your Supabase dashboard URL
- Or run: `supabase status` and look for the API URL

Example:
```
https://abcdefghijklmnop.supabase.co/functions/v1/paystack-webhook
```

### 5. Configure Webhook in Paystack

1. Log in to [Paystack Dashboard](https://dashboard.paystack.com/)
2. Navigate to **Settings → Webhooks**
3. Click **Add New Webhook URL**
4. Enter your webhook URL
5. Select events:
   - ✅ `dedicatedaccount.credit`
6. Save

### 6. Test the Webhook

#### Option A: Use Paystack's Test Tool
1. In Paystack dashboard, go to **Webhooks**
2. Click on your webhook URL
3. Click **Test** and select `dedicatedaccount.credit`
4. Paystack will send a test event

#### Option B: Make a Real Test Payment
1. Create a DVA for a test student
2. Transfer a small amount to the account
3. Check the webhook logs in Paystack
4. Verify the payment was recorded in the database

## Monitoring

### View Function Logs

```bash
supabase functions logs paystack-webhook
```

Or view in the Supabase dashboard:
- Go to **Functions** → **paystack-webhook** → **Logs**

### Check Webhook Events

Query the audit table:
```sql
SELECT * FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Recent Payments

```sql
SELECT p.*, si.invoice_number, s.name 
FROM payments p
JOIN student_invoices si ON p.invoice_id = si.id
JOIN students s ON si.student_id = s.id
WHERE p.payment_method = 'Bank Transfer (DVA)'
ORDER BY p.payment_date DESC 
LIMIT 10;
```

## Troubleshooting

### Function Not Receiving Requests

1. **Check function is deployed:**
   ```bash
   supabase functions list
   ```

2. **Verify URL in Paystack is correct**

3. **Check function logs for errors:**
   ```bash
   supabase functions logs paystack-webhook --tail
   ```

### Signature Verification Failing

1. **Verify PAYSTACK_SECRET_KEY is set correctly:**
   ```bash
   supabase secrets list
   ```

2. **Check you're using the right key** (test vs live)

3. **Verify the key matches** what's in Paystack dashboard

### Payment Not Being Recorded

1. **Check student has a DVA record:**
   ```sql
   SELECT * FROM dedicated_virtual_accounts 
   WHERE account_number = '<account_number>';
   ```

2. **Check current term is configured:**
   ```sql
   SELECT * FROM school_config 
   WHERE school_id = <school_id>;
   ```

3. **Check student has an unpaid invoice:**
   ```sql
   SELECT * FROM student_invoices 
   WHERE student_id = <student_id> 
   AND status IN ('Unpaid', 'Partial');
   ```

4. **Check function logs** for error messages

### Duplicate Webhooks

The function handles duplicate webhooks automatically using the payment reference. If Paystack resends a webhook, the function will detect the existing payment and return success without creating a duplicate.

## Security Notes

1. **Signature Verification**: All webhooks are verified using HMAC SHA512
2. **Service Role Key**: Used for database operations, bypasses RLS
3. **Always Returns 200**: Even on errors, to prevent Paystack retries
4. **Audit Trail**: All events logged in webhook_events table

## Local Development

To test locally:

1. **Start local Supabase:**
   ```bash
   supabase start
   ```

2. **Serve function locally:**
   ```bash
   supabase functions serve paystack-webhook --env-file .env.local
   ```

3. **Use ngrok or similar** to expose localhost to Paystack:
   ```bash
   ngrok http 54321
   ```

4. **Configure ngrok URL** in Paystack dashboard with path:
   ```
   https://your-ngrok-url.ngrok.io/functions/v1/paystack-webhook
   ```

## Rollback

If you need to remove the function:

```bash
supabase functions delete paystack-webhook
```

To remove the webhook from Paystack:
1. Go to Paystack Dashboard → Settings → Webhooks
2. Find your webhook URL
3. Click Delete

## Support

For issues:
- **Edge Function Issues**: Check Supabase documentation
- **Paystack Webhook Issues**: Contact Paystack support
- **Application Logic**: Check function logs and database state
