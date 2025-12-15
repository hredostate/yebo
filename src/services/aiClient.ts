import OpenAI from 'openai';
import { getGroqConfig } from './runtimeConfig';

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

// For backward compatibility
export { groqClient as aiClient, aiClientError };