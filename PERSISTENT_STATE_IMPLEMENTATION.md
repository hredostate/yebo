# Persistent Dropdown Selections & Device Login Tracking - Implementation Summary

## Overview
This implementation adds two major features to the School Guardian 360 application:
1. **Persistent dropdown selections** that remember user preferences across sessions
2. **Device login tracking** with a 2-device limit to enhance security

## Features Implemented

### 1. Persistent Dropdown Selections
Dropdown selections now persist across sessions using localStorage with user-specific keys:

**Components Updated:**
- `AcademicAssignmentManager.tsx` - Term selector
- `AcademicClassManager.tsx` - Term selector  
- `ScoreReviewView.tsx` - Term, class, subject, and teacher filters

**How it works:**
- Uses custom `usePersistedState` hook that wraps `useState` with localStorage
- Storage keys are user-specific (format: `yeo_<key-name>_<userId>`)
- Automatically cleared on logout
- Survives page reloads and re-logins

### 2. Device Login Tracking

**Database Schema:**
- New `user_sessions` table tracks active sessions
- Stores device info, IP address, user agent, timestamps
- Sessions auto-expire after 5 minutes of inactivity

**Session Management:**
- Sessions created on login with device fingerprinting
- Heartbeat every 30 seconds updates `last_active`
- Maximum 2 concurrent devices per user
- Device counter shown in header (📱 1/2 devices)

**Device Limit Enforcement:**
- Login blocked when 2 devices already active
- `DeviceLimitModal` shows list of active devices
- Option to log out oldest device to proceed
- Color-coded indicator (green/yellow based on usage)

## Technical Implementation

### New Files Created

1. **`src/hooks/usePersistedState.ts`**
   - Custom React hook for localStorage persistence
   - Helper functions for user-specific keys
   - Functions to clear persisted state on logout

2. **`src/services/sessionManager.ts`**
   - Session creation with device fingerprinting
   - Session heartbeat and cleanup functions
   - Device count and limit checking
   - Session termination (individual or oldest)

3. **`src/components/DeviceLimitModal.tsx`**
   - Modal UI for device limit enforcement
   - Lists active sessions with details
   - Action to logout oldest device

4. **`src/utils/userHelpers.ts`**
   - Utility to get current user ID from session
   - Used by components without direct userProfile access

5. **`supabase/migrations/20251212_add_user_sessions_table.sql`**
   - Database migration for user_sessions table
   - RLS policies for security
   - Indexes for performance
   - Cleanup function for expired sessions

### Updated Files

1. **`src/App.tsx`**
   - Session heartbeat effect (30s interval)
   - Cleanup on logout (terminate session + clear persisted state)
   - Import session manager functions

2. **`src/components/Header.tsx`**
   - Device counter display with custom hook
   - Polls device count every 30 seconds
   - Color-coded indicator
   - Tooltip with device count

3. **`src/components/LoginPage.tsx` & `StudentLoginPage.tsx`**
   - Device limit check before login
   - Session creation on successful login
   - DeviceLimitModal integration
   - Handle logout oldest device action

## Usage Examples

### For Users

**Persistent Dropdowns:**
1. Select a term in any dropdown
2. Navigate away or logout
3. Return and login - selection is restored

**Device Management:**
1. Login on device 1 - see "📱 1/2 devices" in header
2. Login on device 2 - see "📱 2/2 devices" in header
3. Try login on device 3 - blocked with modal
4. Choose to logout oldest device to proceed

### For Developers

**Using Persistent State:**
```typescript
import { usePersistedState, getUserPersistedKey } from '../hooks/usePersistedState';
import { getCurrentUserId } from '../utils/userHelpers';

const userId = getCurrentUserId();
const [myValue, setMyValue] = usePersistedState(
  getUserPersistedKey(userId, 'my_preference'),
  defaultValue
);
```

**Session Management:**
```typescript
import { 
  createSession, 
  isDeviceLimitReached,
  terminateOldestSession 
} from '../services/sessionManager';

// On login
const { limitReached } = await isDeviceLimitReached(userId);
if (limitReached) {
  // Show modal
} else {
  await createSession(userId);
}
```

## Security Considerations

1. **Session Expiry:** Sessions auto-expire after 5 minutes of inactivity
2. **RLS Policies:** Users can only view/manage their own sessions
3. **User-Specific Keys:** Persisted state uses user IDs to prevent cross-user access
4. **Cleanup on Logout:** All user data cleared from localStorage and session storage

## Future Enhancements

Potential improvements for future iterations:

1. **Settings Page Integration:**
   - "Manage Devices" section to view all sessions
   - Manual termination of specific sessions
   - Session history

2. **Device Nicknames:**
   - Allow users to name their devices
   - Better identification in device list

3. **Push Notifications:**
   - Notify users when new device logs in
   - Alert when device is forcefully logged out

4. **Advanced Fingerprinting:**
   - More sophisticated device fingerprinting
   - Better detection of same device

5. **Configurable Limits:**
   - Allow admins to set custom device limits per user/role
   - Different limits for students vs staff

## Testing Recommendations

1. **Session Management:**
   - Login on multiple devices
   - Verify device limit enforcement
   - Test session expiry after 5 minutes
   - Test logout cleanup

2. **Persistent State:**
   - Select values in dropdowns
   - Logout and login
   - Verify selections restored
   - Test with multiple users

3. **Edge Cases:**
   - Network interruptions during login
   - Simultaneous logins
   - Session expiry during active use
   - Browser storage disabled

## Migration Instructions

To apply the database migration:

1. Run the migration file in Supabase SQL Editor:
   ```sql
   -- Located at: supabase/migrations/20251212_add_user_sessions_table.sql
   ```

2. Verify the table was created:
   ```sql
   SELECT * FROM user_sessions LIMIT 1;
   ```

3. Test RLS policies are working:
   ```sql
   -- Should only show current user's sessions
   SELECT * FROM user_sessions;
   ```

## Support

For issues or questions:
- Check browser console for errors
- Verify localStorage is enabled
- Check network tab for session API calls
- Review Supabase logs for backend errors
