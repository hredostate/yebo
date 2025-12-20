import { useState } from 'react';

/**
 * Custom hook for managing AI comment toggle state with localStorage persistence
 * @returns Object with enabled state and change handler
 */
export function useAICommentToggle() {
  const [useAIComments, setUseAIComments] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('yebo_ai_comments_enabled');
      return saved !== 'false'; // Default to true (AI mode) for backward compatibility
    } catch (error) {
      console.warn('Failed to read AI comments preference from localStorage:', error);
      return true; // Default to true if localStorage is not available
    }
  });

  const handleAIToggleChange = (enabled: boolean) => {
    setUseAIComments(enabled);
    try {
      localStorage.setItem('yebo_ai_comments_enabled', String(enabled));
    } catch (error) {
      console.warn('Failed to save AI comments preference to localStorage:', error);
    }
  };

  return {
    useAIComments,
    setUseAIComments: handleAIToggleChange,
  };
}
