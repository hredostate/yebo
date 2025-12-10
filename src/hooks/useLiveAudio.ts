import { useState, useRef, useCallback, useEffect } from 'react';
// Note: Live Audio features temporarily disabled during OpenRouter migration
// import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { getAIClient } from '../services/aiClient';

// --- Audio Encoding/Decoding Helpers (as per guidelines) ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
// --- End Helpers ---

export const useLiveAudio = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userTranscription, setUserTranscription] = useState('');
  const [aiTranscription, setAiTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const stopSession = useCallback(async () => {
    if (!sessionPromiseRef.current) return;
    
    // Stop microphone processing
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if(audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
    }
    
    // Stop any playing audio
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    try {
        const session = await sessionPromiseRef.current;
        session.close();
    } catch (e) {
        console.error("Error closing session:", e);
    }
    
    sessionPromiseRef.current = null;
    setIsSessionActive(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setUserTranscription('');
    setAiTranscription('');

  }, []);

  const startSession = useCallback(async (systemInstruction: string) => {
    if (isSessionActive || isConnecting || !aiClient) return;

    setIsConnecting(true);
    setError(null);

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = aiClient.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            systemInstruction,
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
            scriptProcessorRef.current = scriptProcessor;

            setIsConnecting(false);
            setIsSessionActive(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
                setUserTranscription(prev => prev + message.serverContent!.inputTranscription!.text);
            }
            if (message.serverContent?.outputTranscription) {
                setAiTranscription(prev => prev + message.serverContent!.outputTranscription!.text);
            }
             if (message.serverContent?.turnComplete) {
                setUserTranscription('');
                setAiTranscription('');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
            if (base64Audio) {
              setIsSpeaking(true);
              const outCtx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if(sourcesRef.current.size === 0) {
                    setIsSpeaking(false);
                }
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live session error:', e);
            setError("A connection error occurred.");
            stopSession();
          },
          onclose: (e: CloseEvent) => {
            stopSession();
          },
        },
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError("Failed to get microphone permissions or start session.");
      setIsConnecting(false);
    }
  }, [isSessionActive, isConnecting, stopSession]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return { 
    startSession, 
    stopSession, 
    isSessionActive, 
    isConnecting, 
    isSpeaking, 
    userTranscription, 
    aiTranscription, 
    error 
  };
};
