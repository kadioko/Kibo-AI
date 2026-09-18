import type { ImproveInput, ImproveResult, PromptAssistant } from "./types";
import { improveRuleBased } from "./rule-based";

/**
 * Any OpenAI-compatible chat completions endpoint (OpenAI, Groq, Together,
 * Ollama, …). Configure with:
 *   ASSISTANT_API_URL   e.g. https://api.openai.com/v1
 *   ASSISTANT_API_KEY
 *   ASSISTANT_MODEL     e.g. gpt-4o-mini (default)
 * Falls back to rule-based when unconfigured or on upstream failure.
 */
export function assistantFromEnv(): PromptAssistant | null {
  const baseUrl = process.env.ASSISTANT_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.ASSISTANT_API_KEY;
  const model = process.env.ASSISTANT_MODEL ?? "gpt-4o-mini";
  if (!baseUrl || !apiKey) return null;

  return {
    id: "llm",
    async improve(input: ImproveInput): Promise<ImproveResult> {
      try {
        const system =
          input.generationType === "image"
            ? "You turn rough ideas into production-ready text-to-image prompts: concrete subject, medium, light, lens, style, quality tags. Reply with the prompt only, one paragraph."
            : "You turn rough ideas into production-ready text-to-video prompts: subject, camera move, light, pacing, mood. Reply with the prompt only, one paragraph.";
        const user = input.brandContext
          ? `${input.prompt}\n\nBrand context to respect: ${input.brandContext}`
          : input.prompt;
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.7,
            max_tokens: 300,
          }),
        });
        if (!res.ok) throw new Error(`Assistant API ${res.status}`);
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const improved = json.choices?.[0]?.message?.content?.trim();
        if (!improved) throw new Error("Empty assistant response");
        return { improved, backend: "llm", notes: [`Refined with ${model}.`] };
      } catch {
        const fallback = improveRuleBased(input);
        return { ...fallback, notes: [...fallback.notes, "LLM unavailable — rule-based fallback."] };
      }
    },
  };
}
