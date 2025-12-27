# Username Repair Guide

## Problem
Some student accounts were created with legacy username format (e.g., `raphaelegbobawaye547`) instead of the standard `firstname.lastname` format (e.g., `raphael.egbobawaye`). This causes login failures when students try to use the expected format.

## Solution
A new `repair_usernames` action has been added to the `manage-users` Edge Function to automatically migrate legacy usernames to the correct format.

## How to Use

### Via Supabase Edge Functions

Call the `manage-users` function with the `repair_usernames` action:

```javascript
const { data, error } = await supabase.functions.invoke('manage-users', {
  body: {
    action: 'repair_usernames',
    school_id: YOUR_SCHOOL_ID
  }
});
```

### Expected Response

```json
{
  "success": true,
  "results": [
    {
      "name": "Raphael Egbobawaye",
      "oldEmail": "raphaelegbobawaye547@upsshub.com",
      "newEmail": "raphael.egbobawaye@upsshub.com",
      "status": "Success"
    },
    {
      "name": "Aaron Oriakhi",
      "oldEmail": "aaronoriakhi673@upsshub.com",
      "newEmail": "aaron.oriakhi@upsshub.com",
      "status": "Success"
    }
  ],
  "summary": {
    "total": 5,
    "repaired": 5,
    "failed": 0,
    "skipped": 0
  }
}
```

## What Gets Updated

For each student with a legacy username, the repair action:

1. ✅ Generates a new username in `firstname.lastname` format
2. ✅ Updates the email in `auth.users` table
3. ✅ Updates the `username` field in `user_metadata`
4. ✅ Updates the `email` field in the `students` table
5. ✅ Handles duplicate usernames by adding numeric suffixes (e.g., `john.doe1`)

## Important Notes

- **Backup First**: Always backup your database before running bulk operations
- **School-Specific**: The repair only affects students in the specified school
- **Only Legacy Formats**: Only repairs usernames that don't match the `firstname.lastname` pattern
- **No Duplicates**: Automatically handles duplicate names by adding numeric suffixes
- **Non-Destructive**: Existing correct usernames are left unchanged

## Testing the Fix

After running the repair:

1. Students can now log in using their `firstname.lastname` username
2. Old credentials will no longer work (as the email has changed)
3. New credentials should be communicated to students/parents

## Changes Made

### 1. `supabase/functions/manage-users/index.ts`
- Added `repair_usernames` action (lines 1807-1961)
- Enhanced documentation for `generateUsername()` function to mark it as staff-only
- Added clear deprecation warning to prevent future misuse

### 2. `src/components/StudentLoginPage.tsx`
- Updated login hint from "Use your username in firstname.lastname format" to "Enter your username exactly as provided in your credentials"
- Changed placeholder from "e.g., firstname.lastname" to "Enter your username"
- Made the UI more flexible to accommodate both formats during transition

## Prevention

To prevent this issue in the future:

1. ✅ `generateUsername()` is now clearly documented as staff-only
2. ✅ All student account creation code uses `generateUsernameFromName()`
3. ✅ Login UI is more flexible during transition period

## Related Files

- `supabase/functions/manage-users/index.ts` - Edge function with repair action
- `src/components/StudentLoginPage.tsx` - Updated login UI hints
- This guide: `USERNAME_REPAIR_GUIDE.md`

## Support

If issues persist after repair:
1. Check the repair results for any failed entries
2. Verify the student's email was updated in both `auth.users` and `students` tables
3. Contact system administrator for manual investigation
