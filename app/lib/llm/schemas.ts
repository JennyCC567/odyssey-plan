import { z } from "zod";

export const redDotIdSchema = z.enum([
  "life",
  "experience",
  "process",
  "inner",
  "mastery",
  "wealth",
  "fame",
  "work",
  "impact"
]);

export const evidenceTagIdSchema = z.enum([
  "stability",
  "novelty",
  "good_people",
  "understanding",
  "craft",
  "practical_return",
  "recognition",
  "making",
  "helping"
]);

export const explorationAnswerSchema = z.object({
  questionId: z.number().int().min(1).max(99),
  text: z.string().trim().min(1).max(8000),
  tags: z.array(evidenceTagIdSchema).max(9).default([]),
  confirmedRedDots: z.array(redDotIdSchema).max(3).optional(),
  excludedRedDots: z.array(redDotIdSchema).max(4).optional()
});

export const baziProfileSchema = z.object({}).passthrough();

export const sessionCreateSchema = z.object({
  birthForm: z.object({}).passthrough().optional(),
  baziProfile: baziProfileSchema.optional()
});

export const sessionLookupSchema = z.object({
  sessionId: z.string().min(1).max(120)
});

export const answerSaveSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  answer: explorationAnswerSchema,
  // 客户端持有全部历史答案（serverless 无共享内存，以客户端为权威来源）
  answers: z.array(explorationAnswerSchema).max(32).optional(),
  profile: baziProfileSchema.optional(),
  shouldReflect: z.boolean().optional()
});

export const reflectionRequestSchema = z.object({
  profile: baziProfileSchema,
  answeredCount: z.number().int().min(1).max(99),
  latestAnswer: z.string().max(8000),
  answers: z.array(explorationAnswerSchema).max(32).optional(),
  question: z.object({
    id: z.number().int().min(1).max(99),
    theme: z.string().max(80),
    prompt: z.string().max(500)
  }).optional()
});

export const baziReflectionOutputSchema = z.object({
  reflection: z.string().min(1).max(1500),
  keywords: z.array(z.string().min(1).max(8)).min(2).max(4)
});

export const rankingPromptsRequestSchema = z.object({
  answers: z.array(explorationAnswerSchema).max(32),
  topDots: z.array(redDotIdSchema).length(3),
  profile: z.record(z.unknown()).optional()
});

export const rankingPromptsOutputSchema = z.object({
  prompts: z.array(z.object({
    id: redDotIdSchema,
    description: z.string().min(10).max(400),
    question: z.string().min(10).max(200)
  })).length(3)
});

export const candidateShortlistRequestSchema = z.object({
  answers: z.array(explorationAnswerSchema).max(32),
  excluded: z.array(redDotIdSchema).max(4).optional(),
  profile: z.record(z.unknown()).optional()
});

export const candidateShortlistOutputSchema = z.object({
  candidates: z.array(z.object({
    id: redDotIdSchema,
    evidence: z.string().min(1).max(300)
  })).length(5)
});

export const diagnosisDraftRequestSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  answers: z.array(explorationAnswerSchema).max(32),
  profile: z.record(z.unknown()).optional(),
  reflections: z.array(z.object({
    id: z.string().min(1).max(120),
    keywords: z.array(z.string().min(1).max(16)).max(4).optional(),
    text: z.string().min(1).max(2000),
    note: z.string().max(800).optional()
  })).max(6).optional()
});

export const diagnosisConfirmRequestSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  finalRedDots: z.array(redDotIdSchema).length(3),
  revisionNote: z.string().max(2000).optional()
});

export const odysseyPlansRequestSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  // 单次只生成一版（serverless 单函数有时限，三版由前端逐版请求）
  kind: z.enum(["current", "alternate", "ideal"]),
  topDots: z.array(redDotIdSchema).min(1).max(3),
  direction: z.string().trim().max(160).default(""),
  answers: z.array(explorationAnswerSchema).max(32).optional(),
  profile: z.record(z.unknown()).optional(),
  // 已生成的前几版，用于保证三版明显区分
  previouslyGenerated: z
    .array(
      z.object({
        kind: z.string().max(20),
        title: z.string().max(120),
        thesis: z.string().max(400),
        timelineThemes: z.array(z.string().max(120)).max(5)
      })
    )
    .max(2)
    .optional()
});

export const redDotScoreSchema = z.object({
  id: redDotIdSchema,
  score: z.number().min(0).max(100),
  evidence: z.array(z.string().min(1).max(180)).min(1).max(4)
});

export const diagnosisReportOutputSchema = z.object({
  scores: z.array(redDotScoreSchema).length(9),
  topScores: z.array(redDotScoreSchema).min(3).max(3),
  top3Reasons: z.array(z.string().min(1).max(260)).min(3).max(4),
  lifeInterpretation: z.string().min(1).max(700),
  personPortrait: z.string().min(1).max(450)
});

// 模型有时会把“风险/排查方式”这类成对信息写成对象，这里兼容并拍平成一句话
function flexibleTextList(length: number) {
  return z
    .array(z.union([z.string().min(1).max(220), z.record(z.unknown())]))
    .length(length)
    .transform((items) =>
      items.map((item) =>
        typeof item === "string"
          ? item
          : Object.values(item)
              .filter((value) => typeof value === "string" || typeof value === "number")
              .map(String)
              .join("；")
      )
    );
}

// 模型偶尔会漏掉 dashboard 分数或 focus 字段、把 year 发成数字——这里做宽容解析，避免整体退回兜底
function coerceScore() {
  return z.coerce.number().min(0).max(10).catch(5);
}

export const odysseyPlanOutputSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object") {
    const plan = raw as Record<string, unknown>;
    if (Array.isArray(plan.timeline)) {
      plan.timeline = plan.timeline.map((item) =>
        item && typeof item === "object" && (item as Record<string, unknown>).focus == null
          ? { ...item, focus: (item as Record<string, unknown>).theme ?? "延续上一年的节奏" }
          : item
      );
    }
  }
  return raw;
}, z.object({
  title: z.string().min(1).max(80),
  kind: z.enum(["current", "alternate", "ideal"]),
  thesis: z.string().min(1).max(400),
  dashboard: z.object({
    resources: coerceScore(),
    love: coerceScore(),
    confidence: coerceScore(),
    coherence: coerceScore()
  }),
  timeline: z.array(z.object({
    year: z.coerce.string().min(1).max(24),
    theme: z.string().min(1).max(40),
    focus: z.string().min(1).max(200)
  })).length(5),
  risks: flexibleTextList(3),
  prototypes: flexibleTextList(2),
  firstYearCards: z.array(z.object({
    title: z.string().min(1).max(60),
    type: z.enum(["能力", "资源", "进步"]),
    category: z.string().min(1).max(24),
    actions: z.array(z.string().min(1).max(120)).min(1).max(5)
  })).length(3)
}));

export const odysseyPlansOutputSchema = z.object({
  plans: z.array(odysseyPlanOutputSchema).length(3)
}).refine((value) => {
  const kinds = value.plans.map((plan) => plan.kind);
  return kinds.includes("current") && kinds.includes("alternate") && kinds.includes("ideal");
}, {
  message: "plans must include current, alternate, and ideal"
});

export type ExplorationAnswerInput = z.infer<typeof explorationAnswerSchema>;
