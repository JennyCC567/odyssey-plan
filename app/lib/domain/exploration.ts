import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBaziReflection, type BaziProfile } from "../bazi";
import { getGenerationSource, runJsonCompletion } from "../llm/client";
import {
  baziReflectionOutputSchema,
  candidateShortlistOutputSchema,
  diagnosisReportOutputSchema,
  odysseyPlanOutputSchema,
  rankingPromptsOutputSchema
} from "../llm/schemas";
import {
  generateOdysseyPlans,
  inferEvidenceTagsFromText,
  scoreRedDots,
  type ExplorationAnswer,
  type OdysseyPlan,
  type RedDotScore
} from "../odyssey";
import { evidenceTags, redDotById, redDotQuestions, redDots, type EvidenceTagId, type RedDotId } from "../theory";

export type MirrorContext = {
  id: string;
  keywords?: string[];
  text: string;
  note?: string;
};

export type DiagnosisDraft = {
  scores: RedDotScore[];
  topScores: RedDotScore[];
  top3Reasons: string[];
  lifeInterpretation: string;
  personPortrait: string;
  source: string;
};

export type OdysseyPlansResult = {
  plans: OdysseyPlan[];
  source: string;
};

export function normalizeAnswerTags(answer: ExplorationAnswer, allowedTags?: EvidenceTagId[]): ExplorationAnswer {
  const tags = answer.tags.length ? answer.tags : inferEvidenceTagsFromText(answer.text, allowedTags);

  return {
    ...answer,
    tags
  };
}

const baziSkillFiles = [
  "SKILL.md",
  "references/wangshui-judgment.md",
  "references/yongshen-selection.md",
  "references/verification-questions.md"
];
let baziSkillContextCache: string | null = null;

function loadBaziSkillContext(): string {
  if (baziSkillContextCache !== null) return baziSkillContextCache;
  const base = join(process.cwd(), "八字命理分析");
  const sections: string[] = [];
  for (const file of baziSkillFiles) {
    try {
      sections.push(`=== ${file} ===\n${readFileSync(join(base, file), "utf8")}`);
    } catch {
      // skill 资料缺失时跳过该文件，不阻断镜像生成
    }
  }
  baziSkillContextCache = sections.join("\n\n");
  return baziSkillContextCache;
}

export async function createReflection(input: {
  profile: BaziProfile;
  answeredCount: number;
  latestAnswer: string;
  answers?: ExplorationAnswer[];
  question?: {
    id: number;
    theme: string;
    prompt: string;
  };
}) {
  const stageName = input.answeredCount <= 3
    ? "过去回看：关键选择、峰值瞬间、低谷边界"
    : input.answeredCount <= 6
      ? "未来想象：对标标杆、无限想象、具体画面"
      : input.answeredCount <= 9
        ? "抽象归纳：共性、冲突、内核边界"
        : "模型确认：排除、底线、强制排序";
  const recentTurns = input.answers?.slice(-3).map((answer) => {
    const question = redDotQuestions.find((item) => item.id === answer.questionId);
    return {
      id: answer.questionId,
      theme: question?.theme,
      prompt: question?.prompt,
      answer: answer.text
    };
  });
  const baselineKeywords = [
    ...(input.profile.dayMaster?.cue ?? "").split(/[、，,、\s]+/),
    ...(input.profile.dominantElements?.[0]?.cue.split(/[、，,、\s]+/) ?? [])
  ].filter(Boolean).slice(0, 4);
  const baseline = {
    reflection: createBaziReflection(input.profile, input.answeredCount, input.latestAnswer, recentTurns),
    keywords: baselineKeywords,
    source: "bazi-reflection:rules-fallback"
  };
  const llm = await runJsonCompletion({
    task: "bazi-reflection",
    schema: baziReflectionOutputSchema,
    temperature: 0.45,
    maxTokens: 16384,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的命理镜像教练。",
          "产品背景：Pathfinder 是基于人生红点理论的 AI 人生设计教练，服务于方向模糊、动力不足、路径断裂的年轻人。用户正在通过十二问回看过去选择、峰值低谷、未来向往、冲突边界和取舍排序，目标是形成被用户认可的红点共识，再进入三版五年奥德赛计划。",
          "你的任务不是诊断红点，而是在每完成三问后，把用户这一轮回答放回命理镜面中做一次温和复盘，帮助用户坚持回答、看见惯性、提出下一轮观察角度。",
          "baziSkillKnowledge 中提供「八字命理分析 Skill」的完整知识库（对话式解盘流程、日主旺衰判定、喜用神选取、自然验证问题）。这是你理解命理线索的方法来源，请自由消化使用，不必复述术语，也不必按它的流程走。",
          "baziProfile 含完整排盘：四柱干支、年/月/时柱天干十神、四个地支的藏干（各带十神）、大运轨迹。你可以据此做更立体的命理镜面（如食伤与官杀的张力、印星与日主的滋养关系），但同样只作参照。",
          "重要边界：命理只作为兴趣入口和自我观察线索，不参与红点评分，不替用户做人生决定，不做命定论，不说灾祸、婚恋断言、绝对职业判断。",
          "必须综合 recentTurns 中最近三题的题目与回答，不要只复述 latestAnswer；要指出三题之间的共同线索、张力或变化。",
          "如果 recentTurns 至少有 2 条，回应中必须同时提到至少两条回答里的具体事实或关键词；禁止以“你刚才提到”开头。",
          "不要写成泛泛模板，请根据三题的实际内容重新组织语言。",
          "除非命理线索确实能帮用户看见自己的惯性，否则不要生硬地搬出日主、五行、大运等术语；结论由你自己从三问回答中得出。",
          "不要输出思考过程，不要解释你如何分析，只给最终镜像文本。",
          "如果 answeredCount 小于 10，避免直接给出红点类型名称；如果 answeredCount 为 10-12，可以只围绕用户主动确认/排除的排序做镜像，不重新判分。",
          "输出一段 160-260 字的中文镜像回应。",
          "同时提炼 2-4 个关键词标签（每个 2-4 字），概括这一轮回答的动力特质：优先呼应命理线索中的词语（如日主或主导五行的线索词），也可以来自回答本身最传神的词，像给命理盘面打标签一样。",
          "只输出 JSON：{\"reflection\":\"...\",\"keywords\":[\"...\"]}。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          question: input.question,
          answer: input.latestAnswer,
          recentTurns,
          answeredCount: input.answeredCount,
          explorationStage: stageName,
          baziProfile: input.profile,
          baziSkillKnowledge: loadBaziSkillContext()
        })
      }
    ]
  });

  if (!llm.ok) {
    console.warn("bazi-reflection LLM fallback:", llm.error);
    return baseline;
  }

  return {
    reflection: llm.data.reflection,
    keywords: llm.data.keywords,
    source: llm.source
  };
}

export type CandidateShortlist = {
  candidates: Array<{ id: RedDotId; evidence: string }>;
  source: string;
};

function buildShortlistBaseline(answers: ExplorationAnswer[], excluded: RedDotId[]): Array<{ id: RedDotId; evidence: string }> {
  const excludedSet = new Set(excluded);
  const scored = scoreRedDots(answers).filter((score) => !excludedSet.has(score.id));
  const ranked = scored.filter((score) => score.score > 0).slice(0, 5);
  const fill = scored.filter((score) => score.score <= 0).slice(0, Math.max(0, 5 - ranked.length));

  return [...ranked, ...fill].map((score) => ({
    id: score.id,
    evidence: score.evidence.length ? score.evidence[0] : "规则预筛暂无强证据，仅供参考。"
  }));
}

export async function createCandidateShortlist(input: {
  answers: ExplorationAnswer[];
  excluded?: RedDotId[];
  profile?: BaziProfile;
}): Promise<CandidateShortlist> {
  const excluded = input.excluded ?? [];
  const turns = input.answers.map((answer) => {
    const question = redDotQuestions.find((item) => item.id === answer.questionId);
    return {
      id: answer.questionId,
      theme: question?.theme,
      prompt: question?.prompt,
      answer: answer.text,
      excludedRedDots: answer.excludedRedDots,
      confirmedRedDots: answer.confirmedRedDots
    };
  });
  const baseline = {
    candidates: buildShortlistBaseline(input.answers, excluded),
    source: getGenerationSource("candidate-shortlist")
  };
  const llm = await runJsonCompletion({
    task: "candidate-shortlist",
    schema: candidateShortlistOutputSchema,
    temperature: 0.25,
    maxTokens: 16384,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的人生设计教练，负责在红点正式确认前预筛候选。",
          "基于用户已回答的所有题目（过去选择、峰值低谷、未来向往、冲突边界等），找出最有可能成为其 Top 红点的 5 个候选。",
          "必须尊重用户主动排除的红点：candidates 中不得出现 excluded 里的任何 id。",
          "baziProfile 是用户的完整八字排盘（四柱、十神、藏干、大运），可辅助理解其行为模式，但不得据此直接决定候选，证据仍以真实回答为主。",
          "evidence 必须引用用户真实回答中的具体事件、情绪或取舍，不要编造，不要泛泛而谈。",
          "不要下最终结论，这是候选预筛，最终排序仍由用户完成。",
          "只输出一个 JSON 对象，不要 markdown，不要解释：{\"candidates\":[{\"id\":\"...\",\"evidence\":\"...\"}]}，candidates 必须正好 5 个，id 互不相同且来自给定 redDots 列表。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          redDots,
          excluded,
          turns,
          baziProfile: input.profile,
          outputShape: "Array<{id, evidence}> length 5"
        })
      }
    ]
  });

  if (!llm.ok) {
    console.warn("candidate-shortlist LLM fallback:", llm.error);
    return baseline;
  }

  return { candidates: llm.data.candidates, source: llm.source };
}

const fallbackEssentialQuestions: Record<RedDotId, string> = {
  life: "当家人需要的陪伴和你个人成长需要的时间正面冲突时，你心里最先想让步的是哪一边？",
  experience: "如果安顿好的确定性和我未知的远方只能选一个起点，你会先照顾哪一个？",
  process: "如果最合拍的一群人和最有吸引力的事业无法同时拥有，你更难割舍哪个？",
  inner: "当彻底搞懂一件事和尽快让它在现实中生效只能二选一，你会停在理解里，还是先跑起来？",
  mastery: "你愿意用多少年的重复练习去换一个领域里的顶尖？这份代价你付得起、也甘愿吗？",
  wealth: "当赚钱的机会和你看不起的做事方式绑在一起时，你选择低头还是绕路？",
  fame: "如果被看见意味着不断暴露在自己不擅长的舞台上，你还想被看见吗？",
  work: "一份让你踏实但一眼望得到头的工作，和一份刺激但你随时可能被替换的事业，你选哪个？",
  impact: "帮助别人这件事，你能接受它长期不被看见、不被感谢吗？"
};

export type RankingPrompt = {
  id: RedDotId;
  description: string;
  question: string;
};

export type RankingPrompts = {
  prompts: RankingPrompt[];
  source: string;
};

export async function createRankingPrompts(input: {
  answers: ExplorationAnswer[];
  topDots: RedDotId[];
  profile?: BaziProfile;
}): Promise<RankingPrompts> {
  const turns = input.answers.map((answer) => {
    const question = redDotQuestions.find((item) => item.id === answer.questionId);
    return {
      id: answer.questionId,
      theme: question?.theme,
      prompt: question?.prompt,
      answer: answer.text,
      confirmedRedDots: answer.confirmedRedDots,
      excludedRedDots: answer.excludedRedDots
    };
  });
  const dotMeta = input.topDots.map((id) => redDotById[id]);
  const baseline: RankingPrompts = {
    prompts: input.topDots.map((id) => {
      const dot = redDotById[id];
      const matched = input.answers.filter((answer) =>
        dot.keywords.some((keyword) => answer.text.includes(keyword))
      );
      const quote = matched.length
        ? `你的回答里有“${matched[matched.length - 1].text.slice(0, 24)}……”这样的时刻。`
        : "";
      return {
        id,
        description: `${dot.name}：${dot.trait}${quote}`,
        question: fallbackEssentialQuestions[id]
      };
    }),
    source: getGenerationSource("ranking-prompts")
  };
  const llm = await runJsonCompletion({
    task: "ranking-prompts",
    schema: rankingPromptsOutputSchema,
    temperature: 0.3,
    maxTokens: 16384,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的人生设计教练。用户已完成第 10-12 问的红点确认与强制排序，但最终倾向仍需用户自己判断。",
          "你的任务：对用户确认的 3 个红点，各写一段个性化描述和一道关键问题。",
          "description（100-160 字）：结合用户全部回答中的具体事件、情绪与取舍，描绘这个红点在用户身上的真实样子，让用户认出『这确实是我』。",
          "question（40-80 字）：为每个红点写一道最关键、最本质的抉择问题，问题必须触及两个红点之间真实的张力（排序本质是在红点之间取舍），并引用用户回答里的具体情境，帮助用户做出倾向性选择。",
          "问题要具体、扎心但不评判，禁止空泛的『你觉得重要吗』式提问。",
          "baziProfile 是用户的完整八字排盘（四柱、十神、藏干、大运），可以在 description 或 question 里作为轻量镜面参照，但主线仍是用户的真实回答。",
          "只输出一个 JSON 对象，不要 markdown，不要解释：{\"prompts\":[{\"id\":\"...\",\"description\":\"...\",\"question\":\"...\"}]}，prompts 必须正好 3 个，id 与传入 topDots 完全一致。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          topDots: input.topDots,
          redDotMeta: dotMeta.map((dot) => ({ id: dot.id, name: dot.name, trait: dot.trait, motto: dot.motto })),
          turns,
          baziProfile: input.profile,
          outputShape: "Array<{id, description, question}> length 3"
        })
      }
    ]
  });

  if (!llm.ok) {
    console.warn("ranking-prompts LLM fallback:", llm.error);
    return baseline;
  }

  return { prompts: llm.data.prompts, source: llm.source };
}

function createDiagnosisBaseline(
  answers: ExplorationAnswer[],
  context?: { profile?: BaziProfile; reflections?: MirrorContext[] }
): DiagnosisDraft {
  const scores = scoreRedDots(answers);
  const positiveScores = scores.filter((score) => score.score > 0);
  const topScores = positiveScores.length >= 3 ? positiveScores.slice(0, 3) : scores.slice(0, 3);
  const top3Reasons = topScores.map((score) => {
    const dot = redDotById[score.id];
    const firstEvidence = score.evidence[0];
    return score.score > 0
      ? `${dot.name}：来自你 ${score.evidence.length} 条真实证据的支撑，如「${firstEvidence ?? "你的回答细节"}」。`
      : `${dot.name}：暂未捕捉到足够证据，仅按红九模型默认顺序列出，仅供参考。`;
  });
  const dayMaster = context?.profile?.dayMaster;
  const dominant = context?.profile?.dominantElements?.[0];
  const lifeInterpretation = [
    dayMaster?.cue ? `从命理镜面看，你的日主线索是：${dayMaster.cue}。` : "",
    dominant?.cue ? `盘面里突出的力量是：${dominant.cue}。` : "",
    "这些线索只作参照——真正支撑这份草案的，是你在十二问里写下的那些真实经历与取舍。"
  ].filter(Boolean).join("");
  const portrait = topScores
    .map((score) => redDotById[score.id].trait)
    .join(" ");
  const personPortrait = `根据现有证据，你现在是一个同时被${topScores
    .map((score) => redDotById[score.id].shortName)
    .join("、")}牵引的人：${portrait}`;

  return {
    scores,
    topScores,
    top3Reasons,
    lifeInterpretation,
    personPortrait,
    source: getGenerationSource("diagnosis-draft")
  };
}

function buildAnswersContext(answers: ExplorationAnswer[]) {
  return answers.map((answer) => {
    const question = redDotQuestions.find((item) => item.id === answer.questionId);
    return {
      id: answer.questionId,
      theme: question?.theme,
      prompt: question?.prompt,
      answer: answer.text,
      confirmedRedDots: answer.confirmedRedDots,
      excludedRedDots: answer.excludedRedDots
    };
  });
}

export async function createDiagnosisDraft(
  answers: ExplorationAnswer[],
  context?: { profile?: BaziProfile; reflections?: MirrorContext[] }
): Promise<DiagnosisDraft> {
  const baseline = createDiagnosisBaseline(answers, context);
  const llm = await runJsonCompletion({
    task: "diagnosis-draft",
    schema: diagnosisReportOutputSchema,
    temperature: 0.3,
    maxTokens: 16384,
    timeoutMs: 180000,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的人生设计教练。",
          "用户已经答完十二问并完成红点排除与强制排序。你的任务是根据全部上下文直接输出一份完整的诊断报告，不再补问。",
          "报告包含四部分：scores（9 个红点的证据评分）与 topScores（最高 3 个）；top3Reasons（为什么这三个入选，逐条对应真实证据）；lifeInterpretation（结合八字命理知识库，对用户过往人生经历给出一段有温度、有洞察的解读，命理只作镜面参照，不命定化）；personPortrait（「现在的你是什么样的人」——综合红点组合、回答模式与命理线索，写一段具体而非套话的人格素描）。",
          "你可以参考下方附带的八字命理 Skill 知识库来写 lifeInterpretation，但结论必须以用户的真实回答为主线。",
          "baziProfile 含完整排盘：四柱干支、年/月/时柱天干十神、四个地支藏干（各带十神）、大运轨迹。写 lifeInterpretation 时可以用十神关系（如食伤表达、官杀约束、印星滋养）和大运阶段来解读用户的过往经历，让解读立体起来，但不得命定化。",
          "只输出一个 JSON 对象，不要 markdown，不要解释。",
          "scores 必须包含 9 个红点，每个 id 各出现一次；topScores 必须是 scores 中排名最高的 3 个。",
          "所有文字必须基于用户真实回答原创撰写；不要照抄任何基线、示例或规则生成的文本。",
          "evidence 必须引用用户真实回答中的生活事实、情绪、取舍或模型确认，不要编造。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          redDots,
          evidenceTags,
          answers: buildAnswersContext(answers),
          reflections: context?.reflections,
          baziProfile: context?.profile,
          baziSkillContext: loadBaziSkillContext(),
          outputShape: {
            scores: "Array<{id, score:0-100, evidence:string[]}> length 9",
            topScores: "Array of exactly top 3 score objects",
            top3Reasons: "string[] length 3-4，每条解释一个 Top 红点为何入选",
            lifeInterpretation: "结合八字对过往经历的解读，200-500 字",
            personPortrait: "现在的你是什么样的人，150-350 字"
          }
        })
      }
    ]
  });

  if (!llm.ok) return baseline;

  return {
    ...llm.data,
    source: llm.source
  };
}

export async function createSingleOdysseyPlan(input: {
  kind: OdysseyPlan["kind"];
  topDots: RedDotId[];
  direction: string;
  answers?: ExplorationAnswer[];
  profile?: BaziProfile;
  previouslyGenerated?: Array<{
    kind: string;
    title: string;
    thesis: string;
    timelineThemes: string[];
  }>;
}): Promise<{ plan: OdysseyPlan; source: string }> {
  const kind = input.kind;
  const baselinePlans = generateOdysseyPlans(input.topDots, input.direction);
  const fallbackPlan = baselinePlans.find((plan) => plan.kind === kind) ?? baselinePlans[0];
  const kindLabels: Record<OdysseyPlan["kind"], string> = {
    current: "current = 现有轨迹的优化版（沿当前资源往前走）",
    alternate: "alternate = 计划一消失后的转向版（假如现在的路径突然不存在）",
    ideal: "ideal = 不考虑金钱、形象与他人期待的版本"
  };
  const previouslyGenerated = input.previouslyGenerated ?? [];

  const llm = await runJsonCompletion({
    task: "odyssey-plan",
    schema: odysseyPlanOutputSchema,
    temperature: 0.55,
    maxTokens: 8192,
    timeoutMs: 120000,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的人生设计教练。",
          "你要基于用户确认的 Top 3 人生红点和探索方向，生成五年奥德赛计划（斯坦福人生设计课方法）。",
          "三版的设定：current = 现有轨迹的优化版（沿当前资源往前走）；alternate = 计划一消失后的转向版（假如现在的路径突然不存在）；ideal = 不考虑金钱、形象与他人期待的版本。",
          "每版必须包含：五年时间线（每年一个主题 + 具体动作）、四维仪表盘（资源/喜爱/自信/一致性 0-10 分）、风险排查（3 个障碍 + 排查方式）、原型实验（2 个低成本可执行的体验式学习）、以及 3 张路径卡。",
          "路径卡规则：能力卡（细分类别如技术能力/专项能力/管理能力）、资源卡（细分类别如 人脉团队/商业资产/认知声誉）、进步卡（细分类别如实践驱动/认知驱动/体系驱动）各一张，每张卡 2-4 条具体可执行的动作。",
          "计划必须个性化：结合用户十二问的真实回答、命理镜面的完整排盘（baziProfile 含四柱、十神、藏干、大运轨迹，可作为节奏与性格参照）来写，不要写成通用模板。计划要具体、可低成本试验，不要鸡汤化，不要命定化，不要替用户做绝对判断。",
          "注意：risks 和 prototypes 必须是字符串数组，每项一句话（风险一项里写清障碍和排查方式），不要写成对象。",
          `本次只生成 kind = ${kind} 的那一版：${kindLabels[kind]}。`,
          previouslyGenerated.length
            ? "已经为用户生成的前几版见 previouslyGenerated，这一版必须在定位、标题、五年主题上与它们明显区分，不能重复相同的路径叙事。"
            : "这是三版中的第一版。",
          "只输出一个 JSON 对象，不要 markdown，不要解释。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          kind,
          direction: input.direction || "一个更适合自己的职业方向",
          topRedDots: input.topDots.map((id) => redDotById[id]),
          allRedDots: redDots,
          answers: input.answers ? buildAnswersContext(input.answers) : undefined,
          baziProfile: input.profile,
          previouslyGenerated: previouslyGenerated.length ? previouslyGenerated : undefined,
          outputShape: "One plan object: title, kind, thesis(不超过 300 字), dashboard(键名固定为 resources/love/confidence/coherence，0-10 整数), timeline 长度 5(每项 {year: \"第1年\"..\"第5年\" 字符串, theme: 不超过 24 字, focus: 一句具体描述}), risks 长度 3, prototypes 长度 2, firstYearCards 长度 3 (每张卡有 type 能力/资源/进步, category, title, actions 为 2-4 条字符串数组). 所有文字必须原创撰写，不要照抄任何基线或示例。"
        })
      }
    ]
  });

  const plan: OdysseyPlan = llm.ok
    ? { ...llm.data, kind }
    : fallbackPlan;
  if (!llm.ok) {
    console.warn(`odyssey-plan:${kind} LLM fallback:`, llm.error);
  }
  return {
    plan,
    source: llm.ok ? llm.source : getGenerationSource(`odyssey-plan:${kind}`)
  };
}
