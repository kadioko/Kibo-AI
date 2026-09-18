/**
 * Mock provider — free, deterministic stand-in for development and tests.
 * Completes after a few status polls with placeholder media. Enabled only
 * when MOCK_PROVIDER_ENABLED=true. Also serves as the reference example
 * for adding a real third provider: implement GenerationProvider, register
 * it in providers/index.ts, done.
 */
import { randomUUID } from "crypto";
import type {
  CostEstimate,
  CreateGenerationInput,
  GenerationProvider,
  ProviderGenerationStatus,
  ProviderModelInfo,
  QueuedGeneration,
} from "./types";

interface MockJob {
  input: CreateGenerationInput;
  polls: number;
  cancelled: boolean;
  createdAt: number;
}

const jobs = new Map<string, MockJob>();
/** Polls before a job reports completed. */
const POLLS_TO_COMPLETE = 2;

export function isMockEnabled(): boolean {
  return process.env.MOCK_PROVIDER_ENABLED === "true";
}

export function createMockProvider(): GenerationProvider {
  return {
    id: "mock",

    async estimateCost(): Promise<CostEstimate> {
      return { amountUsd: 0, currency: "USD", breakdown: "Mock provider — free" };
    },

    async createGeneration(input: CreateGenerationInput): Promise<QueuedGeneration> {
      const providerRequestId = `mock_${randomUUID()}`;
      jobs.set(providerRequestId, { input, polls: 0, cancelled: false, createdAt: Date.now() });
      return { providerRequestId, status: "queued" };
    },

    async getGenerationStatus(providerRequestId: string): Promise<ProviderGenerationStatus> {
      const job = jobs.get(providerRequestId);
      if (!job) return { status: "failed", outputUrls: [], error: "Unknown mock request" };
      if (job.cancelled) return { status: "cancelled", outputUrls: [] };
      job.polls += 1;
      if (job.polls < POLLS_TO_COMPLETE) {
        return { status: job.polls === 1 ? "queued" : "processing", outputUrls: [] };
      }
      const seed = providerRequestId.replace(/[^a-z0-9]/gi, "").slice(0, 12);
      const outputUrls =
        job.input.generationType === "video"
          ? ["https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"]
          : [`https://picsum.photos/seed/${seed}/1024/1024`];
      return { status: "completed", outputUrls };
    },

    async cancelGeneration(providerRequestId: string): Promise<void> {
      const job = jobs.get(providerRequestId);
      if (job) job.cancelled = true;
    },

    async getModels(): Promise<ProviderModelInfo[]> {
      return [
        { id: "mock-image", label: "Mock Image (free)", generationType: "image" },
        { id: "mock-video", label: "Mock Video (free)", generationType: "video" },
      ];
    },
  };
}
