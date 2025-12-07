# Dedicated Virtual Accounts (DVA) Feature - User Guide

## Overview
The DVA feature integrates with Paystack to create unique bank account numbers for each student, making it easier to track and reconcile school fee payments automatically.

## For School Administrators

### Setting Up Paystack API

1. **Get Your Paystack API Keys**
   - Log in to your [Paystack Dashboard](https://dashboard.paystack.com/)
   - Navigate to **Settings → API Keys & Webhooks**
   - Copy your **Secret Key** (starts with `sk_test_` for test mode or `sk_live_` for production)

2. **Configure in School Guardian**
   - Go to **Settings → Payment Gateway** tab
   - Select the campus (or leave as "All Campuses" for default)
   - Paste your Paystack Secret Key
   - (Optional) Add your Public Key
   - Choose environment: **Test** or **Live**
   - Check **Enable this configuration**
   - Click **Save**

### Creating Virtual Accounts for Students

1. **Navigate to Student Finance**
   - Go to **Student Finance → Virtual Accounts** tab

2. **Create DVA**
   - Select a student from the dropdown (only students without DVA will show)
   - Choose a preferred bank (e.g., Wema Bank)
   - Click **Create DVA**
   - The system will:
     - Create a Paystack customer for the student
     - Generate a unique account number
     - Save the details to the database

3. **View and Manage DVAs**
   - All created virtual accounts are listed below
   - Each shows:
     - Student name and admission number
     - Bank name
     - Account number
     - Account name
     - Status (Active/Inactive)
   - Use the **Search** box to find specific students
   - Click **Deactivate** to disable an account

### Important Notes
- Each student can only have ONE active virtual account
- Payments to these accounts are automatically tracked by Paystack
- Use **Test mode** for testing before going live
- Keep your Secret Key secure - never share it publicly

## For Students

### Viewing Your Payment Wallet

1. **Access Student Portal**
   - Log in to your student account
   - Click on **My Wallet** tab

2. **Your Virtual Account Details**
   - You'll see a card displaying:
     - Your unique account number
     - Bank name
     - Account name
     - Status

3. **Making Payments**
   - Transfer your school fees to the displayed account number
   - Use any bank transfer method (mobile banking, ATM, branch)
   - Payments are automatically recorded

### Payment Instructions
- **Account Number**: The unique number shown on your wallet
- **Bank**: The bank name displayed
- **Amount**: Your school fees amount (check with school accountant)
- **Reference**: Include your admission number if prompted

## API Configuration Per Campus

If your school has multiple campuses, you can configure different Paystack accounts for each:

1. In **Settings → Payment Gateway**
2. Add separate configurations for each campus
3. Students will automatically use their campus's configuration

## Troubleshooting

### "Payment Gateway Not Configured" Error
- **Solution**: Admin needs to set up Paystack API keys in Settings → Payment Gateway

### "Student already has a virtual account" Error
- **Solution**: Check the Virtual Accounts list - the student may already have an account

### "Failed to fetch bank providers" Error
- **Solution**: 
  - Verify your Secret Key is correct
  - Check your internet connection
  - Ensure you're using a valid Paystack account

### Student can't see their wallet
- **Solution**: 
  - Admin must create a DVA for the student first
  - Student must log out and log back in to see updates

## Webhook Setup for Automatic Payment Processing

To enable automatic payment reconciliation when students transfer money to their virtual accounts:

### 1. Get Your Webhook URL

Your webhook URL will be in the format:
```
https://<project-ref>.supabase.co/functions/v1/paystack-webhook
```

To find your project reference:
1. Go to your Supabase project dashboard
2. Look at the URL or check **Settings → API**
3. Your project reference is the unique identifier in your project URL

**Example**: If your project ref is `abcdefghijklmnop`, your webhook URL is:
```
https://abcdefghijklmnop.supabase.co/functions/v1/paystack-webhook
```

### 2. Configure Webhook in Paystack Dashboard

1. Log in to your [Paystack Dashboard](https://dashboard.paystack.com/)
2. Navigate to **Settings → Webhooks**
3. Click **Add New Webhook URL**
4. Enter your webhook URL (from step 1)
5. Select the following events:
   - ✅ **dedicatedaccount.credit** (Required for DVA payments)
6. Click **Save**

### 3. Test the Webhook

1. Make a test transfer to a student's virtual account
2. Check the Paystack dashboard under **Webhooks** → **Event Logs**
3. Verify the webhook was delivered successfully (200 OK response)
4. Check the student's invoice in School Guardian to confirm payment was recorded

### 4. What Happens Automatically

When a payment is made to a student's virtual account:

1. **Paystack sends a webhook** to your server with payment details
2. **Webhook handler verifies** the request signature for security
3. **System finds the student** by matching the account number
4. **System finds the invoice** for the current term
5. **Payment is recorded** in the payments table
6. **Invoice is updated** with the new amount paid and status
7. **Status changes** from "Unpaid" → "Partial" or "Paid" automatically

### 5. Monitoring Webhook Events

- **Paystack Dashboard**: View webhook delivery status and retry history
- **Webhook Events Table**: All webhook events are logged in the `webhook_events` table for audit purposes
- **Logs**: Check Supabase Edge Function logs for detailed processing information

### 6. Troubleshooting Webhooks

**Webhook not receiving events:**
- Verify the webhook URL is correct in Paystack dashboard
- Check that the edge function is deployed
- Ensure `PAYSTACK_SECRET_KEY` environment variable is set

**Payment not recorded:**
- Check edge function logs in Supabase dashboard
- Verify the student has a DVA record
- Verify the school has a current term configured
- Check that the invoice exists for the student

**Duplicate payments:**
- The system automatically handles duplicate webhooks using payment reference
- If the same payment reference exists, the payment is skipped

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use Test mode during development**
3. **Rotate API keys periodically**
4. **Only give Payment Gateway access to trusted staff** (Admin and Accountant roles)
5. **Monitor the Paystack dashboard** for suspicious activity

## Support

For issues with:
- **Paystack API**: Contact Paystack support at support@paystack.com
- **School Guardian DVA**: Contact your system administrator

## Technical Details

### Database Tables
- `paystack_api_settings`: Stores API credentials per campus
- `dedicated_virtual_accounts`: Stores DVA details per student
- `webhook_events`: Logs all incoming webhook events for audit trail (optional)

### Permissions
- **Admin and Accountant**: Can view and manage API settings
- **All Staff**: Can view and create DVAs for students
- **Students**: Can view their own DVA only

### Supported Banks
The list of available banks is fetched directly from Paystack based on your account location (Nigeria or Ghana).
