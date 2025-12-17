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

/**
 * Checks if an error is a rate limit error (429 status).
 * @param error The error object to check.
 * @returns True if the error is a rate limit error.
 */
export function isRateLimitError(error: any): boolean {
  // Check for various rate limit error formats
  const has429Status = error?.status === 429 || 
                       error?.response?.status === 429 ||
                       error?.code === 429;
  
  // Check for rate limit related messages
  const hasRateLimitMessage = error?.message && (
    error.message.toLowerCase().includes('rate limit') ||
    error.message.toLowerCase().includes('quota exceeded') ||
    error.message.toLowerCase().includes('too many requests')
  );
  
  return has429Status || hasRateLimitMessage;
}

/**
 * Extracts a user-friendly message from a rate limit error.
 * @param error The rate limit error object.
 * @returns A user-friendly message describing the rate limit.
 */
export function getRateLimitMessage(error: any): string {
  // Try to extract wait time from error message
  const errorMsg = error?.message || error?.toString() || '';
  
  // Look for patterns like "try again in X seconds" or similar
  const waitTimeMatch = errorMsg.match(/try again in (\d+)\s*(second|minute|hour)s?/i);
  if (waitTimeMatch) {
    const time = waitTimeMatch[1];
    const unit = waitTimeMatch[2];
    return `AI service rate limit reached. Please try again in ${time} ${unit}${time !== '1' ? 's' : ''}.`;
  }
  
  // Look for model-specific rate limit messages
  if (errorMsg.includes('Rate limit reached for model')) {
    return 'AI service is temporarily busy due to high usage. Please try again in a few minutes.';
  }
  
  // Generic rate limit message
  return 'AI service rate limit reached. Please try again later.';
}