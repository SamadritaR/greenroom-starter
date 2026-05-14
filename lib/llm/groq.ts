/**
 * Thin Groq client (OpenAI-compatible chat completions). Swap providers by
 * replacing this module; prompts stay in `lib/prompts/`.
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/** Nudges JSON-object mode toward the Zod contract (esp. sourceQuotes as objects). */
const JSON_CONTRACT_APPENDIX = `

---
Output: Respond with a single JSON object only (no markdown code fences, no commentary).
- terms: array of { key, label, value, confidence (optional, "high"|"medium"|"low"), sourceQuotes }
- ambiguities: array of { summary, whyAmbiguous, estimatedDollarImpactUsd (optional number), sourceQuotes }
- overallConfidence (optional): "high"|"medium"|"low"
Every sourceQuotes array must contain objects shaped as { "text": "<verbatim quote>", "context": null or string }, never bare strings.`;

function requireApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key?.trim()) {
    throw new Error("GROQ_API_KEY is not set");
  }
  return key;
}

export function getDefaultGroqModelId(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
}

interface GroqChatResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

/**
 * Single-turn JSON generation using Groq `json_object` response format.
 * Caller validates with Zod (`dealExtractionSchema`).
 */
export async function generateStructuredJson(params: {
  userPrompt: string;
  systemInstruction?: string;
  modelId?: string;
}): Promise<string> {
  const systemContent = params.systemInstruction
    ? `${params.systemInstruction}${JSON_CONTRACT_APPENDIX}`
    : JSON_CONTRACT_APPENDIX.trim();

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.modelId ?? getDefaultGroqModelId(),
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: params.userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });

  const body = (await res.json()) as GroqChatResponse;

  if (!res.ok) {
    const msg = body.error?.message ?? res.statusText;
    throw new Error(`Groq API error (${res.status}): ${msg}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("Empty response from Groq");
  }
  return content;
}
