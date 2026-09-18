import { NextResponse } from "next/server";
import { MODELS } from "@/lib/models/registry";
import { isMockEnabled } from "@/lib/providers/mock";

/** Public model catalog for the create screen. Pricing included for estimates. */
export async function GET() {
  const showMock = isMockEnabled();
  return NextResponse.json({
    models: MODELS.filter((m) => m.provider !== "mock" || showMock).map((m) => ({
      id: m.id,
      label: m.label,
      blurb: m.blurb,
      generationType: m.capabilities.generationType,
      capabilities: m.capabilities,
      mediaRoles: m.mediaRoles,
      settings: m.settings,
      endpoints: m.endpoints,
      pricing: m.pricing,
    })),
  });
}
