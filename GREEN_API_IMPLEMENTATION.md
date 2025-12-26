# Green-API WhatsApp Integration

## Overview

This implementation integrates Green-API as the primary WhatsApp messaging provider for the YEBO school management system. Green-API offers fixed monthly pricing ($12/month) instead of per-message costs, making it more cost-effective for WhatsApp messaging. SMS messaging continues to use KudiSMS at ₦5.95/message.

## Architecture

```
NotificationService
├── SMS → KudiSMS (₦5.95/msg)
│   └── Unchanged, continues to work as before
└── WhatsApp → Green-API ($12/month) [NEW]
    ├── Intelligent routing checks for Green-API configuration
    ├── Falls back to KudiSMS WhatsApp if not configured
    └── Supports 6 Green-API methods:
        ├── 1. sendMessage (text notifications)
        ├── 2. sendFileByUrl (send files from URLs)
        ├── 3. sendFileByUpload (direct file upload)
        ├── 4. uploadFile (pre-upload for bulk sending, valid 15 days)
        ├── 5. forwardMessages (forward to multiple chats)
        └── 6. sendInteractiveButtons (action buttons - Beta)
```

## Files Created

### 1. Database Migration
**File**: `supabase/migrations/20251226_greenapi_settings.sql`

Creates the `greenapi_settings` table with:
- Per school/campus configuration support
- Instance ID and API Token storage
- Configurable API and Media URLs
- Active/inactive toggle
- Partial unique index to allow multiple inactive records

### 2. TypeScript Types
**File**: `src/types.ts` (additions)

Added interfaces for:
- `GreenApiSettings` - Configuration storage
- `GreenApiSendMessageParams` - Text message parameters
- `GreenApiSendFileParams` - File URL parameters
- `GreenApiInteractiveButton` - Button definitions
- `GreenApiSendButtonsParams` - Interactive button messages
- `GreenApiForwardParams` - Message forwarding
- `GreenApiResponse` - API responses
- `GreenApiUploadResponse` - Upload responses

### 3. Green-API Service
**File**: `src/services/greenApiService.ts`

Core service with:
- Phone number formatting: `234XXXXXXXXXX` → `234XXXXXXXXXX@c.us`
- All 6 Green-API methods implemented
- Retry logic with exponential backoff (capped at 3 seconds)
- Error handling and logging
- Test connection functionality

### 4. Supabase Edge Functions

#### greenapi-send
**File**: `supabase/functions/greenapi-send/index.ts`

Handles:
- Text message sending (`sendMessage`)
- File URL sending (`sendFileByUrl`)
- CORS support
- Database logging
- Error handling

#### greenapi-upload
**File**: `supabase/functions/greenapi-upload/index.ts`

Handles:
- File uploads with size validation (50MB limit)
- Two modes:
  - Upload-only: Returns URL valid for 15 days
  - Upload-and-send: Immediately sends to recipient
- Base64 file data processing
- Database logging

### 5. Updated Services

#### kudiSmsService.ts
Updated `sendWhatsAppMessage()` to:
- Check for Green-API configuration first
- Use Green-API if configured
- Fall back to KudiSMS WhatsApp if not configured

#### smsService.ts
Updated `sendViaChannel()` to:
- Use options object pattern for cleaner API
- Route WhatsApp through Green-API when configured
- Maintain KudiSMS for SMS messages
- Pass campus_id through the chain

### 6. Settings UI Component
**File**: `src/components/GreenApiSettings.tsx`

React component with:
- Instance ID and API Token configuration
- API URL and Media URL settings (with defaults)
- Active/inactive toggle
- Test connection functionality
- Toast notifications for feedback
- Form validation

## Configuration

### Step 1: Get Green-API Credentials

1. Sign up at https://green-api.com
2. Create a WhatsApp instance
3. Note your `Instance ID` (e.g., `1101234567`)
4. Note your `API Token`

### Step 2: Configure in YEBO

1. Navigate to Settings → Green-API Settings (or integrate into existing settings)
2. Enter your Instance ID
3. Enter your API Token
4. (Optional) Customize API URLs if needed
5. Enable with the Active toggle
6. Click "Save Settings"

### Step 3: Test Connection

1. Enter a test phone number
2. Click "Send Test Message"
3. Verify the test message is received on WhatsApp

## Usage Examples

### Sending Text Messages

```typescript
import { sendWhatsAppMessage } from './services/greenApiService';

// Simple text message
const result = await sendWhatsAppMessage({
  schoolId: 123,
  recipientPhone: '08012345678',
  message: 'Hello from YEBO!',
  campusId: 1
});

if (result.success) {
  console.log('Message sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

### Sending Files from URL

```typescript
import { sendFileByUrl } from './services/greenApiService';

const response = await sendFileByUrl(
  schoolId,
  {
    chatId: '2348012345678@c.us',
    urlFile: 'https://example.com/report.pdf',
    fileName: 'report-card.pdf',
    caption: 'Your child\'s report card for Term 1'
  },
  campusId
);
```

### Uploading File for Bulk Sending

```typescript
import { uploadFile, sendFileByUrl } from './services/greenApiService';

// Step 1: Upload once
const uploadResult = await uploadFile(schoolId, fileBlob, 'report.pdf', 'application/pdf', campusId);
const fileUrl = uploadResult.urlFile; // Valid for 15 days

// Step 2: Send to multiple recipients
const parents = ['08012345678', '08023456789', '08034567890'];

for (const phone of parents) {
  const chatId = formatWhatsAppChatId(phone);
  await sendFileByUrl(schoolId, {
    chatId,
    urlFile: fileUrl,
    fileName: 'report.pdf',
    caption: 'Report card for your child'
  }, campusId);
}
```

### Sending Interactive Buttons

```typescript
import { sendInteractiveButtons } from './services/greenApiService';

await sendInteractiveButtons(
  schoolId,
  {
    chatId: '2348012345678@c.us',
    body: 'Your child\'s report card is ready!',
    header: '📊 Report Card Available',
    footer: 'UPSS Administration',
    buttons: [
      {
        type: 'url',
        buttonId: 'btn1',
        buttonText: 'View Report',
        url: 'https://yebo.com/reports/12345'
      },
      {
        type: 'call',
        buttonId: 'btn2',
        buttonText: 'Call School',
        phoneNumber: '2348012345678'
      }
    ]
  },
  campusId
);
```

## Phone Number Format

Green-API requires phone numbers in the format: `{countryCode}{number}@c.us`

The `formatWhatsAppChatId()` function automatically handles:
- Removing leading zeros: `08012345678` → `8012345678`
- Adding country code: `8012345678` → `2348012345678`
- Appending chat suffix: `2348012345678` → `2348012345678@c.us`

## Error Handling

All Green-API functions include:
- **Retry Logic**: 2 retries with exponential backoff (1s, 2s, capped at 3s)
- **Error Responses**: Detailed error messages for debugging
- **Logging**: All messages logged to `sms_message_logs` table
- **Fallback**: Automatic fallback to KudiSMS WhatsApp if Green-API fails

## Database Schema

```sql
CREATE TABLE greenapi_settings (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  campus_id INTEGER REFERENCES campuses(id),
  instance_id TEXT NOT NULL,
  api_token TEXT NOT NULL,
  api_url TEXT DEFAULT 'https://api.green-api.com' NOT NULL,
  media_url TEXT DEFAULT 'https://media.green-api.com' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Partial unique index: only one active config per school/campus
CREATE UNIQUE INDEX unique_active_greenapi_per_school_campus 
  ON greenapi_settings(school_id, campus_id) 
  WHERE is_active = true;
```

## Cost Comparison

### Before (KudiSMS Only)
- SMS: ₦5.95 per message
- WhatsApp: Per-message pricing (varies)
- Total: Variable based on usage

### After (Green-API + KudiSMS)
- SMS: ₦5.95 per message (unchanged)
- WhatsApp: $12/month (fixed)
- Total: More predictable, likely cheaper for high WhatsApp usage

## Migration Notes

- **Zero Downtime**: New code automatically falls back to KudiSMS if Green-API not configured
- **Gradual Rollout**: Configure Green-API per school/campus as needed
- **No Breaking Changes**: Existing SMS functionality unchanged
- **Database Migration**: Run `20251226_greenapi_settings.sql` to add the table

## Security Features

- ✅ RLS policies restrict access to school's own settings
- ✅ API tokens stored securely in database
- ✅ Edge functions use service role for secure API calls
- ✅ File upload size validation (50MB limit)
- ✅ Phone number validation before sending
- ✅ CodeQL security scan passed (0 alerts)

## Troubleshooting

### Test Message Not Received

1. Verify Instance ID and API Token are correct
2. Check that WhatsApp instance is active in Green-API console
3. Verify phone number format (should be Nigerian: 234XXXXXXXXXX)
4. Check `sms_message_logs` table for error details

### Messages Going to KudiSMS Instead of Green-API

1. Verify `is_active = true` in `greenapi_settings` table
2. Check that school_id matches your school
3. Ensure campus_id matches if using campus-specific config

### Upload Fails

1. Check file size (max 50MB)
2. Verify base64 encoding is correct
3. Check network connectivity to Green-API media server

## Future Enhancements

Potential additions:
- Message templates management in UI
- Bulk sending interface with progress tracking
- WhatsApp message history viewer
- Analytics dashboard for message delivery rates
- Webhook support for message status updates
- Multi-language support for templates

## Support

For issues or questions:
1. Check the `sms_message_logs` table for detailed error messages
2. Review Green-API documentation: https://green-api.com/docs
3. Contact Green-API support for API-related issues
4. File issues in the YEBO GitHub repository

## References

- [Green-API Documentation](https://green-api.com/docs)
- [Green-API Pricing](https://green-api.com/pricing)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
