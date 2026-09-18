import { NextResponse } from "next/server";
import { MODELS } from "@/lib/models/registry";

/** Public model catalog for the create screen. Pricing included for estimates. */
export async function GET() {
  return NextResponse.json({
    models: MODELS.map((m) => ({
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
