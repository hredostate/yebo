import type { UserProfile } from '../types';
import { EmploymentStatus } from '../types';

/**
 * Check if a user is actively employed
 * Returns true if the user has no employment_status set (defaults to Active) or has Active status
 */
export function isActiveEmployee(user: UserProfile): boolean {
  return !user.employment_status || user.employment_status === EmploymentStatus.Active;
}

/**
 * Get the current logged-in user's ID from session/local storage
 * This is a helper for components that need user-specific persistence but don't have direct access to userProfile
 */
export function getCurrentUserId(): string | null {
  try {
    // Try to get from localStorage where we store session info
    const sessionToken = sessionStorage.getItem('yeo_session_token');
    if (sessionToken) {
      // Extract user ID from session token (format: userId_timestamp_random)
      const parts = sessionToken.split('_');
      if (parts.length >= 3) {
        return parts[0];
      }
    }
    
    // Fallback: try to get from any persisted state with user ID
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('yeo_') && key.includes('_')) {
        // Extract user ID from pattern like: yeo_term_selection_<userId>
        const parts = key.split('_');
        if (parts.length >= 4) {
          return parts[parts.length - 1]; // Last part is userId
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Error getting current user ID:', error);
    return null;
  }
}
