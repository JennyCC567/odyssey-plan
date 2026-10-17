import { NextResponse } from "next/server";
import { createReflection, normalizeAnswerTags } from "../../../lib/domain/exploration";
import { ensureSession, saveAnswer } from "../../../lib/db/sessions";
import { answerSaveSchema } from "../../../lib/llm/schemas";
import { redDotQuestions } from "../../../lib/theory";
import type { BaziProfile } from "../../../lib/bazi";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = answerSaveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "回答格式不完整，请检查 questionId、text 和标签。" }, { status: 400 });
  }

  const question = redDotQuestions.find((item) => item.id === parsed.data.answer.questionId);
  const answer = normalizeAnswerTags(parsed.data.answer, question?.evidenceTags);
  const session = ensureSession({
    sessionId: parsed.data.sessionId,
    baziProfile: parsed.data.profile as BaziProfile | undefined
  });
  const answers = saveAnswer(session.id, answer);
  const shouldReflect = parsed.data.shouldReflect ?? true;
  const reflection = shouldReflect && parsed.data.profile
    ? await createReflection({
        profile: parsed.data.profile as BaziProfile,
        answeredCount: answer.questionId,
        latestAnswer: answer.text,
        answers,
        question: question
          ? {
              id: question.id,
              theme: question.theme,
              prompt: question.prompt
            }
          : undefined
      })
    : undefined;

  return NextResponse.json({
    sessionId: session.id,
    answer,
    answers,
    reflection
  });
}
