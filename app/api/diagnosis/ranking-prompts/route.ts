import { NextResponse } from "next/server";
import { createRankingPrompts } from "../../../lib/domain/exploration";
import { rankingPromptsRequestSchema } from "../../../lib/llm/schemas";
import type { ExplorationAnswer } from "../../../lib/odyssey";
import type { RedDotId } from "../../../lib/theory";
import type { BaziProfile } from "../../../lib/bazi";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = rankingPromptsRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "排序抉择参数不完整。" }, { status: 400 });
  }

  const prompts = await createRankingPrompts({
    answers: parsed.data.answers as ExplorationAnswer[],
    topDots: parsed.data.topDots as RedDotId[],
    profile: parsed.data.profile as BaziProfile | undefined
  });

  return NextResponse.json(prompts);
}

// Vercel 函数执行上限（Hobby 档会被钳制到 60s；Pro 可到 300s）
export const maxDuration = 300;
