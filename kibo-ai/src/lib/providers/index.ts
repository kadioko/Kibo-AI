/**
 * Provider registry — resolves a provider id to a GenerationProvider.
 * Add new providers here; the rest of the app stays untouched.
 */
import { higgsfieldFromEnv } from "./higgsfield";
import { createMockProvider, isMockEnabled } from "./mock";
import type { GenerationProvider } from "./types";

export type ProviderId = "higgsfield" | "mock";

export function getProvider(id: ProviderId): GenerationProvider {
  switch (id) {
    case "higgsfield":
      return higgsfieldFromEnv();
    case "mock":
      if (!isMockEnabled()) {
        throw new Error("Mock provider is disabled (set MOCK_PROVIDER_ENABLED=true)");
      }
      return createMockProvider();
    default:
      throw new Error(`Unknown provider: ${id satisfies never}`);
  }
}

export function isProviderId(value: string): value is ProviderId {
  return value === "higgsfield" || value === "mock";
}

export type { GenerationProvider };
export type * from "./types";
