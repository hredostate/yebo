# Kudi SMS Migration Summary

## Overview
This migration replaces the Termii WhatsApp/SMS integration with Kudi SMS API for improved delivery rates and cost efficiency.

## What Changed

### New Components
1. **Kudi SMS Service** (`src/services/kudiSmsService.ts`)
   - WhatsApp message sending via templates
   - Personalised SMS sending
   - Auto-compose SMS sending
   - Phone number formatting (234XXXXXXXXXX)
   - Error code translation

2. **Kudi SMS Settings UI** (`src/components/KudiSmsSettings.tsx`)
   - Configure API token per school/campus
   - Set sender ID
   - Configure template codes (payment receipts, fee reminders)
   - Enable/disable integration

3. **Database Tables**
   - `kudisms_settings` - Stores API credentials and template codes
   - `kudisms_message_logs` - Logs all sent messages with delivery status and costs

4. **Edge Functions**
   - `kudisms-send-whatsapp` - Sends WhatsApp messages using form-urlencoded
   - Updated `send-sms` - Routes through Kudi SMS
   - Updated `paystack-webhook` - Sends payment receipts via Kudi SMS
   - Updated `sms-balance` - Fetches balance from last message log

### Removed Components
- `src/services/termiiService.ts`
- `src/components/TermiiSettings.tsx`
- `supabase/functions/termii-send-whatsapp/`
- `supabase/functions/termii-webhook/`
- `supabase/functions/termii-balance/`
- All TERMII_*.md documentation files

### Updated Components
- `src/types.ts` - Kudi SMS types instead of Termii types
- `src/services/whatsappService.ts` - Uses Kudi SMS templates
- `src/components/SettingsView.tsx` - Shows KudiSmsSettings
- `src/components/widgets/SmsWalletCard.tsx` - Shows "Kudi SMS Balance"
- `src/components/EmergencyBroadcast.tsx` - Uses send-sms endpoint
- `src/components/FeeReminderBulkSend.tsx` - Uses send-sms endpoint
- `src/components/StudentReportView.tsx` - Uses send-sms endpoint

## Key Technical Differences

### Termii vs Kudi SMS

| Feature | Termii | Kudi SMS |
|---------|--------|----------|
| Content-Type | application/json | application/x-www-form-urlencoded |
| Parameters | JSON object | Comma-separated string |
| Balance API | Dedicated endpoint | From message response |
| Templates | Optional | Required for WhatsApp |
| Phone Format | Any | Must be 234XXXXXXXXXX |

### API Endpoint Changes

**Termii (Old)**:
```typescript
fetch('https://api.ng.termii.com/api/send/template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: key,
    device_id: device,
    template_id: template,
    phone_number: phone,
    data: { name: "John", amount: "5000" }
  })
});
```

**Kudi SMS (New)**:
```typescript
const formData = new URLSearchParams();
formData.append('token', token);
formData.append('recipient', '234703XXXXXX');
formData.append('template_code', '25XXXXX');
formData.append('parameters', 'John,5000'); // Comma-separated

fetch('https://my.kudisms.net/api/whatsapp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: formData.toString()
});
```

## Migration Steps

### 1. Pre-Migration Setup

1. **Create Kudi SMS Account**
   - Sign up at https://my.kudisms.net
   - Fund your account
   - Note your API token

2. **Request Sender ID**
   - Request approval for sender ID
   - Wait 1-2 business days
   - Note approved sender ID

3. **Create WhatsApp Templates**
   Create and get approval for:
   - **Payment Receipt Template** (7 parameters)
   - **Fee Reminder Template** (3 parameters)
   - **Default Message Template** (1 parameter: `{{message}}`)
   
   Wait 24-48 hours for WhatsApp approval

### 2. Configuration

1. **Database Migration**
   ```sql
   -- Run this migration
   supabase/migrations/20251214_migrate_to_kudisms.sql
   ```

2. **Environment Variables**
   Set in Supabase Edge Function Secrets:
   ```bash
   KUDI_DEFAULT_TEMPLATE_CODE=25XXXXX  # Your default template code
   ```

3. **Admin Panel Configuration**
   - Login as Admin or Accountant
   - Navigate to Settings > Messaging Gateway
   - Fill in:
     - API Token
     - Sender ID
     - Payment Receipt Template Code
     - Fee Reminder Template Code
   - Enable configuration
   - Save

### 3. Testing

1. **Test in Staging First**
   - Configure test Kudi SMS account
   - Send test messages to your own number
   - Verify formatting and delivery

2. **Test All Message Types**
   - [ ] Payment receipts (after DVA credit)
   - [ ] Emergency broadcasts
   - [ ] Fee reminders
   - [ ] Report card notifications

3. **Verify Balance Display**
   - Check SmsWalletCard shows balance correctly
   - Balance updates after each message

### 4. Production Deployment

1. Run database migration
2. Set environment variables
3. Configure Kudi SMS in production
4. Monitor first few messages
5. Check balance deductions

### 5. Post-Migration Cleanup (Optional)

After verifying everything works:
```sql
-- Optional: Drop old Termii tables
DROP TABLE IF EXISTS public.termii_settings CASCADE;
DROP TABLE IF EXISTS public.whatsapp_message_logs CASCADE;
```

## Important Notes

### Phone Number Formatting
All phone numbers MUST be in format: `234XXXXXXXXXX`

Examples:
- ✅ `2348012345678` (MTN)
- ✅ `2347012345678` (Glo)
- ✅ `2349012345678` (Airtel)
- ❌ `08012345678` (Missing country code)
- ❌ `+2348012345678` (Has plus sign)

The system auto-formats, but ensure source data is valid.

### Template Parameters

Parameters must be comma-separated **without spaces**:
- ✅ `John,5000,REF123`
- ❌ `John, 5000, REF123` (has spaces)
- ❌ `["John", "5000", "REF123"]` (is an array)

### Balance Tracking

Kudi SMS doesn't have a dedicated balance API. Balance is:
1. Returned with each message sent
2. Stored in `kudisms_message_logs.balance`
3. Retrieved from latest log entry
4. Displayed in SmsWalletCard

### Error Codes

Common Kudi SMS error codes:
- `000` - Success
- `100` - Invalid token
- `107` - Invalid phone number
- `109` - Insufficient balance
- `188` - Unapproved sender ID
- `300` - Missing parameters

Full list in `src/services/kudiSmsService.ts`

## Troubleshooting

### Messages Not Sending

1. **Check Configuration**
   - Verify API token is correct
   - Confirm sender ID is approved
   - Check template codes are approved

2. **Check Phone Numbers**
   - Must be 234XXXXXXXXXX format
   - Verify parent phone numbers in database

3. **Check Balance**
   - Ensure account has sufficient funds
   - Fund account if needed

4. **Check Logs**
   ```sql
   SELECT * FROM kudisms_message_logs 
   WHERE status = 'failed' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

### Balance Not Showing

1. Send at least one message (balance updates with messages)
2. Check `kudisms_message_logs` for entries with balance data
3. Verify sms-balance function has proper permissions

### Template Errors

1. Verify template is approved in Kudi SMS dashboard
2. Check parameter count matches template
3. Ensure parameters are comma-separated
4. No spaces in parameter list

## Support Resources

### Documentation
- `KUDISMS_SETUP.md` - Complete setup guide
- `KUDISMS_ENV_VARIABLES.md` - Environment variables
- `src/services/kudiSmsService.ts` - API implementation
- `supabase/migrations/20251214_migrate_to_kudisms.sql` - Database schema

### Kudi SMS Support
- Email: support@kudisms.net
- Dashboard: https://my.kudisms.net
- API Docs: https://my.kudisms.net/api-docs

### Internal Logs
- `kudisms_message_logs` - All sent messages
- Edge function logs in Supabase dashboard
- Browser console for frontend errors

## Rollback Plan

If critical issues arise:

1. **Quick Rollback** (restore Termii)
   - Revert to previous commit
   - Restore Termii environment variables
   - Re-enable Termii settings in database

2. **Data Preservation**
   - All old Termii tables remain intact
   - Message history preserved
   - No data loss during migration

3. **Hybrid Mode** (Not Recommended)
   - Keep both integrations configured
   - Route based on campus or school
   - Only as temporary measure

## Success Metrics

Migration is successful when:
- [x] All tests pass
- [x] Code review complete (0 issues)
- [x] Security scan clean (0 alerts)
- [ ] Payment receipts send correctly
- [ ] Emergency broadcasts work
- [ ] Fee reminders deliver
- [ ] Balance displays accurately
- [ ] No increase in failed messages
- [ ] Message costs as expected

## Timeline

- **Setup**: 2-3 days (account creation, template approval)
- **Development**: Complete ✅
- **Testing**: 1-2 days (staging environment)
- **Production**: 1 day (deployment and monitoring)
- **Total**: ~5-7 days

## Contact

For questions or issues with this migration:
1. Check documentation files (KUDISMS_*.md)
2. Review code comments
3. Check Supabase logs
4. Contact development team

---

**Migration completed**: December 14, 2024
**Version**: 1.0
**Status**: Ready for deployment
