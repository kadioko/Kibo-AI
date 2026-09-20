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
/** Fallback completion delay when a serverless request lands on a new instance. */
const SERVERLESS_COMPLETION_MS = 1_500;

function outputUrls(providerRequestId: string, generationType: "image" | "video"): string[] {
  const seed = providerRequestId.replace(/[^a-z0-9]/gi, "").slice(0, 12);
  return generationType === "video"
    ? ["https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"]
    : [`https://picsum.photos/seed/${seed}/1024/1024`];
}

function parsePortableRequest(providerRequestId: string) {
  const match = /^mock_(image|video)_([a-z0-9]+)_[a-f0-9-]+$/i.exec(providerRequestId);
  if (!match) return null;
  const createdAt = Number.parseInt(match[2]!, 36);
  if (!Number.isFinite(createdAt)) return null;
  return { generationType: match[1]!.toLowerCase() as "image" | "video", createdAt };
}

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
      const providerRequestId = `mock_${input.generationType}_${Date.now().toString(36)}_${randomUUID()}`;
      jobs.set(providerRequestId, { input, polls: 0, cancelled: false, createdAt: Date.now() });
      return { providerRequestId, status: "queued" };
    },

    async getGenerationStatus(providerRequestId: string): Promise<ProviderGenerationStatus> {
      const job = jobs.get(providerRequestId);
      if (!job) {
        const portable = parsePortableRequest(providerRequestId);
        if (!portable) return { status: "failed", outputUrls: [], error: "Unknown mock request" };
        if (Date.now() - portable.createdAt < SERVERLESS_COMPLETION_MS) {
          return { status: "processing", outputUrls: [] };
        }
        return {
          status: "completed",
          outputUrls: outputUrls(providerRequestId, portable.generationType),
        };
      }
      if (job.cancelled) return { status: "cancelled", outputUrls: [] };
      job.polls += 1;
      if (job.polls < POLLS_TO_COMPLETE) {
        return { status: job.polls === 1 ? "queued" : "processing", outputUrls: [] };
      }
      return { status: "completed", outputUrls: outputUrls(providerRequestId, job.input.generationType) };
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
