/**
 * Provider registry — resolves a provider id to a GenerationProvider.
 * Add new providers here; the rest of the app stays untouched.
 */
import { higgsfieldFromEnv } from "./higgsfield";
import type { GenerationProvider } from "./types";

export type ProviderId = "higgsfield";

export function getProvider(id: ProviderId): GenerationProvider {
  switch (id) {
    case "higgsfield":
      return higgsfieldFromEnv();
    default:
      throw new Error(`Unknown provider: ${id satisfies never}`);
  }
}

export function isProviderId(value: string): value is ProviderId {
  return value === "higgsfield";
}

export type { GenerationProvider };
export type * from "./types";
