import { useState } from 'react';

/**
 * Custom hook for managing AI comment toggle state with localStorage persistence
 * @returns Object with enabled state and change handler
 */
export function useAICommentToggle() {
  const [useAIComments, setUseAIComments] = useState<boolean>(() => {
    const saved = localStorage.getItem('yebo_ai_comments_enabled');
    return saved !== 'false'; // Default to true (AI mode) for backward compatibility
  });

  const handleAIToggleChange = (enabled: boolean) => {
    setUseAIComments(enabled);
    localStorage.setItem('yebo_ai_comments_enabled', String(enabled));
  };

  return {
    useAIComments,
    setUseAIComments: handleAIToggleChange,
  };
}
