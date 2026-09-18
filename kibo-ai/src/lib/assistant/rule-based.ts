import type { ImproveInput, ImproveResult, PromptAssistant } from "./types";

const IMAGE_CRAFT =
  "ultra-detailed, professional lighting, sharp focus, rich color, high resolution";
const VIDEO_CRAFT =
  "smooth cinematic motion, professional cinematography, consistent lighting, high detail";

/**
 * Deterministic structurer — no network, no key. Cleans the input and
 * appends medium-appropriate craft direction when the idea is thin.
 */
export function improveRuleBased(input: ImproveInput): ImproveResult {
  const notes: string[] = [];
  let text = input.prompt.replace(/\s+/g, " ").trim();

  const words = text.split(" ").filter(Boolean);
  if (words.length < 3) {
    return {
      improved: text,
      backend: "rule",
      notes: ["Too short to improve — add a subject and setting first."],
    };
  }

  const craft = input.generationType === "image" ? IMAGE_CRAFT : VIDEO_CRAFT;
  const alreadyCrafted = /ultra-detailed|cinematic|4k|photoreal|professional lighting/i.test(text);
  if (!alreadyCrafted && words.length < 45) {
    text = `${text}, ${craft}`;
    notes.push("Added medium craft direction (light, detail, finish).");
  } else {
    notes.push("Cleaned and structured; already carried craft direction.");
  }

  if (input.brandContext) {
    notes.push("Brand context will be prepended at submit time.");
  }

  return { improved: text, backend: "rule", notes };
}

export const ruleAssistant: PromptAssistant = {
  id: "rule",
  async improve(input: ImproveInput): Promise<ImproveResult> {
    return improveRuleBased(input);
  },
};
