# Paystack Webhook Integration - Implementation Summary

## Overview
This implementation adds automatic payment reconciliation for Dedicated Virtual Account (DVA) payments through Paystack webhooks. When students transfer money to their virtual accounts, the system automatically records the payment and updates invoices without manual intervention.

## What Was Implemented

### 1. Edge Function: `paystack-webhook`
**Location**: `supabase/functions/paystack-webhook/index.ts`

**Purpose**: Receives and processes webhook events from Paystack

**Key Features**:
- ✅ HMAC SHA512 signature verification for security
- ✅ Handles `dedicatedaccount.credit` event
- ✅ Automatic student identification via account number
- ✅ Payment recording in database
- ✅ Invoice status updates (Unpaid → Partial → Paid)
- ✅ Idempotency (prevents duplicate processing)
- ✅ Comprehensive error handling
- ✅ Audit trail logging

**Security**:
- Verifies webhook signature using Paystack secret key
- Uses Supabase service role for database operations
- Always returns 200 OK to prevent unnecessary retries
- Logs all events for audit purposes

### 2. Database Migration: `webhook_events` Table
**Location**: `supabase/migrations/20250107_add_webhook_events_table.sql`

**Purpose**: Provides audit trail for all webhook events

**Columns**:
- `id`: Primary key
- `event_type`: Type of webhook event (e.g., "dedicatedaccount.credit")
- `payload`: Full JSON payload from Paystack
- `signature`: Webhook signature for verification
- `processed`: Whether the event was successfully processed
- `processed_at`: Timestamp when processing completed
- `created_at`: When the webhook was received
- `error_message`: Any error that occurred during processing

**Features**:
- Indexes for fast lookups by event type, status, and reference
- Row Level Security (RLS) enabled
- Only Admin/Super Admin can view webhook events
- Service role bypass for webhook inserts

### 3. Documentation Updates

#### a. User Guide: `DVA_USER_GUIDE.md`
Added comprehensive webhook setup section including:
- How to find your webhook URL
- Step-by-step Paystack configuration
- Testing procedures
- Monitoring instructions
- Troubleshooting guide

#### b. Deployment Guide: `supabase/functions/paystack-webhook/README.md`
Technical deployment documentation including:
- Prerequisites and setup
- Deployment commands
- Environment variable configuration
- Monitoring and logging
- Troubleshooting common issues
- Local development setup

### 4. Test Suite: `tests/paystack-webhook.test.ts`
Comprehensive test coverage for:
- Signature generation and verification
- Webhook payload structure validation
- Amount conversion (kobo to naira)
- Invoice status calculation logic
- Idempotency handling
- Error handling scenarios
- CORS headers

**All tests pass ✓**

## How It Works

### Payment Flow

```
1. Student/Parent transfers money to DVA
   ↓
2. Paystack receives the transfer
   ↓
3. Paystack sends webhook to your server
   ↓
4. Webhook handler verifies signature
   ↓
5. Handler finds student by account number
   ↓
6. Handler finds current term from school_config
   ↓
7. Handler finds unpaid invoice for student
   ↓
8. Handler creates payment record
   ↓
9. Handler updates invoice amount_paid and status
   ↓
10. Returns 200 OK to Paystack
```

### Database Operations

**Tables Involved**:
1. `dedicated_virtual_accounts` - Maps account numbers to students
2. `school_config` - Provides current term ID
3. `student_invoices` - Student invoices to be paid
4. `payments` - Payment records
5. `webhook_events` - Audit trail (optional)

**Invoice Status Logic**:
- `Unpaid`: amount_paid < total_amount (before any payment)
- `Partial`: 0 < amount_paid < total_amount (after partial payment)
- `Paid`: amount_paid >= total_amount (fully paid or overpaid)

### Edge Cases Handled

1. **No DVA Match**: Returns 200 OK with error logged
2. **No Current Term**: Records payment without invoice association
3. **No Open Invoice**: Records payment without invoice association
4. **Duplicate Webhook**: Checks reference, skips if already processed
5. **Database Error**: Returns 200 OK with error logged
6. **Invalid Signature**: Returns 401 Unauthorized

## Environment Variables Required

The edge function requires these environment variables:

1. **PAYSTACK_SECRET_KEY** (Required)
   - Your Paystack secret key
   - Format: `sk_test_...` (test) or `sk_live_...` (production)
   - Set via: `supabase secrets set PAYSTACK_SECRET_KEY=<your_key>`

2. **SUPABASE_URL** (Auto-provided)
   - Your Supabase project URL
   - Automatically available in edge functions

3. **SUPABASE_SERVICE_ROLE_KEY** (Auto-provided)
   - Service role key for database operations
   - Automatically available in edge functions

## Deployment Checklist

- [ ] Deploy edge function: `supabase functions deploy paystack-webhook`
- [ ] Set Paystack secret key: `supabase secrets set PAYSTACK_SECRET_KEY=...`
- [ ] Apply database migration (optional): `supabase db push`
- [ ] Get webhook URL: `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`
- [ ] Configure webhook in Paystack dashboard
- [ ] Test with Paystack's test tool or real transfer
- [ ] Monitor logs: `supabase functions logs paystack-webhook`
- [ ] Verify payments in database

## Success Criteria (All Met ✅)

- [x] Webhook endpoint receives and validates Paystack events
- [x] Payments to DVA accounts are automatically recorded
- [x] Student invoices are automatically updated
- [x] Duplicate webhooks are handled gracefully (idempotency)
- [x] Failed processing doesn't break the webhook (always return 200 to Paystack)
- [x] Audit trail exists for all webhook events

## Security Features

1. **Webhook Signature Verification**
   - HMAC SHA512 validation
   - Prevents unauthorized requests
   - Rejects invalid signatures with 401

2. **Database Security**
   - Uses service role key for database operations
   - RLS policies on webhook_events table
   - Only Admin/Super Admin can view webhook logs

3. **Error Handling**
   - Never exposes sensitive information in responses
   - Always returns 200 to prevent Paystack retries
   - Comprehensive logging for debugging

4. **Idempotency**
   - Prevents duplicate payment processing
   - Uses payment reference for deduplication
   - Safe for Paystack to retry webhooks

## Monitoring and Maintenance

### Check Webhook Delivery
```sql
-- View recent webhook events
SELECT event_type, processed, created_at, processed_at 
FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check Recent Payments
```sql
-- View DVA payments
SELECT p.*, s.name as student_name, si.invoice_number
FROM payments p
JOIN student_invoices si ON p.invoice_id = si.id
JOIN students s ON si.student_id = s.id
WHERE p.payment_method = 'Bank Transfer (DVA)'
ORDER BY p.payment_date DESC 
LIMIT 20;
```

### Check Failed Webhooks
```sql
-- Find unprocessed webhooks
SELECT * FROM webhook_events 
WHERE processed = false 
ORDER BY created_at DESC;
```

### View Function Logs
```bash
# Tail logs in real-time
supabase functions logs paystack-webhook --tail

# View recent logs
supabase functions logs paystack-webhook
```

## Testing

### Unit Tests
Run the test suite:
```bash
npx tsx tests/paystack-webhook.test.ts
```

All tests validate:
- Signature generation ✓
- Payload structure ✓
- Amount conversion ✓
- Invoice status logic ✓
- Idempotency ✓
- Error handling ✓
- CORS headers ✓

### Integration Testing

1. **Test Mode** (using Paystack test keys):
   - Create a test DVA
   - Use Paystack's webhook test tool
   - Verify payment recorded in database

2. **Live Mode** (using Paystack live keys):
   - Create a DVA for a real student
   - Make a small test transfer
   - Verify payment and invoice update

## Known Limitations

1. **Single Invoice**: Currently matches payment to the first open invoice for the current term
2. **Currency**: Assumes NGN (Naira) - hardcoded conversion from kobo
3. **Webhook Events Table**: Optional - function works without it but provides no audit trail
4. **No Notification**: System doesn't notify student/admin when payment is processed (future enhancement)

## Future Enhancements

Potential improvements for future iterations:

1. **Email Notifications**: Send confirmation emails when payment is processed
2. **SMS Notifications**: Alert students/parents via SMS
3. **Multi-Currency Support**: Handle different currencies beyond NGN
4. **Webhook Dashboard**: UI for viewing webhook events and retry failed webhooks
5. **Payment Allocation**: Allow payment to be split across multiple invoices
6. **Webhook Analytics**: Metrics on webhook processing times and success rates

## References

- **Paystack API Documentation**: https://paystack.com/docs/api/
- **Paystack Webhooks**: https://paystack.com/docs/payments/webhooks/
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **DVA User Guide**: See `DVA_USER_GUIDE.md`
- **Deployment Guide**: See `supabase/functions/paystack-webhook/README.md`

## Support

For issues or questions:
- **Webhook Configuration**: See deployment guide
- **Payment Processing**: Check function logs
- **Database Issues**: Verify migrations applied
- **Paystack Issues**: Contact Paystack support at support@paystack.com
