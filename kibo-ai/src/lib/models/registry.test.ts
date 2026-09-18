import { describe, expect, it } from "vitest";
import {
  buildPlatformBody,
  estimateModelCost,
  getModel,
  parseSettings,
} from "./registry";

describe("parseSettings", () => {
  it("fills defaults and drops unknown keys", () => {
    const parsed = parseSettings(getModel("soul-2"), { aspectRatio: "16:9", bogus: 1 });
    expect(parsed).toEqual({
      aspectRatio: "16:9",
      resolution: "720p",
      batchSize: "1",
      enhancePrompt: true,
    });
  });

  it("rejects out-of-allow-list enums", () => {
    const parsed = parseSettings(getModel("kling-3-pro"), { aspectRatio: "4:3" });
    expect(parsed.aspectRatio).toBe("16:9");
  });

  it("omits optional integers when empty (random seed)", () => {
    const parsed = parseSettings(getModel("soul-2"), { seed: "" });
    expect("seed" in parsed).toBe(false);
  });

  it("clamps integers to range", () => {
    const parsed = parseSettings(getModel("soul-2"), { seed: 42 });
    expect(parsed.seed).toBe(42);
    const bad = parseSettings(getModel("soul-2"), { seed: 9_999_999 });
    expect("seed" in bad).toBe(false);
  });
});

describe("buildPlatformBody", () => {
  it("sends soul batch_size as an integer", () => {
    const { endpoint, body } = buildPlatformBody({
      model: "soul-2",
      generationType: "image",
      prompt: "a portrait",
      settings: { batchSize: "4" },
    });
    expect(endpoint).toBe("higgsfield-ai/soul/v2/standard");
    expect(body.batch_size).toBe(4);
  });

  it("never sends negative_prompt (no verified model supports it)", () => {
    const { body } = buildPlatformBody({
      model: "soul-2",
      generationType: "image",
      prompt: "a portrait",
      negativePrompt: "blurry",
      settings: {},
    });
    expect("negative_prompt" in body).toBe(false);
  });

  it("sends kling sound as on/off strings", () => {
    const { body } = buildPlatformBody({
      model: "kling-3-pro",
      generationType: "video",
      prompt: "a pavilion",
      settings: { sound: true },
    });
    expect(body.sound).toBe("on");
  });

  it("picks the image endpoint when a start frame is attached", () => {
    const { endpoint, body } = buildPlatformBody({
      model: "kling-3-pro",
      generationType: "video",
      prompt: "animate this",
      inputAssets: [{ url: "https://example.com/frame.png", role: "start" }],
      settings: {},
    });
    expect(endpoint).toBe("kling-video/v3.0/pro/image-to-video");
    expect(body.image_url).toBe("https://example.com/frame.png");
  });

  it("throws for unknown models", () => {
    expect(() =>
      buildPlatformBody({ model: "nope", generationType: "image", prompt: "x", settings: {} }),
    ).toThrow();
  });
});

describe("estimateModelCost", () => {
  it("prices soul-2 batch of 4 at 4x list", () => {
    const estimate = estimateModelCost({
      model: "soul-2",
      generationType: "image",
      prompt: "x",
      settings: { batchSize: "4" },
    });
    expect(estimate.amountUsd).toBeCloseTo(0.0128, 4);
    expect(estimate.breakdown).toContain("4 images");
  });

  it("prices kling-3-pro 5s with default sound on (docs default)", () => {
    const estimate = estimateModelCost({
      model: "kling-3-pro",
      generationType: "video",
      prompt: "x",
      settings: { duration: "5" },
    });
    // 5s × ($0.28 + $0.05 audio) — sound defaults to true per the docs.
    expect(estimate.amountUsd).toBeCloseTo(1.65, 2);
  });

  it("adds the audio rate when sound is on", () => {
    const silent = estimateModelCost({
      model: "kling-3-std",
      generationType: "video",
      prompt: "x",
      settings: { duration: "5" },
    });
    const withSound = estimateModelCost({
      model: "kling-3-std",
      generationType: "video",
      prompt: "x",
      settings: { duration: "5", sound: true },
    });
    expect(withSound.amountUsd).toBeGreaterThan(silent.amountUsd);
  });

  it("lists free mock models for testing", () => {
    const mockImage = getModel("mock-image");
    expect(mockImage.provider).toBe("mock");
    const estimate = estimateModelCost({
      model: "mock-video",
      generationType: "video",
      prompt: "x",
      settings: { duration: "5" },
    });
    expect(estimate.amountUsd).toBe(0);
  });
});
