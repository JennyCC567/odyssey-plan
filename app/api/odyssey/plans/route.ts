import { NextResponse } from "next/server";
import { createId, getStore, nowIso } from "../../../lib/db/client";
import { touchSession } from "../../../lib/db/sessions";
import { createOdysseyPlans } from "../../../lib/domain/exploration";
import { odysseyPlansRequestSchema } from "../../../lib/llm/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = odysseyPlansRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "生成计划需要 1-3 个红点和方向信息。" }, { status: 400 });
  }

  const result = await createOdysseyPlans({
    topDots: parsed.data.topDots,
    direction: parsed.data.direction
  });
  const record = {
    id: createId("plan"),
    sessionId: parsed.data.sessionId,
    topDots: parsed.data.topDots,
    direction: parsed.data.direction,
    plans: result.plans,
    source: result.source,
    createdAt: nowIso()
  };

  getStore().plans.push(record);

  if (parsed.data.sessionId) {
    touchSession(parsed.data.sessionId, { status: "planned" });
  }

  return NextResponse.json({
    planId: record.id,
    ...result
  });
}
