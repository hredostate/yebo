import { getAIClient } from './aiClient';
import type { UPSSGPTResponse, ReportRecord, Task } from '../types';
import { extractAndParseJson } from '../utils/json';
import { textFromAI } from '../utils/ai';

export const UPSS_GPT_SYSTEM_PROMPT_BASE = `You are UPSS-GPT — the private AI assistant for University Preparatory Secondary School (UPSS).

Mission:
Serve the school leadership, staff, and students by giving insights, summaries, plans, and communications that match UPSS culture and tone.

Rules:
- Use only the data provided in the Context section. Never invent data.
- If information is missing, reply: "Not enough data to answer" and explain what would be needed.
- Keep tone: professional, empathetic, clear, actionable.
- Output must be valid JSON matching the provided schema.
- Never include text outside the JSON. Never guess names or data.

Special modes:
1. STATUS SUMMARY — summarize patterns, performance, or morale.
2. EARLY WARNING — detect risks in academics, behavior, or operations.
3. ACTION PLAN — suggest steps or interventions.
4. COMMUNICATION DRAFT — craft short messages for staff, parents, or students.
`;


export async function askUPSSGPT(
    question: string, 
    context: string, 
    mode: 'Principal' | 'Teacher' | 'Student' = 'Principal'
): Promise<UPSSGPTResponse> {
    
    let systemInstruction = UPSS_GPT_SYSTEM_PROMPT_BASE;
    if (mode === 'Principal') {
        systemInstruction += '\n**Principal Mode:** You are UPSS-GPT-Principal. Focus on strategy, early warnings, and staff morale.';
    }

    const userPrompt = `${systemInstruction}

Context:
---
${context}
---

Principal Question:
---
${question}
---

Additional rules:
- Be concise and truthful.
- Prefer recent information when conflicts exist.
- Keep all responses role-appropriate for a school environment.

Return a JSON object with:
- answer: The main textual answer to the question (string)
- alerts: A list of critical warnings or alerts identified from the data (array of strings)
- recommended_actions: A list of suggested next steps or actions (array of strings)
- confidence: The model's confidence in its answer based on the provided context (string: 'high', 'medium', or 'low')`;

    try {
        const aiClient = getAIClient();
        if (!aiClient) {
            throw new Error("AI client is not configured.");
        }
        
        const response = await aiClient.chat.completions.create({
            model: 'openai/gpt-4o',
            messages: [{ role: 'user', content: userPrompt }],
            response_format: { type: 'json_object' }
        });

        const parsed = extractAndParseJson<UPSSGPTResponse>(textFromAI(response));
        if (!parsed) {
             throw new Error("Model returned invalid JSON structure.");
        }
        return parsed;
        
    } catch (e: any) {
        console.error("UPSS-GPT Error:", e);
        return {
            answer: `An error occurred while processing your request: ${e.message}`,
            alerts: ["AI Service Error"],
            recommended_actions: ["Please check the application logs and try again."],
            confidence: "low"
        };
    }
}