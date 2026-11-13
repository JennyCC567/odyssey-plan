import { NextResponse } from "next/server";
import { createId, getStore, nowIso } from "../../../lib/db/client";
import { getSession, touchSession } from "../../../lib/db/sessions";
import { createSingleOdysseyPlan } from "../../../lib/domain/exploration";
import { odysseyPlansRequestSchema } from "../../../lib/llm/schemas";
import type { BaziProfile } from "../../../lib/bazi";

// Vercel 函数执行上限（Hobby 档会被钳制到 60s；Pro 可到 300s）
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = odysseyPlansRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "生成计划需要指定版本（kind）、1-3 个红点和方向信息。" }, { status: 400 });
  }

  const session = parsed.data.sessionId ? getSession(parsed.data.sessionId) : undefined;

  try {
    const result = await createSingleOdysseyPlan({
      kind: parsed.data.kind,
      topDots: parsed.data.topDots,
      direction: parsed.data.direction,
      answers: parsed.data.answers,
      profile: (parsed.data.profile as BaziProfile | undefined) ?? session?.baziProfile,
      previouslyGenerated: parsed.data.previouslyGenerated
    });

    const record = {
      id: createId("plan"),
      sessionId: parsed.data.sessionId,
      kind: parsed.data.kind,
      topDots: parsed.data.topDots,
      direction: parsed.data.direction,
      plans: [result.plan],
      source: result.source,
      createdAt: nowIso()
    };
    getStore().plans.push(record);

    if (parsed.data.sessionId) {
      touchSession(parsed.data.sessionId, { status: "planned" });
    }

    return NextResponse.json({
      planId: record.id,
      plan: result.plan,
      source: result.source
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "生成奥德赛计划失败" },
      { status: 500 }
    );
  }
}
