import { NextResponse } from "next/server";
import { createId, getStore, nowIso } from "../../../lib/db/client";
import { touchSession } from "../../../lib/db/sessions";
import { createDiagnosisDraft } from "../../../lib/domain/exploration";
import { diagnosisDraftRequestSchema } from "../../../lib/llm/schemas";
import type { BaziProfile } from "../../../lib/bazi";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = diagnosisDraftRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "诊断草案参数不完整。" }, { status: 400 });
  }

  const profile = parsed.data.profile as BaziProfile | undefined;
  const draft = await createDiagnosisDraft(parsed.data.answers, {
    profile,
    reflections: parsed.data.reflections
  });
  const record = {
    id: createId("diag"),
    sessionId: parsed.data.sessionId,
    scores: draft.scores,
    topScores: draft.topScores,
    source: draft.source,
    createdAt: nowIso()
  };

  getStore().diagnoses.push(record);

  if (parsed.data.sessionId) {
    touchSession(parsed.data.sessionId, { status: "diagnosing" });
  }

  return NextResponse.json({
    draftId: record.id,
    ...draft
  });
}

// Vercel 函数执行上限（Hobby 档会被钳制到 60s；Pro 可到 300s）
export const maxDuration = 300;
