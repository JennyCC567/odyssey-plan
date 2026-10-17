import type { BaziProfile } from "../bazi";
import type { ExplorationAnswer } from "../odyssey";
import type { RedDotId } from "../theory";
import { createId, getStore, nowIso, type PathfinderSession } from "./client";

export function createSession(input: { birthForm?: Record<string, unknown>; baziProfile?: BaziProfile }): PathfinderSession {
  const store = getStore();
  const createdAt = nowIso();
  const session: PathfinderSession = {
    id: createId("ses"),
    createdAt,
    updatedAt: createdAt,
    status: "created",
    birthForm: input.birthForm,
    baziProfile: input.baziProfile
  };

  store.sessions.set(session.id, session);
  store.answers.set(session.id, []);

  return session;
}

export function getSession(sessionId: string): PathfinderSession | undefined {
  return getStore().sessions.get(sessionId);
}

export function ensureSession(input?: { sessionId?: string; baziProfile?: BaziProfile }): PathfinderSession {
  if (input?.sessionId) {
    const existing = getSession(input.sessionId);
    if (existing) return existing;
  }

  return createSession({ baziProfile: input?.baziProfile });
}

export function touchSession(sessionId: string, patch: Partial<Pick<PathfinderSession, "status" | "baziProfile" | "finalRedDots">>): PathfinderSession | undefined {
  const store = getStore();
  const session = store.sessions.get(sessionId);
  if (!session) return undefined;

  const nextSession = {
    ...session,
    ...patch,
    updatedAt: nowIso()
  };

  store.sessions.set(sessionId, nextSession);
  return nextSession;
}

export function saveAnswer(sessionId: string, answer: ExplorationAnswer): ExplorationAnswer[] {
  const store = getStore();
  const current = store.answers.get(sessionId) ?? [];
  const nextAnswers = [...current.filter((item) => item.questionId !== answer.questionId), answer].sort((a, b) => a.questionId - b.questionId);

  store.answers.set(sessionId, nextAnswers);
  touchSession(sessionId, { status: answer.questionId >= 12 ? "diagnosing" : "exploring" });

  return nextAnswers;
}

export function appendAnswer(sessionId: string, answer: ExplorationAnswer): ExplorationAnswer[] {
  const store = getStore();
  const current = store.answers.get(sessionId) ?? [];
  const nextAnswers = [...current, answer].sort((a, b) => a.questionId - b.questionId);

  store.answers.set(sessionId, nextAnswers);
  touchSession(sessionId, { status: "diagnosing" });

  return nextAnswers;
}

export function getAnswers(sessionId: string): ExplorationAnswer[] {
  return getStore().answers.get(sessionId) ?? [];
}

export function confirmSessionRedDots(sessionId: string, finalRedDots: RedDotId[]): PathfinderSession | undefined {
  return touchSession(sessionId, { finalRedDots, status: "confirmed" });
}
