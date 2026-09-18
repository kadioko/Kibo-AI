import { assistantFromEnv } from "./openai-compatible";
import { ruleAssistant } from "./rule-based";
import type { PromptAssistant } from "./types";

/** LLM when configured, rule-based structurer otherwise. */
export function getAssistant(): PromptAssistant {
  return assistantFromEnv() ?? ruleAssistant;
}

export type { PromptAssistant };
export type * from "./types";
