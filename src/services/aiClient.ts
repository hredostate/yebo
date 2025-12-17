import OpenAI from 'openai';
import { getGroqConfig } from './runtimeConfig';
import { isRateLimitError } from '../utils/ai';

let groqClient: OpenAI | null = null;
let aiClientError: string | null = null;
let currentModel: string = 'llama-3.1-8b-instant'; // Default Groq model

export function initializeAIClient(apiKey?: string, model?: string): void {
  const { apiKey: configuredKey, model: configuredModel, error: configError } = getGroqConfig();

  const resolvedApiKey = apiKey || configuredKey;
  const resolvedModel = model || configuredModel;

  if (!resolvedApiKey) {
    aiClientError =
      configError || 'Groq API Key not configured. Please add your API key in Settings > AI Configuration.';
    groqClient = null;
    return;
  }
  
  try {
    groqClient = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: resolvedApiKey,
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'School 360',
      },
    });
    aiClientError = null;
    currentModel = resolvedModel;
    console.log('[AI] Groq client initialized with model:', currentModel);
  } catch (e: any) {
    aiClientError = `Failed to initialize Groq client: ${e.message}`;
    groqClient = null;
  }
}

export function getAIClient(): OpenAI | null {
  return groqClient;
}

export function getAIClientError(): string | null {
  return aiClientError;
}

export function getCurrentModel(): string {
  return currentModel;
}

/**
 * Wrapper for AI requests that handles rate limits with optional retry logic.
 * @param requestFn The AI request function to execute.
 * @param options Configuration options for retry behavior and callbacks.
 * @returns The result of the AI request.
 * @throws The original error if not a rate limit error or retries exhausted.
 */
export async function safeAIRequest<T>(
  requestFn: () => Promise<T>,
  options?: { 
    maxRetries?: number; 
    onRateLimited?: (error: any) => void;
    retryDelayMs?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 2000;
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error using the utility function
      if (isRateLimitError(error)) {
        // Call the rate limit callback if provided
        if (options?.onRateLimited) {
          options.onRateLimited(error);
        }
        
        // If we have retries left, wait and try again
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
          console.warn(`[AI] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // If not a rate limit error or no retries left, throw
      throw error;
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

// For backward compatibility
export { groqClient as aiClient, aiClientError };