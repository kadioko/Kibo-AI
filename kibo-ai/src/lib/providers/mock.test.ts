import { describe, expect, it } from "vitest";
import { createMockProvider } from "./mock";

describe("mock provider", () => {
  it("runs queued → processing → completed with media", async () => {
    const provider = createMockProvider();
    const queued = await provider.createGeneration({
      model: "mock-image",
      generationType: "image",
      prompt: "test",
      settings: {},
    });
    expect(queued.status).toBe("queued");

    const first = await provider.getGenerationStatus(queued.providerRequestId);
    expect(first.status).not.toBe("completed");

    const second = await provider.getGenerationStatus(queued.providerRequestId);
    expect(second.status).toBe("completed");
    expect(second.outputUrls.length).toBeGreaterThan(0);
  });

  it("costs nothing", async () => {
    const provider = createMockProvider();
    const estimate = await provider.estimateCost({
      model: "mock-video",
      generationType: "video",
      prompt: "test",
      settings: {},
    });
    expect(estimate.amountUsd).toBe(0);
  });

  it("supports cancel", async () => {
    const provider = createMockProvider();
    const queued = await provider.createGeneration({
      model: "mock-video",
      generationType: "video",
      prompt: "test",
      settings: {},
    });
    await provider.cancelGeneration(queued.providerRequestId);
    const status = await provider.getGenerationStatus(queued.providerRequestId);
    expect(status.status).toBe("cancelled");
  });

  it("fails unknown requests", async () => {
    const provider = createMockProvider();
    const status = await provider.getGenerationStatus("mock_nope");
    expect(status.status).toBe("failed");
  });
});
