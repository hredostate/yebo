import { useState, useCallback, useRef } from 'react';
// Note: TTS features disabled - not supported by Groq API
// Groq does not provide text-to-speech capabilities like Gemini did
// This hook is kept for backward compatibility but returns no-op functions

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const speak = useCallback(async (text: string, voiceName: 'Kore' | 'Puck' = 'Kore') => {
    console.warn("TTS is not available with Groq API. This feature is disabled.");
    return;
  }, []);

  const stop = useCallback(() => {
    console.warn("TTS is not available with Groq API. This feature is disabled.");
    return;
  }, []);

  return { speak, stop, isPlaying, isLoading };
};
