import type { BaziProfile } from "../bazi";
import type { ExplorationAnswer, OdysseyPlan, RedDotScore } from "../odyssey";
import type { RedDotId } from "../theory";

export type PathfinderSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "created" | "exploring" | "diagnosing" | "confirmed" | "planned";
  birthForm?: Record<string, unknown>;
  baziProfile?: BaziProfile;
  finalRedDots?: RedDotId[];
};

export type DiagnosisDraftRecord = {
  id: string;
  sessionId?: string;
  scores: RedDotScore[];
  topScores: RedDotScore[];
  source: string;
  createdAt: string;
};

export type OdysseyPlansRecord = {
  id: string;
  sessionId?: string;
  topDots: RedDotId[];
  direction: string;
  plans: OdysseyPlan[];
  source: string;
  createdAt: string;
};

type Store = {
  sessions: Map<string, PathfinderSession>;
  answers: Map<string, ExplorationAnswer[]>;
  diagnoses: DiagnosisDraftRecord[];
  plans: OdysseyPlansRecord[];
};

const globalStore = globalThis as typeof globalThis & {
  __pathfinderStore?: Store;
};

function createStore(): Store {
  return {
    sessions: new Map(),
    answers: new Map(),
    diagnoses: [],
    plans: []
  };
}

export function getStore(): Store {
  if (!globalStore.__pathfinderStore) {
    globalStore.__pathfinderStore = createStore();
  }

  return globalStore.__pathfinderStore;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
