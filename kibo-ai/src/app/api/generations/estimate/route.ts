import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { estimateModelCost, getModel, parseSettings } from "@/lib/models/registry";
import { estimateSchema } from "@/lib/generations/validation";

export async function POST(request: Request) {
  try {
    await requireUser();
    const json = await request.json();
    const parsed = estimateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    const model = getModel(parsed.data.model);
    const estimate = estimateModelCost({
      model: model.id,
      generationType: parsed.data.generationType,
      prompt: parsed.data.prompt,
      negativePrompt: parsed.data.negativePrompt,
      inputAssets: parsed.data.inputAssets,
      settings: parseSettings(model, parsed.data.settings ?? {}),
    });
    return NextResponse.json({ estimate });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
