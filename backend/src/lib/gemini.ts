import { env, llmConfigured } from "./env";

// Default timeout for the synchronous, user-facing call (symptom-assist,
// where a patient is actively waiting on the response mid-form) — kept
// short so a slow call fails fast rather than stalling the UI. Background
// jobs (pre-visit brief, post-visit summary) pass a longer explicit
// timeout via `timeoutMs`, since nothing user-facing blocks on them and a
// shared-CPU free-tier host is more latency-variable than local dev.
const DEFAULT_GEMINI_TIMEOUT_MS = 10_000;

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set");
  }
}

export class LlmCallFailedError extends Error {}

/**
 * Calls Gemini with strict JSON output (responseMimeType) and a hard
 * timeout. Never retries internally — that's the job queue's concern, not
 * this function's. Throws on any failure; callers are expected to catch
 * and degrade gracefully (see llm.service.ts) rather than let a bad
 * response reach the doctor or patient.
 */
export async function callGemini(params: {
  systemInstruction: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<unknown> {
  if (!llmConfigured) throw new LlmNotConfiguredError();

  const timeoutMs = params.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: params.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2, // low — this is structured extraction, not creative writing
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new LlmCallFailedError(`Gemini API returned ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new LlmCallFailedError("Gemini response had no text content");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new LlmCallFailedError("Gemini response was not valid JSON despite responseMimeType");
    }
  } catch (err) {
    if (err instanceof LlmCallFailedError || err instanceof LlmNotConfiguredError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new LlmCallFailedError(`Gemini call timed out after ${timeoutMs}ms`);
    }
    throw new LlmCallFailedError(`Gemini call failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}
