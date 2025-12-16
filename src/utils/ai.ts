/**
 * Extracts the text content from an AI response (Groq/OpenAI or legacy Gemini).
 * Works for both streaming and non-streaming responses.
 * @param resp The response object from the AI SDK.
 * @returns The aggregated text content as a string.
 */
export function textFromAI(resp: any): string {
  if (!resp) return '';
  // OpenAI/Groq format
  if (resp.choices?.[0]?.message?.content) {
    return resp.choices[0].message.content;
  }
  // Legacy Gemini format (for backward compatibility)
  if (typeof resp.text === 'string') {
    return resp.text;
  }
  // Fallback for structured or chunked responses
  return resp.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
}

/**
 * @deprecated Use textFromAI instead
 */
export function textFromGemini(resp: any): string {
  return textFromAI(resp);
}

type AiLogStatus = 'success' | 'error' | 'fallback' | 'unavailable';

interface AiLogMetadata {
  status?: AiLogStatus;
  durationMs?: number;
  error?: any;
  detail?: string;
  provider?: string;
  model?: string;
  suggestions?: number;
}

/**
 * Lightweight telemetry helper for AI calls so we can correlate latency,
 * failures, and fallback usage without wiring a full observability stack.
 */
export function logAiEvent(event: string, metadata: AiLogMetadata = {}): void {
  const payload = {
    event,
    status: metadata.status || 'success',
    durationMs: metadata.durationMs,
    provider: metadata.provider,
    model: metadata.model,
    suggestions: metadata.suggestions,
    detail: metadata.detail,
  };

  if (metadata.error) {
    console.error('[AI]', payload, metadata.error);
  } else {
    console.debug('[AI]', payload);
  }
}