# Termii WhatsApp Integration - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        School Guardian 360 System                         │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
                ▼                    ▼                    ▼
        ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
        │   Frontend    │   │  Paystack     │   │   Supabase    │
        │  Application  │   │   Webhook     │   │   Database    │
        └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
                │                   │                   │
                │                   │                   │
                └───────────────────┴───────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
                    ▼                                ▼
        ┌─────────────────────────┐    ┌─────────────────────────┐
        │  termii-send-whatsapp   │    │   termii-webhook        │
        │  Supabase Edge Function │    │  Supabase Edge Function │
        └────────────┬────────────┘    └────────────┬────────────┘
                     │                              │
                     │         ┌────────────────────┘
                     │         │
                     └─────────┴──────────┐
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │   Termii API        │
                              │   WhatsApp Service  │
                              └──────────┬──────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        │                │                │
                        ▼                ▼                ▼
                ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                │  Template    │  │  Template    │  │ Conversational│
                │  Message     │  │  + Media     │  │   Message    │
                └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                       │                 │                 │
                       └─────────────────┴─────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │  Parent's WhatsApp  │
                              └─────────────────────┘
```

## Flow Diagrams

### 1. Payment Receipt Flow (Automatic)

```
Paystack Payment          Paystack Webhook         Edge Function          Termii API           Parent
     │                         │                         │                     │                  │
     │ Payment Received        │                         │                     │                  │
     ├────────────────────────>│                         │                     │                  │
     │                         │ Verify Signature        │                     │                  │
     │                         │ & Process Payment       │                     │                  │
     │                         ├────────────┐            │                     │                  │
     │                         │            │            │                     │                  │
     │                         │<───────────┘            │                     │                  │
     │                         │ Send WhatsApp Receipt   │                     │                  │
     │                         ├────────────────────────>│                     │                  │
     │                         │                         │ Get Student/Parent  │                  │
     │                         │                         │ Info from DB        │                  │
     │                         │                         ├──────────┐          │                  │
     │                         │                         │          │          │                  │
     │                         │                         │<─────────┘          │                  │
     │                         │                         │ Send Message        │                  │
     │                         │                         ├────────────────────>│                  │
     │                         │                         │                     │ Send WhatsApp    │
     │                         │                         │                     ├─────────────────>│
     │                         │                         │                     │                  │
     │                         │                         │ Log to DB           │                  │
     │                         │                         ├──────────┐          │                  │
     │                         │                         │          │          │                  │
     │                         │                         │<─────────┘          │                  │
     │                         │<────────────────────────┤                     │                  │
     │<────────────────────────┤                         │                     │                  │
```

### 2. Manual Message Flow

```
Frontend App         Edge Function        Termii API         Parent
     │                    │                    │               │
     │ Send Message       │                    │               │
     ├───────────────────>│                    │               │
     │                    │ Validate Input     │               │
     │                    ├─────────┐          │               │
     │                    │         │          │               │
     │                    │<────────┘          │               │
     │                    │ Call Termii API    │               │
     │                    ├───────────────────>│               │
     │                    │                    │ Send WhatsApp │
     │                    │                    ├──────────────>│
     │                    │                    │               │
     │                    │<───────────────────┤               │
     │                    │ Log to DB          │               │
     │                    ├─────────┐          │               │
     │                    │         │          │               │
     │                    │<────────┘          │               │
     │<───────────────────┤                    │               │
```

### 3. Webhook Status Update Flow

```
Termii API         Webhook Handler      Database         
     │                    │                 │            
     │ Status Update      │                 │            
     ├───────────────────>│                 │            
     │                    │ Parse Event     │            
     │                    ├────────┐        │            
     │                    │        │        │            
     │                    │<───────┘        │            
     │                    │ Update Status   │            
     │                    ├────────────────>│            
     │                    │                 │            
     │                    │<────────────────┤            
     │<───────────────────┤                 │            
```

## Database Schema Relationships

```
┌──────────────────┐
│    schools       │
│  id, name, ...   │
└────────┬─────────┘
         │
         │ (1:1)
         │
┌────────▼─────────────────┐
│   termii_settings        │
│  id, school_id,          │
│  api_key, device_id      │
└────────┬─────────────────┘
         │
         │ (1:N)
         │
┌────────▼──────────────────────┐
│  whatsapp_message_logs        │
│  id, school_id,               │
│  recipient_phone,             │
│  message_type, status, ...    │
└───────────────────────────────┘

┌──────────────────┐
│   students       │
│  id, name,       │
│  parent_phone_1  │
└────────┬─────────┘
         │
         │ (1:N)
         │
┌────────▼──────────────────┐
│  student_invoices         │
│  id, student_id,          │
│  total_amount, status     │
└────────┬──────────────────┘
         │
         │ (1:N)
         │
┌────────▼──────────────────┐
│  payments                 │
│  id, invoice_id,          │
│  amount, reference        │
└───────────────────────────┘
```

## Message Types

### Template Message (Approved by WhatsApp)
```
┌─────────────────────────────────┐
│  Template: payment_receipt      │
│  ─────────────────────────────  │
│  Dear Parent,                   │
│                                 │
│  Payment Receipt                │
│                                 │
│  Student: {{1}}                 │
│  Amount: ₦{{2}}                 │
│  Reference: {{3}}               │
│  ...                            │
└─────────────────────────────────┘
        ▲
        │ Variables passed in `data` object
        │ {"1": "John Doe", "2": "5000.00", ...}
```

### Template with Media
```
┌─────────────────────────────────┐
│  Template: report_card_ready    │
│  ─────────────────────────────  │
│  [PDF ICON] Report Card.pdf     │
│                                 │
│  Your child's report is ready   │
│  Student: {{1}}                 │
│  Term: {{2}}                    │
│  ...                            │
└─────────────────────────────────┘
        ▲
        │ Media URL and variables
        │ {media: {url: "...", caption: "..."}, data: {...}}
```

### Conversational Message
```
┌─────────────────────────────────┐
│  Free-form message              │
│  ─────────────────────────────  │
│  URGENT: School will close      │
│  early today at 12 PM due to    │
│  unforeseen circumstances.      │
│  Please arrange pickup.         │
└─────────────────────────────────┘
        ▲
        │ Plain text message
        │ {message: "URGENT: School will..."}
```

## API Endpoints

### Edge Functions
```
POST /functions/v1/termii-send-whatsapp
  - Send WhatsApp message
  - Requires: Authorization header
  - Body: {phone_number, template_id, data, message_type, ...}
  - Returns: {success, message_id, balance}

POST /functions/v1/termii-webhook
  - Handle Termii delivery status
  - Body: {message_id, status, phone_number}
  - Returns: {success, updated_status}

GET /functions/v1/termii-balance
  - Check Termii account balance
  - Requires: Authorization header
  - Returns: {success, balance, currency, user}
```

### Paystack Webhook
```
POST /functions/v1/paystack-webhook
  - Handle Paystack payment events
  - Headers: x-paystack-signature
  - Body: {event, data: {...}}
  - Processes: dedicatedaccount.credit, charge.success
  - Automatically triggers WhatsApp receipt
```

## Environment Configuration

```
┌─────────────────────────────────────┐
│  Supabase Project Settings          │
│  ─────────────────────────────────  │
│  Edge Functions > Secrets            │
│                                     │
│  TERMII_API_KEY = sk_xxx...         │
│  TERMII_DEVICE_ID = dev_xxx...      │
│  TERMII_BASE_URL = https://...      │
│                                     │
│  SUPABASE_URL = https://...         │
│  SUPABASE_SERVICE_ROLE_KEY = ...    │
└─────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────┐
│  1. API Key Authentication                  │
│     - Termii API key in env variables       │
│     - Supabase anon key for client calls    │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│  2. Row Level Security (RLS)                │
│     - termii_settings: Admin/Accountant     │
│     - whatsapp_message_logs: View only      │
│     - Service role bypasses for webhooks    │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│  3. Input Validation                        │
│     - Phone number format validation        │
│     - Required field checks                 │
│     - Template variable validation          │
└─────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────┐
│  4. Webhook Signature Verification          │
│     - Paystack webhook: HMAC SHA512         │
│     - Termii webhook: Message ID matching   │
└─────────────────────────────────────────────┘
```

## Use Case Examples

### Use Case 1: Fee Reminder
```javascript
// Admin sends fee reminder to parent
await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '2348012345678',
    template_id: 'fee_reminder',
    message_type: 'template',
    data: {
      '1': 'John Doe',        // Student name
      '2': 'JSS 2A',          // Class
      '3': '50,000.00',       // Amount due
      '4': '15th Dec 2025'    // Due date
    }
  }
});
```

### Use Case 2: Emergency Broadcast
```javascript
// Send urgent message to all parents
const students = await getAllStudents();
for (const student of students) {
  await supabase.functions.invoke('termii-send-whatsapp', {
    body: {
      phone_number: student.parent_phone_number_1,
      message_type: 'conversational',
      message: 'URGENT: School closing early at 12 PM. Please arrange pickup.'
    }
  });
}
```

### Use Case 3: Report Card with PDF
```javascript
// Send report card with PDF attachment
await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '2348012345678',
    template_id: 'report_card_ready',
    message_type: 'template_media',
    data: {
      '1': 'John Doe',
      '2': 'Term 1',
      '3': '2024/2025'
    },
    media: {
      url: 'https://your-cdn.com/reports/john_doe_term1.pdf',
      caption: 'John Doe - Term 1 Report Card'
    }
  }
});
```

## Monitoring Queries

```sql
-- Daily message statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(COUNT(CASE WHEN status = 'delivered' THEN 1 END) * 100.0 / COUNT(*), 2) as delivery_rate
FROM whatsapp_message_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Cost analysis
SELECT 
  school_id,
  COUNT(*) as messages_sent,
  COUNT(*) * 20 as estimated_cost_ngn
FROM whatsapp_message_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY school_id
ORDER BY messages_sent DESC;

-- Failed messages for retry
SELECT 
  id,
  recipient_phone,
  message_type,
  error_message,
  created_at
FROM whatsapp_message_logs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

**Last Updated**: December 9, 2025
**Version**: 1.0
