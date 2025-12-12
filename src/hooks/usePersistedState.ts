import { useState, useEffect, useCallback } from 'react';

/**
 * Custom React hook that wraps useState with localStorage persistence
 * @param key - Unique key for localStorage (should be user-specific for multi-user support)
 * @param defaultValue - Default value if nothing is stored
 * @returns [state, setState, clearState] tuple
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Initialize state from localStorage or default
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        return JSON.parse(storedValue) as T;
      }
    } catch (error) {
      console.warn(`Error loading persisted state for key "${key}":`, error);
    }
    return defaultValue;
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error persisting state for key "${key}":`, error);
    }
  }, [key, state]);

  // Clear persisted state
  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setState(defaultValue);
    } catch (error) {
      console.warn(`Error clearing persisted state for key "${key}":`, error);
    }
  }, [key, defaultValue]);

  return [state, setState, clearState];
}

/**
 * Helper to generate user-specific localStorage keys
 * @param userId - User ID
 * @param keyName - Name of the key (e.g., 'term_selection')
 * @returns User-specific localStorage key
 */
export function getUserPersistedKey(userId: string | null | undefined, keyName: string): string {
  if (!userId) {
    return `yeo_${keyName}_guest`;
  }
  return `yeo_${keyName}_${userId}`;
}

/**
 * Clear all persisted state for a specific user
 * @param userId - User ID
 */
export function clearUserPersistedState(userId: string | null | undefined): void {
  if (!userId) return;
  
  const prefix = `yeo_`;
  const suffix = `_${userId}`;
  
  try {
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    
    // Filter and remove keys that match the user pattern
    keys.forEach(key => {
      if (key.startsWith(prefix) && key.endsWith(suffix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error clearing user persisted state:', error);
  }
}

/**
 * Clear all persisted state (all users)
 * Useful for logout when you want to clean everything
 */
export function clearAllPersistedState(): void {
  const prefix = 'yeo_';
  
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error clearing all persisted state:', error);
  }
}
