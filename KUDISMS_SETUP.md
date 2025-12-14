# Kudi SMS Setup Guide

This guide explains how to configure and use Kudi SMS API for SMS messaging in School Guardian 360.

## Overview

School Guardian 360 uses Kudi SMS API to send SMS notifications to parents and guardians. This includes:
- Payment receipts
- Homework reminders
- Missing homework notifications
- Lesson plan notifications
- General announcements

## Prerequisites

1. **Kudi SMS Account**: Sign up at [https://my.kudisms.net](https://my.kudisms.net)
2. **API Token**: Obtain your API token from the Kudi SMS dashboard
3. **Sender ID**: Create and get approval for a Sender ID (e.g., "SchoolName")
4. **Credit Balance**: Ensure you have sufficient credit balance for sending messages

## Configuration

### 1. Environment Variables

Set the following environment variables in your Supabase Edge Functions configuration:

```bash
KUDI_SMS_TOKEN=your_api_token_here
KUDI_SENDER_ID=YourSenderID
KUDI_SMS_BASE_URL=https://my.kudisms.net/api  # Optional, default value
```

### 2. Database Setup

Run the migration to create the necessary tables:

```bash
supabase migration up
```

This creates:
- `kudisms_settings` - Stores Kudi SMS credentials per school/campus
- `sms_message_logs` - Logs all sent messages
- `sms_templates` - Reusable message templates
- `sms_notifications` - Tracks notifications sent to parents

### 3. School Configuration

1. Log in to School Guardian 360 as an Admin
2. Navigate to **Settings** → **Messaging Gateway**
3. Click **Add New Kudi SMS Settings**
4. Fill in the form:
   - **Campus**: Select a campus or "All Campuses (Default)"
   - **API Token**: Your Kudi SMS API token
   - **Sender ID**: Your approved Sender ID
   - **Enable this configuration**: Check to activate
5. Click **Save**

## API Reference

### Endpoints

#### Send Personalised SMS
```
POST https://my.kudisms.net/api/personalisedsms
```

**Request Body:**
```json
{
  "token": "your_api_token",
  "senderID": "YourSenderID",
  "message": "Hello {{name}}, this is a test message.",
  "csvHeaders": ["phone_number", "name"],
  "recipients": [
    {
      "phone_number": "234XXXXXXXXXX",
      "name": "John Doe"
    }
  ]
}
```

#### Send Auto-Compose SMS
```
POST https://my.kudisms.net/api/autocomposesms
```

**Request Body:**
```json
{
  "token": "your_api_token",
  "senderID": "YourSenderID",
  "message": "This is a bulk message to all recipients",
  "recipients": "234XXXXXXXXXX,234YYYYYYYYYY"
}
```

### Response Codes

| Code | Description |
|------|-------------|
| 000  | Message Sent Successfully |
| 009  | Maximum of 6 pages of SMS exceeded |
| 401  | Request could not be completed |
| 100  | Token provided is invalid |
| 101  | Account has been deactivated |
| 103  | Gateway selected doesn't exist |
| 104  | Blocked message keyword(s) |
| 105  | Sender ID has been blocked |
| 106  | Sender ID does not exist |
| 107  | Invalid phone number |
| 108  | Total recipients more than batch size of 100 |
| 109  | Insufficient credit balance |
| 111  | Only approved promotional Sender ID allowed |
| 114  | No package attached to this service |
| 185  | No route attached to this package |
| 187  | Request could not be processed |
| 188  | Sender ID is unapproved |
| 300  | Missing parameters |

## Usage in Code

### Send Single SMS

```typescript
import { sendSingleSms } from '../services/kudiSmsService';

const result = await sendSingleSms(
  token,
  senderID,
  '2348012345678',
  'Hello, this is a test message',
  'John Doe'  // Optional recipient name
);

if (result.error_code === '000') {
  console.log('SMS sent successfully');
} else {
  console.error('Failed to send SMS:', result.msg);
}
```

### Send Bulk SMS

```typescript
import { sendBulkSms } from '../services/kudiSmsService';

const phoneNumbers = [
  '2348012345678',
  '2348087654321',
  '2347012345678'
];

const result = await sendBulkSms(
  token,
  senderID,
  phoneNumbers,
  'Hello parents, this is a bulk notification'
);
```

### Send Notification Using Template

```typescript
import { sendSmsNotification } from '../services/smsService';

const success = await sendSmsNotification({
  schoolId: 1,
  studentId: 123,
  recipientPhone: '2348012345678',
  templateName: 'homework_reminder',
  variables: {
    student_name: 'John Doe',
    subject: 'Mathematics',
    homework_title: 'Algebra Exercise',
    due_date: '2024-12-20'
  },
  referenceId: 456,
  notificationType: 'homework_reminder',
  sentBy: 'user-id-here'
});
```

## Important Limitations

1. **Batch Size**: Maximum 100 recipients per batch
2. **Message Length**: Maximum 6 pages of SMS per message
   - 1 page = 160 characters (GSM-7 encoding)
   - 1 page = 70 characters (Unicode encoding)
3. **Phone Format**: Must be in format `234XXXXXXXXXX` (Nigerian format)
4. **Sender ID**: Must be approved by Kudi SMS before use

## Phone Number Formatting

The system automatically formats phone numbers to Nigerian format:
- Removes non-digit characters
- Removes leading zero
- Adds `234` country code if not present

Examples:
- `08012345678` → `2348012345678`
- `+234 801 234 5678` → `2348012345678`
- `234 801 234 5678` → `2348012345678`

## Message Templates

Create reusable message templates in the database:

```sql
INSERT INTO sms_templates (school_id, template_name, message_content, variables, is_active)
VALUES (
  1,
  'payment_receipt',
  'Dear Parent,\n\nPayment Receipt\nStudent: {{student_name}}\nAmount: ₦{{amount}}\nReference: {{reference}}\n\nThank you.',
  ARRAY['student_name', 'amount', 'reference'],
  true
);
```

## Troubleshooting

### Common Issues

**Issue**: "Token provided is invalid" (Code 100)
- **Solution**: Verify your API token in the Kudi SMS dashboard

**Issue**: "Sender ID is unapproved" (Code 188)
- **Solution**: Wait for Kudi SMS to approve your Sender ID or use an approved one

**Issue**: "Insufficient credit balance" (Code 109)
- **Solution**: Top up your Kudi SMS account

**Issue**: "Total recipients more than batch size of 100" (Code 108)
- **Solution**: Split your recipients into batches of 100 or less

### Checking Logs

View SMS logs in the database:

```sql
SELECT * FROM sms_message_logs
WHERE school_id = 1
ORDER BY created_at DESC
LIMIT 50;
```

### Testing

Test the configuration by sending a test message:

1. Navigate to **Settings** → **Messaging Gateway**
2. Verify your configuration is active
3. Send a test notification to your own phone number
4. Check the `sms_message_logs` table for the result

## Best Practices

1. **Use Templates**: Create reusable templates for common notifications
2. **Batch Processing**: Send bulk messages in batches of 50-100 to avoid rate limiting
3. **Error Handling**: Always check response codes and log errors
4. **Phone Validation**: Validate phone numbers before sending
5. **Message Length**: Keep messages concise to minimize pages (and cost)
6. **Sender ID**: Use a recognizable Sender ID for your school
7. **Credit Monitoring**: Regularly check your Kudi SMS credit balance

## Cost Estimation

- 1 page SMS = 1 credit (approximately ₦2-5 depending on your package)
- Messages are charged per page, not per recipient
- Unicode characters (emojis, special characters) reduce page length to 70 characters

Example:
- 160-character message to 100 recipients = 100 credits
- 320-character message to 100 recipients = 200 credits (2 pages × 100)

## Support

For Kudi SMS API issues:
- Email: support@kudisms.net
- Website: https://my.kudisms.net
- Documentation: Contact Kudi SMS support

For School Guardian 360 integration issues:
- Check the `sms_message_logs` table for error details
- Review Edge Function logs in Supabase dashboard
- Contact your system administrator
