import { NextResponse } from "next/server";
import { appendAnswer, ensureSession, getAnswers } from "../../../lib/db/sessions";
import { createDiagnosisDraft, normalizeAnswerTags } from "../../../lib/domain/exploration";
import { diagnosisFollowUpRequestSchema } from "../../../lib/llm/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = diagnosisFollowUpRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "补问回答格式不完整。" }, { status: 400 });
  }

  const session = ensureSession({ sessionId: parsed.data.sessionId });
  const answer = normalizeAnswerTags(parsed.data.answer);
  const baseAnswers = parsed.data.answers ?? getAnswers(session.id);
  const answers = parsed.data.answers ? [...baseAnswers, answer].sort((a, b) => a.questionId - b.questionId) : appendAnswer(session.id, answer);
  const draft = await createDiagnosisDraft(answers);

  return NextResponse.json({
    sessionId: session.id,
    answer,
    answers,
    ...draft
  });
}
