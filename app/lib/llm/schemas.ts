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
  confirmedRedDots: z.array(redDotIdSchema).max(3).optional()
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
  reflection: z.string().min(1).max(1500)
});

export const diagnosisDraftRequestSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  answers: z.array(explorationAnswerSchema).max(32)
});

export const diagnosisFollowUpRequestSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  answers: z.array(explorationAnswerSchema).max(32).optional(),
  answer: explorationAnswerSchema
});

export const diagnosisConfirmRequestSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  finalRedDots: z.array(redDotIdSchema).length(3),
  revisionNote: z.string().max(2000).optional()
});

export const odysseyPlansRequestSchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  topDots: z.array(redDotIdSchema).min(1).max(3),
  direction: z.string().trim().max(160).default("")
});

export const redDotScoreSchema = z.object({
  id: redDotIdSchema,
  score: z.number().min(0).max(100),
  evidence: z.array(z.string().min(1).max(180)).min(1).max(4)
});

export const followUpQuestionOutputSchema = z.object({
  id: z.string().min(1).max(120),
  prompt: z.string().min(1).max(300),
  candidates: z.array(redDotIdSchema).min(2).max(4),
  evidenceTags: z.array(evidenceTagIdSchema).min(1).max(5)
});

export const diagnosisAnalysisOutputSchema = z.object({
  status: z.enum(["confident", "needs_follow_up"]),
  reasons: z.array(z.string().min(1).max(200)).max(3),
  followUpQuestions: z.array(followUpQuestionOutputSchema).max(2)
});

export const diagnosisDraftOutputSchema = z.object({
  scores: z.array(redDotScoreSchema).length(9),
  analysis: diagnosisAnalysisOutputSchema,
  topScores: z.array(redDotScoreSchema).min(3).max(3)
});

export const odysseyPlanOutputSchema = z.object({
  title: z.string().min(1).max(80),
  kind: z.enum(["current", "alternate", "ideal"]),
  thesis: z.string().min(1).max(220),
  dashboard: z.object({
    resources: z.number().int().min(0).max(10),
    love: z.number().int().min(0).max(10),
    confidence: z.number().int().min(0).max(10),
    coherence: z.number().int().min(0).max(10)
  }),
  timeline: z.array(z.object({
    year: z.string().min(1).max(24),
    theme: z.string().min(1).max(24),
    focus: z.string().min(1).max(160)
  })).length(5),
  risks: z.array(z.string().min(1).max(140)).length(3),
  prototypes: z.array(z.string().min(1).max(160)).length(2),
  firstYearCards: z.array(z.object({
    title: z.string().min(1).max(60),
    type: z.enum(["能力", "资源", "进步"]),
    actions: z.array(z.string().min(1).max(100)).min(2).max(4)
  })).length(3)
});

export const odysseyPlansOutputSchema = z.object({
  plans: z.array(odysseyPlanOutputSchema).length(3)
}).refine((value) => {
  const kinds = value.plans.map((plan) => plan.kind);
  return kinds.includes("current") && kinds.includes("alternate") && kinds.includes("ideal");
}, {
  message: "plans must include current, alternate, and ideal"
});

export type ExplorationAnswerInput = z.infer<typeof explorationAnswerSchema>;
