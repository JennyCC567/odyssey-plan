import { NextResponse } from "next/server";
import { createId, getStore, nowIso } from "../../../lib/db/client";
import { createDiagnosisDraft } from "../../../lib/domain/exploration";
import { diagnosisDraftRequestSchema } from "../../../lib/llm/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = diagnosisDraftRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "诊断草案参数不完整。" }, { status: 400 });
  }

  const draft = await createDiagnosisDraft(parsed.data.answers);
  const record = {
    id: createId("diag"),
    sessionId: parsed.data.sessionId,
    scores: draft.scores,
    analysis: draft.analysis,
    source: draft.source,
    createdAt: nowIso()
  };

  getStore().diagnoses.push(record);

  return NextResponse.json({
    draftId: record.id,
    ...draft
  });
}
