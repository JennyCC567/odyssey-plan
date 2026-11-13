import { NextResponse } from "next/server";
import { createCandidateShortlist } from "../../../lib/domain/exploration";
import { candidateShortlistRequestSchema } from "../../../lib/llm/schemas";
import type { ExplorationAnswer } from "../../../lib/odyssey";
import type { RedDotId } from "../../../lib/theory";
import type { BaziProfile } from "../../../lib/bazi";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = candidateShortlistRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "候选预筛参数不完整。" }, { status: 400 });
  }

  const shortlist = await createCandidateShortlist({
    answers: parsed.data.answers as ExplorationAnswer[],
    excluded: parsed.data.excluded as RedDotId[] | undefined,
    profile: parsed.data.profile as BaziProfile | undefined
  });

  return NextResponse.json(shortlist);
}

// Vercel 函数执行上限（Hobby 档会被钳制到 60s；Pro 可到 300s）
export const maxDuration = 300;
