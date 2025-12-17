# Student Credential Messaging System - Implementation Guide

## Overview
This feature implements automated delivery of student login credentials to parents via the existing messaging system (WhatsApp/SMS) when student accounts are created or passwords are reset.

## Features

### 1. Automated Credential Delivery
- **Single Account Creation**: When creating a login account for a student, credentials are automatically sent to registered parent phone numbers
- **Bulk Account Creation**: When generating logins for multiple students, credentials are sent to each student's parents
- **Password Reset**: When an admin resets a student's password, the new password is automatically sent to parents

### 2. Manual Resend Option
- Admins can manually resend credentials from the student profile page
- Shows confirmation dialog with parent phone numbers before sending
- Retrieves password securely from server-side metadata

### 3. Messaging Status Tracking
- Success/failure status displayed for each message sent
- Summary statistics shown in bulk operations
- Graceful handling of students without phone numbers

## Technical Implementation

### Database Schema

#### Message Templates
Two new message templates were added in migration `20251217_add_student_credential_templates.sql`:

1. **student_credentials** - For initial account creation
   - Variables: `{student_name}`, `{username}`, `{password}`, `{school_name}`
   - Sample: "Hello! Login credentials for {student_name} at {school_name}: Username: {username}, Password: {password}. Please keep this secure and change password after first login. - UPSS"

2. **password_reset** - For password resets
   - Variables: `{student_name}`, `{password}`, `{school_name}`
   - Sample: "Hello! Password has been reset for {student_name} at {school_name}: New Password: {password}. Please change this password after logging in. - UPSS"

### Backend Changes

#### Supabase Edge Functions

**1. manage-users/index.ts**
- Added `sendCredentialsToParent()` helper function
- Integrated messaging into:
  - `create_single_for_existing` action
  - `bulk_create_for_existing` action
  - `reset_password` action
  - New `resend_credentials` action
- Returns messaging results in API responses
- Handles missing phone numbers gracefully

**2. kudisms-send/index.ts**
- Added support for template-based sending
- New parameters: `template_name` and `variables`
- Fetches template from database and replaces variables
- Security: Escapes regex special characters to prevent ReDoS attacks
- Returns channel information in response

### Frontend Changes

#### StudentProfileView.tsx
- Added "Resend Credentials" button next to "Retrieve Password"
- Shows confirmation dialog with parent phone numbers
- Displays success/failure toast notifications
- No password required to be displayed (retrieved from server)

#### StudentListView.tsx
- Enhanced credentials modal with messaging status column
- Shows summary statistics:
  - ✓ X message(s) sent successfully
  - ✗ Y message(s) failed
  - ℹ Z student(s) without phone numbers
- Displays per-student messaging results

#### Type Definitions (types.ts)
- Added `student_credentials` to NotificationType
- Added `password_reset` to NotificationType
- Updated NotificationChannelConfig interface
- Updated WhatsAppTemplateCodes interface

## Usage

### Creating Student Accounts

**Single Account Creation:**
1. Navigate to Student Profile
2. Click "Create Login" button
3. Account is created and credentials are automatically sent to parent phone numbers
4. Check the messaging results in the response

**Bulk Account Creation:**
1. Select multiple students from Student List
2. Click "Generate Logins" button
3. Credentials modal shows messaging status for each student
4. Export credentials to CSV if needed

### Resetting Passwords

1. Navigate to Student Profile
2. Click "Reset" button next to password
3. New password is automatically sent to parent phone numbers
4. Check toast notification for messaging status

### Manually Resending Credentials

1. Navigate to Student Profile
2. Click "Resend Credentials" button
3. Confirm the parent phone numbers in the dialog
4. Credentials are sent and toast notifications show results

## Messaging Logic

### Phone Number Priority
1. Primary: `parent_phone_number_1`
2. Secondary: `parent_phone_number_2`
3. If no phone numbers: Skip messaging, continue with account creation

### Channel Preference
The system uses the existing channel preference logic from Kudi SMS settings:
1. Check `notification_channels` for `student_credentials` or `password_reset`
2. Try preferred channel (WhatsApp, SMS, or Both)
3. If WhatsApp fails and fallback is enabled, try SMS
4. Log all attempts in `sms_message_logs` table

### Error Handling
- Missing phone numbers: Logged as warning, no error thrown
- Template not found: Error returned to admin
- Messaging failure: Logged in messaging results, displayed to admin
- No impact on account creation (credential creation succeeds even if messaging fails)

## Security Considerations

### Password Security
- Passwords are NOT sent from client to server for resend operations
- Passwords retrieved from secure server-side user metadata
- All credential messages logged in database for audit trail

### Input Validation
- Phone numbers formatted to Nigerian standard (234XXXXXXXXXX)
- Template variable keys escaped to prevent ReDoS attacks
- All messaging attempts logged with timestamps

### Access Control
- Only users with student management permissions can create accounts
- Only admins can reset passwords
- All operations logged for audit purposes

## Testing

### Test Scenarios

1. **Student with 1 phone number**
   - Create account → Should send to parent_phone_number_1
   - Reset password → Should send to parent_phone_number_1

2. **Student with 2 phone numbers**
   - Create account → Should send to both numbers
   - Reset password → Should send to both numbers

3. **Student with 0 phone numbers**
   - Create account → Should succeed, skip messaging
   - Reset password → Should succeed, skip messaging

4. **Bulk creation with 10+ students**
   - Select 10+ students
   - Generate logins
   - Check messaging summary
   - Verify all successful sends
   - Export credentials

5. **WhatsApp → SMS fallback**
   - Configure channel preference to "WhatsApp"
   - Enable fallback in settings
   - If WhatsApp fails, should fall back to SMS
   - Check logs for fallback indicator

## Configuration

### Kudi SMS Settings
1. Navigate to Settings → Kudi SMS
2. Configure API Token and Sender ID
3. Set channel preferences for:
   - `student_credentials`
   - `password_reset`
4. Enable/disable fallback as needed

### Template Customization
SMS templates can be edited in the database:
```sql
UPDATE sms_templates 
SET message_content = 'Your custom message with {{student_name}}, {{username}}, {{password}}, {{school_name}}'
WHERE template_name = 'student_credentials';
```

## Monitoring & Logs

### Database Tables
- `sms_message_logs`: All sent messages with status and timestamps
- `sms_templates`: Template definitions with variables
- `kudisms_settings`: School-specific messaging configuration

### Log Fields
- `recipient_phone`: Phone number message was sent to
- `message_content`: Full message content
- `status`: 'sent' or 'failed'
- `channel`: 'sms' or 'whatsapp'
- `fallback_used`: Boolean indicating if fallback was used
- `kudi_response`: Full API response from Kudi SMS

## Troubleshooting

### Messages not sending
1. Check Kudi SMS settings are active for the school
2. Verify API token and sender ID are correct
3. Check phone number format (should be 234XXXXXXXXXX)
4. Review `sms_message_logs` for error messages

### Template not found
1. Run the migration: `20251217_add_student_credential_templates.sql`
2. Verify templates exist in `sms_templates` table for the school
3. Check template is marked as `is_active = true`

### Resend credentials not working
1. Ensure student has an active login account
2. Verify password exists in user metadata (`initial_password` field)
3. If password not found, reset password first
4. Check parent phone numbers are set

## Future Enhancements

Potential improvements for future versions:

1. **Delivery Status Tracking**
   - Track message delivery status from Kudi SMS
   - Update logs when messages are delivered
   - Retry failed messages automatically

2. **Custom Templates per School**
   - Allow schools to customize message templates
   - Support multiple languages
   - Template preview before sending

3. **Scheduled Sending**
   - Queue messages for sending at specific times
   - Batch sending to avoid rate limits
   - Send during business hours only

4. **Parent Portal Links**
   - Include link to parent portal in messages
   - One-time login links for first access
   - QR codes for easy app download

## Conclusion

The credential messaging system is now fully operational and provides automated delivery of student login credentials to parents via WhatsApp/SMS. The system is secure, auditable, and handles edge cases gracefully. All messaging is logged for compliance and troubleshooting purposes.

For support or questions, refer to the main messaging system documentation in `MESSAGING_SYSTEM_IMPLEMENTATION.md`.
