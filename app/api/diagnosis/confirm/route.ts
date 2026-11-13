import { NextResponse } from "next/server";
import { confirmSessionRedDots } from "../../../lib/db/sessions";
import { diagnosisConfirmRequestSchema } from "../../../lib/llm/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = diagnosisConfirmRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "请确认 3 个最终红点。" }, { status: 400 });
  }

  const session = parsed.data.sessionId ? confirmSessionRedDots(parsed.data.sessionId, parsed.data.finalRedDots) : undefined;

  return NextResponse.json({
    session,
    finalRedDots: parsed.data.finalRedDots,
    revisionNote: parsed.data.revisionNote ?? ""
  });
}

// Vercel 函数执行上限（Hobby 档会被钳制到 60s；Pro 可到 300s）
export const maxDuration = 300;
