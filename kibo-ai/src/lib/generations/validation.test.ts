import { describe, expect, it } from "vitest";
import { applyBrand, type ApiBrand } from "../api";
import { createGenerationSchema } from "./validation";

const brand = {
  id: "b1",
  name: "DukaPilot",
  description: null,
  website: null,
  logo_url: null,
  colors: [],
  industry: "Retail tech",
  target_audience: "Shop owners",
  visual_style: "Warm cinematic realism",
  ad_tone: "Bold but trustworthy",
  default_cta: "Shop now",
  created_at: new Date().toISOString(),
} satisfies ApiBrand;

describe("applyBrand", () => {
  it("prepends a context block", () => {
    const out = applyBrand("a shop owner smiling", brand);
    expect(out.startsWith("[Brand: DukaPilot.")).toBe(true);
    expect(out).toContain("a shop owner smiling");
    expect(out).toContain("Warm cinematic realism");
  });

  it("leaves the prompt untouched when the brand is empty", () => {
    const empty = { ...brand, industry: null, target_audience: null, visual_style: null, ad_tone: null, default_cta: null };
    expect(applyBrand("plain idea", empty)).toBe("plain idea");
  });
});

describe("createGenerationSchema", () => {
  it("accepts a minimal valid body with provider default", () => {
    const parsed = createGenerationSchema.safeParse({
      model: "soul-2",
      generationType: "image",
      prompt: "hello",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.provider).toBe("higgsfield");
  });

  it("rejects empty prompts and unknown providers", () => {
    expect(
      createGenerationSchema.safeParse({ model: "soul-2", generationType: "image", prompt: "  " })
        .success,
    ).toBe(false);
    expect(
      createGenerationSchema.safeParse({ provider: "other", model: "soul-2", generationType: "image", prompt: "x" })
        .success,
    ).toBe(false);
  });

  it("accepts the mock provider for testing", () => {
    const parsed = createGenerationSchema.safeParse({
      provider: "mock",
      model: "mock-image",
      generationType: "image",
      prompt: "x",
    });
    expect(parsed.success).toBe(true);
  });
});
