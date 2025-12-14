# Kudi SMS Environment Variables

This document lists the environment variables required for the Kudi SMS integration.

## Supabase Edge Function Secrets

These environment variables should be configured in your Supabase project:

### Required: Default Template Code
```bash
KUDI_DEFAULT_TEMPLATE_CODE=25XXXXX
```
**Description**: Default WhatsApp template code for free-form messages (emergency broadcasts, fee reminders, etc.). This template should have a single `{{message}}` placeholder.

**How to set**:
1. Create a WhatsApp template with a single `{{message}}` placeholder in Kudi SMS dashboard
2. Wait for WhatsApp approval
3. Note the template code (e.g., `25XXXXX`)
4. Go to Supabase Dashboard > Edge Functions > Settings
5. Add a new secret:
   - Name: `KUDI_DEFAULT_TEMPLATE_CODE`
   - Value: Your approved default template code

**Template Format**:
```
{{message}}
```

This simple template allows the system to send any message content while maintaining WhatsApp's template requirements.

## Database Configuration

All Kudi SMS API credentials are stored in the database in the `kudisms_settings` table, not as environment variables. This allows:
- Multiple schools to use different Kudi SMS accounts
- Campus-specific configurations
- Easy management through the admin UI

### Settings Stored in Database:
- **token**: Kudi SMS API token
- **sender_id**: Approved sender ID
- **payment_receipt_template_code**: Template for payment receipts
- **fee_reminder_template_code**: Template for fee reminders
- **is_active**: Enable/disable the integration

## Migration from Termii

If you're migrating from Termii, you can remove these old environment variables:
- `TERMII_API_KEY` - No longer needed
- `TERMII_DEVICE_ID` - No longer needed
- `TERMII_BASE_URL` - No longer needed

## Configuration Steps

1. **Create Kudi SMS Account**
   - Sign up at https://my.kudisms.net
   - Fund your account

2. **Get API Credentials**
   - Log in to Kudi SMS Dashboard
   - Navigate to API section
   - Copy your API Token

3. **Request Sender ID**
   - Request a sender ID in the dashboard
   - Wait for approval (1-2 business days)

4. **Create WhatsApp Templates**
   - Create templates for:
     - Payment receipts
     - Fee reminders
     - Emergency broadcasts (optional)
   - Wait for WhatsApp approval (24-48 hours)
   - Note down template codes (e.g., 25XXXXX)

5. **Configure in Application**
   - Log in as Admin or Accountant
   - Navigate to Settings > Messaging Gateway
   - Fill in the form with your credentials
   - Save and activate

## Testing

1. Configure Kudi SMS in your test/staging environment first
2. Use test template codes
3. Send test messages to your own phone number
4. Verify messages are delivered correctly
5. Check balance deductions
6. Once confirmed working, configure in production

## Security Notes

- API tokens are stored encrypted in the database
- Row Level Security (RLS) protects settings from unauthorized access
- Only Admin and Accountant roles can view/modify settings
- Never expose API tokens in client-side code
- Never commit API tokens to version control

## Troubleshooting

### Messages not sending
- Check API token is correct in settings
- Verify sender ID is approved
- Ensure template codes are approved
- Check phone number format (234XXXXXXXXXX)
- Verify account has sufficient balance

### Balance not showing
- Send at least one message first (balance is updated with each message)
- Check `kudisms_message_logs` table for recent entries with balance data

### Template errors
- Ensure template is approved in Kudi SMS dashboard
- Verify template code is correct
- Check parameter count matches template definition
- Parameters must be comma-separated without spaces

## Support

For environment variable issues or configuration help, consult:
- `KUDISMS_SETUP.md` - Complete setup guide
- `supabase/migrations/20251214_migrate_to_kudisms.sql` - Database schema
- `src/services/kudiSmsService.ts` - Service implementation

For Kudi SMS API issues:
- Email: support@kudisms.net
- Dashboard: https://my.kudisms.net
