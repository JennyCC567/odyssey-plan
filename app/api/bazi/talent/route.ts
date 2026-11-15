import { NextResponse } from "next/server";
import { createTalentAnalysis } from "../../../lib/domain/exploration";
import { talentAnalysisRequestSchema } from "../../../lib/llm/schemas";
import type { BaziProfile } from "../../../lib/bazi";

// Vercel/Workers 函数执行上限（Hobby 档被钳制到 60s；该任务通常 10-20s）
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = talentAnalysisRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "天赋点解析需要完整排盘数据。" }, { status: 400 });
  }

  try {
    const result = await createTalentAnalysis({
      profile: parsed.data.profile as BaziProfile
    });

    // 模型不可用或输出不合规时返回 null，前端保留规则版文案
    return NextResponse.json({
      talents: result?.talents ?? null,
      source: result?.source ?? "bazi-talent:rules-fallback"
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "天赋点解析失败" },
      { status: 500 }
    );
  }
}
