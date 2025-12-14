# Kudi SMS Integration Setup Guide

This guide explains how to integrate Kudi SMS for WhatsApp and SMS messaging in the School Guardian 360 system.

## Overview

Kudi SMS is a Nigerian SMS and WhatsApp messaging platform that provides:
- WhatsApp Business API integration with pre-approved templates
- Bulk SMS capabilities
- High delivery rates
- Competitive pricing

## Prerequisites

1. A Kudi SMS account ([https://my.kudisms.net](https://my.kudisms.net))
2. API Token from your Kudi SMS dashboard
3. Approved Sender ID
4. Pre-approved WhatsApp templates

## Getting Started

### Step 1: Create a Kudi SMS Account

1. Visit [https://my.kudisms.net](https://my.kudisms.net)
2. Sign up for an account
3. Complete the verification process
4. Fund your account

### Step 2: Get Your API Token

1. Log in to your Kudi SMS dashboard
2. Navigate to the API section
3. Copy your API Token
4. Store it securely - you'll need it for configuration

### Step 3: Request Sender ID

1. In your Kudi SMS dashboard, request a Sender ID
2. Choose a meaningful name (e.g., "YourSchool", "SchoolName")
3. Wait for approval (usually takes 1-2 business days)
4. Note: Sender IDs must be alphanumeric, max 11 characters

### Step 4: Create WhatsApp Templates

WhatsApp requires pre-approved templates for business messaging. Create templates for:

#### Payment Receipt Template
```
Dear {{student_name}},

Payment Confirmation:
Amount Paid: ₦{{amount_paid}}
Method: {{payment_method}}
Reference: {{reference}}
Date: {{date}}

Total Paid: ₦{{total_paid}}
Balance: ₦{{remaining_balance}}

Thank you!
```

#### Fee Reminder Template
```
Dear Parent,

Fee Reminder for {{student_name}}:
Outstanding Amount: ₦{{amount}}
Due Date: {{due_date}}

Please make payment at your earliest convenience.

Thank you.
```

**Important Notes:**
- Templates must be approved by WhatsApp before use
- Template approval can take 24-48 hours
- Save your template codes (e.g., "25XXXXX") after approval

## Configuration in School Guardian 360

### Step 1: Configure in Admin Panel

1. Log in as Admin or Accountant
2. Navigate to Settings > Messaging > Kudi SMS
3. Fill in the required fields:
   - **Campus**: Select campus or leave as "All Campuses"
   - **API Token**: Your Kudi SMS API token
   - **Sender ID**: Your approved sender ID
   - **Payment Receipt Template Code**: Template code for payment receipts (e.g., 25XXXXX)
   - **Fee Reminder Template Code**: Template code for fee reminders (e.g., 25YYYYY)
4. Enable the configuration
5. Save

### Step 2: Database Setup

The migration creates two tables:
- `kudisms_settings`: Stores API credentials per school/campus
- `kudisms_message_logs`: Logs all sent messages with delivery status

Migration file: `supabase/migrations/20251214_migrate_to_kudisms.sql`

## Phone Number Format

All phone numbers must be in Nigerian international format:
- **Format**: `234XXXXXXXXXX`
- **Examples**:
  - `2348012345678` (MTN)
  - `2347012345678` (Glo)
  - `2349012345678` (Airtel)

The system automatically formats phone numbers, but ensure they're valid Nigerian numbers.

## API Endpoints

### WhatsApp API (Primary)
```
POST https://my.kudisms.net/api/whatsapp
Content-Type: application/x-www-form-urlencoded

Parameters:
- token: Your API token
- recipient: Phone number (234XXXXXXXXXX)
- template_code: Pre-approved template code
- parameters: Comma-separated values for template placeholders
- button_parameters: Button parameters (if any)
- header_parameters: Header parameters (if any)
```

### Personalised SMS API
```
POST https://my.kudisms.net/api/personalisedsms
Content-Type: application/json

{
  "token": "your_token",
  "senderID": "YourSenderID",
  "message": "Template with {{placeholders}}",
  "csvHeaders": ["phone_number", "name"],
  "recipients": [
    {"phone_number": "234703xxxxx", "name": "John"}
  ]
}
```

## Response Codes

| Code | Meaning |
|------|---------|
| 000  | Message Sent Successfully |
| 100  | Token provided is invalid |
| 107  | Invalid phone number |
| 109  | Insufficient credit balance |
| 188  | Sender ID is unapproved |
| 300  | Missing parameters |

Full list in `src/services/kudiSmsService.ts`

## Usage Examples

### Send Payment Receipt
```typescript
import { supabase } from './supabaseClient';

const result = await supabase.functions.invoke('kudisms-send-whatsapp', {
  body: {
    phone_number: '08012345678',
    template_code: '25XXXXX',
    parameters: 'John Doe,5000,Bank Transfer,REF123,15 Dec 2024,10000,15000',
    school_id: 1
  }
});
```

### Check Message Status
```typescript
const { data: logs } = await supabase
  .from('kudisms_message_logs')
  .select('*')
  .eq('school_id', schoolId)
  .order('created_at', { ascending: false })
  .limit(50);
```

## Testing

1. Start with test mode in your Kudi SMS account
2. Send test messages to your own phone number
3. Verify template parameters are correctly replaced
4. Check message logs in the database
5. Verify balance deductions
6. Switch to live mode after testing

## Troubleshooting

### Messages Not Sending
- Verify API token is correct
- Check sender ID is approved
- Ensure template code is approved
- Verify phone number format (234XXXXXXXXXX)
- Check account balance

### Template Parameters Not Replacing
- Ensure parameters are comma-separated
- Match parameter order with template definition
- No spaces after commas unless intended

### Balance Issues
- Check balance in Kudi SMS dashboard
- Error code 109 means insufficient balance
- Fund account and retry

## Cost Considerations

- WhatsApp messages: ~₦3.5 per message
- SMS messages: Varies by gateway and volume
- Check current rates in your Kudi SMS dashboard
- Monitor `kudisms_message_logs` for cost tracking

## Security Best Practices

1. **Never expose your API token** in client-side code
2. Store API tokens securely in database (encrypted)
3. Use Row Level Security (RLS) on settings tables
4. Restrict access to messaging settings to Admin/Accountant roles only
5. Monitor message logs for unusual activity

## Migration from Termii

If migrating from Termii:
1. Configure Kudi SMS settings
2. Update WhatsApp templates to match Kudi SMS format
3. Test thoroughly before going live
4. Old Termii tables remain for reference but are no longer used
5. Can be dropped after verification: `DROP TABLE termii_settings, whatsapp_message_logs`

## Support

For Kudi SMS API issues:
- Email: support@kudisms.net
- Dashboard: https://my.kudisms.net

For School Guardian 360 integration issues:
- Check the error logs in `kudisms_message_logs`
- Review error codes in the response
- Consult this documentation

## Additional Resources

- [Kudi SMS API Documentation](https://my.kudisms.net/api-docs)
- [WhatsApp Business Template Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates)
- School Guardian 360 Messaging Services: `src/services/kudiSmsService.ts`
