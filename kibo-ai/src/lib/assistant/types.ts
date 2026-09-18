/**
 * Prompt assistant abstraction.
 * improve() turns a rough idea into a production-ready prompt. Rule-based
 * works without any key; set ASSISTANT_* env vars to route through an
 * OpenAI-compatible chat model instead.
 */

export type GenerationType = "image" | "video";

export interface ImproveInput {
  prompt: string;
  generationType: GenerationType;
  /** Optional brand context to weave in. */
  brandContext?: string;
}

export interface ImproveResult {
  improved: string;
  /** Which backend produced it: "llm" or "rule". */
  backend: "llm" | "rule";
  notes: string[];
}

export interface PromptAssistant {
  readonly id: string;
  improve(input: ImproveInput): Promise<ImproveResult>;
}
