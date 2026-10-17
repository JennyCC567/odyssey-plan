import { NextResponse } from "next/server";
import { getLlmRuntime } from "../../../lib/llm/client";

export async function GET() {
  const runtime = getLlmRuntime();

  return NextResponse.json({
    mode: runtime.mode,
    provider: runtime.provider,
    model: runtime.model,
    baseUrl: runtime.baseUrl || null
  });
}
