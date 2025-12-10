import { useState, useCallback, useRef } from 'react';
// Note: TTS features temporarily disabled during OpenRouter migration
// import { GoogleGenAI, Modality } from '@google/genai';
import { getAIClient } from '../services/aiClient';

// Helper functions for audio decoding (as per Gemini guidelines)
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const speak = useCallback(async (text: string, voiceName: 'Kore' | 'Puck' = 'Kore') => {
    if (isPlaying || isLoading || !text.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      if (!aiClient) {
        throw new Error("AI client not initialized.");
      }

      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio data received from API.");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
      
      sourceRef.current = audioContextRef.current.createBufferSource();
      sourceRef.current.buffer = audioBuffer;
      sourceRef.current.connect(audioContextRef.current.destination);
      
      sourceRef.current.onended = () => {
        setIsPlaying(false);
      };

      sourceRef.current.start();
      setIsPlaying(true);
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      setIsPlaying(false);
    }
  }, []);

  return { speak, stop, isPlaying, isLoading };
};
