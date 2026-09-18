import { describe, expect, it } from "vitest";
import { improveRuleBased } from "./rule-based";

describe("improveRuleBased", () => {
  it("leaves very short ideas alone with guidance", () => {
    const res = improveRuleBased({ prompt: "cat", generationType: "image" });
    expect(res.backend).toBe("rule");
    expect(res.improved).toBe("cat");
    expect(res.notes.length).toBeGreaterThan(0);
  });

  it("adds image craft direction to thin prompts", () => {
    const res = improveRuleBased({
      prompt: "shop owner using DukaPilot",
      generationType: "image",
    });
    expect(res.improved).toContain("shop owner using DukaPilot");
    expect(res.improved).toContain("ultra-detailed");
  });

  it("adds motion direction to video prompts", () => {
    const res = improveRuleBased({
      prompt: "drone over a lighthouse",
      generationType: "video",
    });
    expect(res.improved).toContain("cinematic motion");
  });

  it("does not double up craft on rich prompts", () => {
    const rich = `cinematic portrait of a beekeeper in a sunlit orchard, medium format
      film, shallow depth of field, photoreal, ultra-detailed, many more words
      to push past the threshold of forty five words total here yes indeed truly`;
    const res = improveRuleBased({ prompt: rich, generationType: "image" });
    expect(res.improved.match(/ultra-detailed/gi)?.length).toBe(1);
  });

  it("collapses whitespace", () => {
    const res = improveRuleBased({
      prompt: "  a   neon\nmarket  ",
      generationType: "video",
    });
    expect(res.improved.startsWith("a neon market")).toBe(true);
  });
});
