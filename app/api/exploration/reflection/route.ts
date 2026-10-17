import { NextResponse } from "next/server";
import { createReflection } from "../../../lib/domain/exploration";
import { reflectionRequestSchema } from "../../../lib/llm/schemas";
import type { BaziProfile } from "../../../lib/bazi";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = reflectionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "镜像生成参数不完整。" }, { status: 400 });
  }

  return NextResponse.json(
    await createReflection({
      profile: parsed.data.profile as BaziProfile,
      answeredCount: parsed.data.answeredCount,
      latestAnswer: parsed.data.latestAnswer,
      answers: parsed.data.answers,
      question: parsed.data.question
    })
  );
}
