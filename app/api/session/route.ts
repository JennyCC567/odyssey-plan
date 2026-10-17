import { NextResponse } from "next/server";
import type { BaziProfile } from "../../lib/bazi";
import { createSession, getSession } from "../../lib/db/sessions";
import { sessionCreateSchema, sessionLookupSchema } from "../../lib/llm/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = sessionCreateSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return NextResponse.json({ message: "会话信息格式不正确。" }, { status: 400 });
  }

  const session = createSession({
    birthForm: parsed.data.birthForm,
    baziProfile: parsed.data.baziProfile as BaziProfile | undefined
  });

  return NextResponse.json({ session });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = sessionLookupSchema.safeParse({ sessionId: url.searchParams.get("sessionId") });

  if (!parsed.success) {
    return NextResponse.json({ message: "缺少 sessionId。" }, { status: 400 });
  }

  const session = getSession(parsed.data.sessionId);

  if (!session) {
    return NextResponse.json({ message: "没有找到这个会话。" }, { status: 404 });
  }

  return NextResponse.json({ session });
}
