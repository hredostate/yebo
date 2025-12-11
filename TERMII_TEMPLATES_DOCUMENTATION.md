# Termii WhatsApp Templates Documentation

This document outlines the required WhatsApp message templates that need to be created in the Termii dashboard for the School Guardian 360 application.

## Overview

WhatsApp Business API requires pre-approved message templates for certain types of notifications. These templates must be created in the Termii dashboard and approved by WhatsApp before they can be used.

## Required Templates

### 1. Payment Receipt Template ✅
**Template ID:** `payment_receipt`  
**Status:** Already documented in TERMII_WHATSAPP_SETUP.md  
**Purpose:** Automatic payment confirmation receipts  
**Type:** Template  
**Category:** TRANSACTIONAL  

**Template Structure:**
```
Dear Parent,

Payment Receipt Confirmation

Student: {{1}}
Amount Paid: ₦{{2}}
Payment Method: {{3}}
Reference: {{4}}
Date: {{5}}
Total Paid: ₦{{6}}
Remaining Balance: ₦{{7}}

Thank you for your payment.

School Guardian 360
```

**Variables:**
1. Student Name (e.g., "John Doe")
2. Amount Paid (e.g., "50000.00")
3. Payment Method (e.g., "Bank Transfer")
4. Payment Reference (e.g., "PAY-2024-001234")
5. Payment Date (e.g., "December 11, 2024")
6. Total Amount Paid (e.g., "150000.00")
7. Remaining Balance (e.g., "50000.00")

---

### 2. Fee Reminder Template
**Template ID:** `fee_reminder`  
**Status:** 🟡 Needs to be created  
**Purpose:** Remind parents about outstanding fee payments  
**Type:** Template  
**Category:** UTILITY  

**Template Structure:**
```
💰 Fee Payment Reminder

Dear Parent,

This is a reminder that there is an outstanding balance for {{1}}.

Amount Due: ₦{{2}}
Due Date: {{3}}

Please make payment at your earliest convenience to avoid any disruption to your child's education.

Payment Methods:
• Bank Transfer
• Online Portal
• School Finance Office

For questions, contact the finance office.

Best regards,
School Finance Office
```

**Variables:**
1. Student Name (e.g., "John Doe")
2. Amount Due (e.g., "75000.00")
3. Due Date (e.g., "December 25, 2024")

**Example Usage:**
```typescript
await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '234XXXXXXXXXX',
    template_id: 'fee_reminder',
    message_type: 'template',
    data: {
      '1': 'John Doe',
      '2': '75000.00',
      '3': 'December 25, 2024'
    }
  }
});
```

---

### 3. Attendance Alert Template
**Template ID:** `attendance_alert`  
**Status:** 🟡 Needs to be created  
**Purpose:** Notify parents about student check-in/check-out  
**Type:** Template  
**Category:** UTILITY  

**Template Structure:**
```
📍 Attendance Notification

Dear Parent,

{{1}} has {{2}} school.

Time: {{3}}
Date: {{4}}
Location: {{5}}

If you have any concerns, please contact the school immediately.

School Guardian 360
```

**Variables:**
1. Student Name (e.g., "John Doe")
2. Action (e.g., "checked into" or "checked out of")
3. Time (e.g., "07:45 AM")
4. Date (e.g., "December 11, 2024")
5. Location (e.g., "Main Gate")

**Example Usage:**
```typescript
await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '234XXXXXXXXXX',
    template_id: 'attendance_alert',
    message_type: 'template',
    data: {
      '1': 'John Doe',
      '2': 'checked into',
      '3': '07:45 AM',
      '4': 'December 11, 2024',
      '5': 'Main Gate'
    }
  }
});
```

---

### 4. Report Card Ready Template
**Template ID:** `report_card_ready`  
**Status:** 🟡 Needs to be created  
**Purpose:** Notify parents that report cards are available  
**Type:** Template or Template Media (with PDF)  
**Category:** UTILITY  

**Template Structure (Text Only):**
```
📚 Report Card Available

Dear Parent,

The report card for {{1}} is now available for {{2}}.

Please log in to the School Guardian 360 portal to view and download the full report card.

Term: {{3}}
Session: {{4}}

For questions, please contact the school.

Best regards,
School Administration
```

**Variables:**
1. Student Name (e.g., "John Doe")
2. Term Name (e.g., "First Term")
3. Term (e.g., "First Term")
4. Session (e.g., "2024/2025")

**Template Structure (With PDF - Template Media):**
```
📚 Report Card Available

Dear Parent,

The report card for {{1}} is now ready.

View the attached PDF or log in to the portal for the full interactive report.

Term: {{2}}
Session: {{3}}

Best regards,
School Administration
```

**Variables:**
1. Student Name (e.g., "John Doe")
2. Term (e.g., "First Term")
3. Session (e.g., "2024/2025")

**Example Usage (With PDF):**
```typescript
await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '234XXXXXXXXXX',
    template_id: 'report_card_ready',
    message_type: 'template_media',
    data: {
      '1': 'John Doe',
      '2': 'First Term',
      '3': '2024/2025'
    },
    media: {
      url: 'https://example.com/reports/student-123-term-1.pdf',
      caption: 'Report Card - First Term 2024/2025'
    }
  }
});
```

---

### 5. Emergency Broadcast Template
**Template ID:** `emergency_broadcast`  
**Status:** 🟡 Needs to be created  
**Purpose:** Send urgent school-wide alerts to parents  
**Type:** Template  
**Category:** UTILITY  

**Template Structure:**
```
🚨 URGENT SCHOOL ALERT 🚨

{{1}}

{{2}}

This is an official emergency broadcast from the school. Please acknowledge receipt.

School Administration
```

**Variables:**
1. Alert Title (e.g., "School Lockdown Notice")
2. Alert Message (e.g., "The school is now under lockdown. Please follow all safety protocols immediately.")

**Example Usage:**
```typescript
await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '234XXXXXXXXXX',
    template_id: 'emergency_broadcast',
    message_type: 'template',
    data: {
      '1': 'School Lockdown Notice',
      '2': 'The school is now under lockdown. Please follow all safety protocols immediately.'
    }
  }
});
```

**Note:** For emergency broadcasts, the current implementation uses conversational messages which don't require template approval but may have limitations. Consider creating this template for better deliverability.

---

### 6. Transport Delay Template (Optional)
**Template ID:** `transport_delay`  
**Status:** 🔵 Optional - Create as needed  
**Purpose:** Notify parents about bus delays or route changes  
**Type:** Template  
**Category:** UTILITY  

**Template Structure:**
```
🚌 Transport Update

Dear Parent,

Bus Route: {{1}}
Status: {{2}}
Expected Arrival: {{3}}

Message: {{4}}

For urgent concerns, contact the transport coordinator.

School Transport Office
```

**Variables:**
1. Route Name/Number (e.g., "Route A - Ikeja")
2. Status (e.g., "Delayed" or "Route Changed")
3. Expected Time (e.g., "3:30 PM")
4. Additional Details (e.g., "Heavy traffic on Lekki road. Estimated delay: 20 minutes")

---

## Template Creation Guide

### Step 1: Access Termii Dashboard
1. Log in to [Termii Dashboard](https://accounts.termii.com/login)
2. Navigate to **WhatsApp** → **Message Templates**
3. Click **Create Template**

### Step 2: Fill Template Details
- **Template Name:** Use the Template ID from above (e.g., `fee_reminder`)
- **Category:** Select appropriate category (TRANSACTIONAL, UTILITY, MARKETING)
- **Language:** English (US) or your preferred language
- **Header:** Optional (can add image/document)
- **Body:** Copy the template structure from above
- **Footer:** Optional
- **Buttons:** Optional (e.g., Quick Reply buttons)

### Step 3: Submit for Approval
1. Review template carefully
2. Click **Submit for Approval**
3. Wait for WhatsApp approval (typically 24-48 hours)
4. Once approved, note the Template ID

### Step 4: Update Code
After approval, update the code to use the template ID:
```typescript
const TERMII_TEMPLATES = {
  PAYMENT_RECEIPT: 'payment_receipt',
  FEE_REMINDER: 'fee_reminder',
  ATTENDANCE_ALERT: 'attendance_alert',
  REPORT_CARD_READY: 'report_card_ready',
  EMERGENCY_BROADCAST: 'emergency_broadcast',
};
```

---

## Best Practices

### Template Variables
- Always use numbered placeholders: `{{1}}`, `{{2}}`, etc.
- Keep variable names descriptive in your documentation
- Validate data before sending to ensure proper formatting

### Template Content
- Keep messages concise and clear
- Use appropriate emojis sparingly (2-3 per message)
- Include call-to-action when appropriate
- Always include sender identification

### Approval Tips
- Avoid spam-like language
- Don't use ALL CAPS excessively
- Include clear value for the recipient
- Follow WhatsApp's content policies

### Testing
1. Test templates with real phone numbers before mass deployment
2. Verify all variables are correctly replaced
3. Check message formatting on mobile devices
4. Ensure links (if any) are working

---

## Current Implementation Status

### ✅ Implemented (Using Conversational Messages)
The following features are currently working using conversational messages (no template required):

1. **Emergency Broadcast** - EmergencyBroadcast.tsx
2. **Report Card Notifications** - StudentReportView.tsx
3. **Fee Reminders** - FeeReminderBulkSend.tsx
4. **General SMS (migrated to WhatsApp)** - send-sms edge function

### 🔄 Recommended Migration to Templates
For better deliverability and compliance, migrate these to use templates:

1. **Fee Reminders** → Use `fee_reminder` template
2. **Emergency Broadcasts** → Use `emergency_broadcast` template
3. **Report Cards** → Use `report_card_ready` template

### 📋 Migration Steps
1. Create templates in Termii dashboard
2. Wait for WhatsApp approval
3. Update code to use `message_type: 'template'` instead of `conversational`
4. Pass template_id and data object
5. Test thoroughly

---

## Code Examples

### Sending with Template
```typescript
const { error } = await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '234XXXXXXXXXX',
    template_id: 'fee_reminder',
    message_type: 'template',
    data: {
      '1': 'John Doe',
      '2': '75000.00',
      '3': 'December 25, 2024'
    }
  }
});
```

### Sending with Template + Media
```typescript
const { error } = await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '234XXXXXXXXXX',
    template_id: 'report_card_ready',
    message_type: 'template_media',
    data: {
      '1': 'John Doe',
      '2': 'First Term',
      '3': '2024/2025'
    },
    media: {
      url: 'https://cdn.example.com/reports/student-123.pdf',
      caption: 'Student Report Card'
    }
  }
});
```

### Sending Conversational (Current Implementation)
```typescript
const { error } = await supabase.functions.invoke('termii-send-whatsapp', {
  body: {
    phone_number: '234XXXXXXXXXX',
    message_type: 'conversational',
    message: 'Your custom message here'
  }
});
```

---

## Monitoring and Logs

All WhatsApp messages are logged in the `whatsapp_message_logs` table:

```sql
SELECT 
  recipient_phone,
  template_id,
  message_type,
  status,
  error_message,
  created_at
FROM whatsapp_message_logs
ORDER BY created_at DESC
LIMIT 100;
```

### Check Delivery Status
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM whatsapp_message_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## Support

For template creation issues:
- **Termii Support:** support@termii.com
- **Termii Documentation:** https://developers.termii.com
- **WhatsApp Business Policies:** https://www.whatsapp.com/legal/business-policy

---

**Document Version:** 1.0  
**Last Updated:** December 11, 2024  
**Maintained By:** School Guardian 360 Development Team
