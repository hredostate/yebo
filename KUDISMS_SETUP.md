# Kudi SMS Integration Setup Guide

This guide will help you set up and configure Kudi SMS for WhatsApp and SMS messaging in School Guardian 360.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Steps](#setup-steps)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Template Codes](#template-codes)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Kudi SMS provides WhatsApp and SMS messaging services for School Guardian 360. The integration supports:

- **WhatsApp Messages**: Template-based messages for payment receipts, fee reminders, report cards, etc.
- **SMS Messages**: Personalized SMS for announcements and notifications
- **Balance Checking**: Monitor your Kudi SMS account balance
- **Test Interface**: Built-in testing panel to verify configurations

### Key Features
- Template-based WhatsApp messaging (Meta-approved templates required)
- Personalized SMS with variable substitution
- Automatic phone number formatting (Nigerian format: 234XXXXXXXXXX)
- Message logging and cost tracking
- Multi-campus support

---

## Prerequisites

1. **Kudi SMS Account**
   - Sign up at [https://my.kudisms.net](https://my.kudisms.net)
   - Fund your account with sufficient balance

2. **API Token**
   - Log in to Kudi SMS Dashboard
   - Navigate to Settings > API
   - Copy your API token

3. **Sender ID (for SMS)**
   - Request a sender ID in the Kudi SMS dashboard
   - Wait for approval (usually 24-48 hours)
   - Sender ID must be max 11 characters

4. **WhatsApp Templates**
   - Create message templates in Kudi SMS dashboard
   - Submit for Meta approval
   - Wait for approval before using
   - Note the template codes (e.g., "25XXXXX")

---

## Setup Steps

### Step 1: Access Kudi SMS Settings

1. Log in to School Guardian 360 as an Admin
2. Navigate to **Settings** > **Kudi SMS Configuration**
3. Click on the **Configuration** tab

### Step 2: Add Configuration

1. Select the campus (or "All Campuses" for school-wide configuration)
2. Enter your **API Token** from Kudi SMS dashboard
3. Enter your approved **Sender ID** (for SMS)
4. Add your **WhatsApp Template Codes**:
   - Click "Add" for each template
   - Enter a descriptive name (e.g., "payment_receipt")
   - Enter the template code from Kudi SMS (e.g., "25XXXXX")
5. Check "Active" to enable the configuration
6. Click **Save Configuration**

### Step 3: Run Database Migration

Run the migration to create the necessary database tables:

```sql
-- Run this in your Supabase SQL editor or migration tool
\i supabase/migrations/20251214_migrate_termii_to_kudisms.sql
```

Or via Supabase CLI:

```bash
supabase db push
```

---

## Configuration

### Campus-Level Configuration

You can configure Kudi SMS settings at two levels:

1. **School-Wide** (campus_id = 0): Applies to all campuses
2. **Campus-Specific**: Overrides school-wide settings for specific campus

**Note**: Campus-specific settings take precedence over school-wide settings.

### Template Codes

Template codes are essential for WhatsApp messaging. Each template must be:

1. **Created** in Kudi SMS dashboard
2. **Approved** by Meta/WhatsApp
3. **Added** to School Guardian 360 configuration

#### Common Template Types

| Template Name | Purpose | Example Parameters |
|--------------|---------|-------------------|
| `payment_receipt` | Payment confirmations | Student name, amount, date, reference |
| `fee_reminder` | Fee payment reminders | Student name, balance, due date |
| `report_card_notification` | Report card availability | Student name, term, session |
| `emergency_broadcast` | Urgent announcements | Title, message |

#### Template Parameters

Parameters are passed as **comma-separated values**:

```
John Doe,5000.00,15 Dec 2024,REF123456
```

Maps to template variables:
```
Hello {{1}}, your payment of ₦{{2}} on {{3}} (Ref: {{4}}) was successful.
```

---

## Testing

### Using the Test Panel

1. Navigate to **Settings** > **Kudi SMS Configuration**
2. Click on the **Test Panel** tab
3. Select message type (WhatsApp or SMS)

#### Test WhatsApp Message

1. Enter recipient phone number (format: 234XXXXXXXXXX)
2. Select or enter template code
3. Enter parameters (comma-separated)
4. Click **Send Test Message**
5. Review the response

#### Test SMS Message

1. Enter recipient phone number
2. Enter sender ID
3. Enter message content
4. Click **Send Test Message**
5. Review the response

#### Check Balance

- Click **Check Balance** button in the test panel
- Current balance will be displayed in the header

### Response Codes

| Code | Meaning |
|------|---------|
| 000 | Message Sent Successfully ✅ |
| 100 | Invalid API token ❌ |
| 107 | Invalid phone number ❌ |
| 109 | Insufficient balance ❌ |
| 188 | Sender ID is unapproved ❌ |
| 300 | Missing parameters ❌ |

See full list in [API Response Codes](#api-response-codes) section.

---

## Template Codes

### Creating Templates in Kudi SMS

1. Log in to Kudi SMS Dashboard
2. Navigate to **WhatsApp** > **Templates**
3. Click **Create Template**
4. Enter template details:
   - **Name**: Descriptive name (e.g., "payment_receipt")
   - **Category**: Select appropriate category
   - **Language**: English
   - **Header** (optional): Text or media
   - **Body**: Message content with placeholders {{1}}, {{2}}, etc.
   - **Footer** (optional): Additional info
   - **Buttons** (optional): Call-to-action buttons
5. Submit for approval
6. Wait for Meta approval (usually 24-48 hours)
7. Once approved, copy the template code
8. Add to School Guardian 360 configuration

### Example Template

**Payment Receipt Template**

```
Category: TRANSACTIONAL
Body:
Dear Parent,

Payment received for *{{1}}*

Amount: ₦{{2}}
Date: {{3}}
Reference: {{4}}
Balance: ₦{{5}}

Thank you for your payment.
```

**Parameters Order**: Student Name, Amount, Date, Reference, Balance

**Usage in School Guardian 360**:
```
Template Name: payment_receipt
Template Code: 25XXXXX (from Kudi SMS)
Parameters: John Doe,5000.00,15 Dec 2024,REF123,2500.00
```

---

## API Response Codes

### Success Codes
- **000**: Message Sent Successfully

### Error Codes
- **009**: Maximum 6 pages of SMS allowed
- **100**: Token provided is invalid
- **101**: Account has been deactivated
- **103**: Gateway selected doesn't exist
- **104**: Blocked message keyword(s)
- **105**: Sender ID has been blocked
- **106**: Sender ID does not exist
- **107**: Invalid phone number
- **108**: Recipients exceed batch size of 100
- **109**: Insufficient credit balance
- **111**: Only approved promotional Sender ID allowed
- **114**: No package attached to this service
- **185**: No route attached to this package
- **187**: Request could not be processed
- **188**: Sender ID is unapproved
- **300**: Missing parameters
- **401**: Request could not be completed

---

## Troubleshooting

### Message Not Sending

**Problem**: WhatsApp message fails to send

**Solutions**:
1. Verify template code is correct
2. Ensure template is approved in Kudi SMS dashboard
3. Check phone number format (must be 234XXXXXXXXXX)
4. Verify sufficient account balance
5. Check parameter count matches template variables

### Invalid Phone Number (Error 107)

**Problem**: Receiving "Invalid phone number" error

**Solutions**:
1. Format: Must be `234XXXXXXXXXX` (Nigerian international format)
2. Remove spaces, dashes, and special characters
3. Don't include `+` symbol
4. Example: `2348012345678` (not `+234 801 234 5678`)

### Sender ID Issues (Error 188)

**Problem**: "Sender ID is unapproved" error

**Solutions**:
1. Verify sender ID is approved in Kudi SMS dashboard
2. Check spelling matches exactly (case-sensitive)
3. Wait for approval if recently requested (24-48 hours)
4. Contact Kudi SMS support if approval is delayed

### Insufficient Balance (Error 109)

**Problem**: "Insufficient credit balance" error

**Solutions**:
1. Check balance using the Test Panel
2. Fund your Kudi SMS account
3. Allow 10-15 minutes for balance to reflect

### Template Not Found

**Problem**: Template code not recognized

**Solutions**:
1. Verify template code in Kudi SMS dashboard
2. Ensure template is approved
3. Check for typos in template code
4. Refresh configuration in School Guardian 360

---

## Phone Number Format

### Correct Format
```
234XXXXXXXXXX
```

Examples:
- `2348012345678` ✅
- `2347012345678` ✅
- `2349012345678` ✅

### Incorrect Formats
- `+2348012345678` ❌ (no + symbol)
- `08012345678` ❌ (missing country code)
- `234 801 234 5678` ❌ (no spaces)
- `234-801-234-5678` ❌ (no dashes)

### Automatic Formatting

School Guardian 360 automatically formats phone numbers:
- Removes all non-numeric characters
- Replaces leading `0` with `234`
- Prepends `234` if missing

---

## Message Costs

WhatsApp and SMS messages have different costs:

### WhatsApp
- **Template Messages**: ~₦3-5 per message
- Cost varies by template complexity
- More cost-effective for international numbers

### SMS
- **Standard SMS**: ~₦2-4 per page
- **Maximum**: 6 pages per message
- Cost increases with message length

### Cost Tracking

All messages are logged with costs in the `whatsapp_message_logs` table:
- View message history
- Track total costs
- Monitor balance usage

---

## Support

For issues with:

### Kudi SMS Platform
- Website: [https://my.kudisms.net](https://my.kudisms.net)
- Email: support@kudisms.net
- Phone: Check Kudi SMS website for contact

### School Guardian 360 Integration
- Check [Troubleshooting](#troubleshooting) section
- Review error codes and solutions
- Use Test Panel to diagnose issues
- Check message logs for detailed error messages

---

## Migration from Termii

If you're migrating from Termii:

1. **Backup** existing Termii settings and templates
2. **Run** the migration SQL script
3. **Configure** Kudi SMS settings
4. **Test** with test panel before production use
5. **Update** template codes in new system
6. **Monitor** first few messages for issues

### What Gets Migrated
- ✅ Message logs (renamed columns)
- ✅ Notification records
- ✅ Database structure

### What Needs Manual Setup
- ❌ API tokens (security reasons)
- ❌ Template codes (different providers)
- ❌ Sender IDs (requires new approval)

---

## Best Practices

1. **Test First**: Always use Test Panel before production
2. **Monitor Balance**: Check balance regularly
3. **Template Approval**: Request template approval in advance
4. **Phone Formatting**: Let system auto-format phone numbers
5. **Error Handling**: Log and review failed messages
6. **Cost Tracking**: Monitor message costs and usage
7. **Fallback**: Have SMS as backup for WhatsApp failures

---

## API Documentation

For advanced usage, refer to:
- [Kudi SMS API Documentation](https://my.kudisms.net/docs/api)
- Kudi SMS dashboard for latest features
- Template guidelines and best practices

---

**Last Updated**: December 14, 2024  
**Version**: 1.0.0
