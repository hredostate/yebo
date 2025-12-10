/**
 * Extracts the text content from an AI response (OpenRouter/OpenAI or legacy Gemini).
 * Works for both streaming and non-streaming responses.
 * @param resp The response object from the AI SDK.
 * @returns The aggregated text content as a string.
 */
export function textFromAI(resp: any): string {
  if (!resp) return '';
  // OpenAI/OpenRouter format
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