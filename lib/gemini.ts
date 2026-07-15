import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// Model is configurable via .env.local (GEMINI_MODEL=...). Defaults to
// Gemini 3.1 Flash-Lite.
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// Only real categories are accepted by safety_settings. HARM_CATEGORY_UNSPECIFIED
// is rejected with a 400, so we set explicit ones.
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const API_KEY = process.env.GOOGLE_API_KEY || "";

function assertKey() {
  if (!API_KEY) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Add it to .env.local (a Gemini key from https://aistudio.google.com/apikey), then restart the dev server."
    );
  }
}

const genAI = new GoogleGenerativeAI(API_KEY);

export const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  safetySettings,
});

/**
 * Turn a raw Gemini/SDK error into a single, human-readable line.
 * Keeps the ugly JSON quota payloads out of the UI.
 */
export function friendlyGeminiError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);

  if (/429|Too Many Requests|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    const retry = msg.match(/retry in ([\d.]+)s/i)?.[1];
    const zeroLimit = /limit:\s*0/i.test(msg);
    const base = zeroLimit
      ? `Gemini quota is 0 for "${MODEL_NAME}" on this API key's project — the free tier isn't enabled for this model.`
      : `Gemini rate limit / quota exceeded for "${MODEL_NAME}".`;
    const retryHint = retry ? ` Retry in ~${Math.ceil(Number(retry))}s.` : "";
    return `${base}${retryHint} Fixes: set GEMINI_MODEL in .env.local to a model with quota, use an AI Studio key that has free-tier quota, or enable billing. Docs: https://ai.google.dev/gemini-api/docs/rate-limits`;
  }
  if (/API key not valid|API_KEY_INVALID|unregistered callers|permission|403/i.test(msg)) {
    return `Gemini rejected the API key. Use a valid key from https://aistudio.google.com/apikey in .env.local and restart the dev server.`;
  }
  if (/404|not found|is not found for API version/i.test(msg)) {
    return `Model "${MODEL_NAME}" was not found for your API version/key. Set GEMINI_MODEL in .env.local to an available model (e.g. gemini-2.5-flash).`;
  }
  if (/GOOGLE_API_KEY is not set/i.test(msg)) return msg;
  return `Gemini error: ${msg.slice(0, 300)}`;
}

/** Streaming helper for Memory / Foresight. Yields text chunks. */
export async function* streamText(prompt: string, systemInstruction?: string) {
  assertKey();
  const chat = model.startChat({
    systemInstruction,
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    },
  });

  const result = await chat.sendMessageStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/** One-shot JSON helper for extraction / assumptions / interview questions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateJSON(
  prompt: string,
  systemInstruction?: string
): Promise<any> {
  assertKey();
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction,
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const text = response.response.text();
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  }
}
