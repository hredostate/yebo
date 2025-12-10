import OpenAI from 'openai';

// The API key will be loaded dynamically from school settings
let openRouterClient: OpenAI | null = null;
let aiClientError: string | null = null;
let currentModel: string = 'openai/gpt-4o'; // Default model

export function initializeAIClient(apiKey: string, model?: string): void {
  if (!apiKey) {
    aiClientError = "OpenRouter API Key not configured. Please add your API key in Settings > AI Configuration.";
    openRouterClient = null;
    return;
  }
  
  try {
    openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Required for client-side usage
      defaultHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'School 360',
      },
    });
    aiClientError = null;
    if (model) {
      currentModel = model;
    }
  } catch (e: any) {
    aiClientError = `Failed to initialize OpenRouter client: ${e.message}`;
    openRouterClient = null;
  }
}

export function getAIClient(): OpenAI | null {
  return openRouterClient;
}

export function getAIClientError(): string | null {
  return aiClientError;
}

export function getCurrentModel(): string {
  return currentModel;
}

// For backward compatibility
export { openRouterClient as aiClient, aiClientError };