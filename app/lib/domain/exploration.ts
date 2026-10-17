import { createBaziReflection, type BaziProfile } from "../bazi";
import { getGenerationSource, runJsonCompletion } from "../llm/client";
import { baziReflectionOutputSchema, diagnosisDraftOutputSchema, odysseyPlansOutputSchema } from "../llm/schemas";
import {
  analyzeDiagnosis,
  generateOdysseyPlans,
  inferEvidenceTagsFromText,
  scoreRedDots,
  type DiagnosisAnalysis,
  type ExplorationAnswer,
  type OdysseyPlan,
  type RedDotScore
} from "../odyssey";
import { evidenceTags, redDotById, redDots, type EvidenceTagId, type RedDotId } from "../theory";

export type DiagnosisDraft = {
  scores: RedDotScore[];
  analysis: DiagnosisAnalysis;
  topScores: RedDotScore[];
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
  const baseline = {
    reflection: createBaziReflection(input.profile, input.answeredCount, input.latestAnswer),
    source: "bazi-reflection:rules-fallback"
  };
  const llm = await runJsonCompletion({
    task: "bazi-reflection",
    schema: baziReflectionOutputSchema,
    temperature: 0.45,
    maxTokens: 2400,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的命理镜像教练。",
          "产品背景：Pathfinder 是基于人生红点理论的 AI 人生设计教练，服务于方向模糊、动力不足、路径断裂的年轻人。用户正在通过十二问回看过去选择、峰值低谷、未来向往、冲突边界和取舍排序，目标是形成被用户认可的红点共识，再进入三版五年奥德赛计划。",
          "你的任务不是诊断红点，而是在每完成三问后，把用户这一轮回答放回命理镜面中做一次温和复盘，帮助用户坚持回答、看见惯性、提出下一轮观察角度。",
          "请参考八字命理分析 Skill 的风格：先看四柱、日主、五行分布、节气与大运线索，再用旺衰、调候、喜用神、自然验证问题的思路做轻量镜像。",
          "重要边界：命理只作为兴趣入口和自我观察线索，不参与红点评分，不替用户做人生决定，不做命定论，不说灾祸、婚恋断言、绝对职业判断。",
          "必须综合 recentAnswers 中最近三题，不要只复述 latestAnswer；要指出三题之间的共同线索、张力或变化。",
          "如果 recentAnswers 至少有 2 条，回应中必须同时提到至少两条回答里的具体事实或关键词；禁止以“你刚才提到”开头。",
          "不要写成泛泛模板，例如“更像是在校准什么让我有能量、什么让我消耗”。请根据三题内容重新组织语言。",
          "不要输出思考过程，不要解释你如何分析，只给最终镜像文本。",
          "如果 answeredCount 小于 10，避免直接给出红点类型名称；如果 answeredCount 为 10-12，可以只围绕用户主动确认/排除的排序做镜像，不重新判分。",
          "你要围绕最近三问的题目与回答，输出一段 160-260 字的中文镜像回应。",
          "结构建议：1）先概括这一轮三题里反复保护的东西、能量来源或边界；2）再用一个命理线索做类比，例如日主、突出五行、季节调候或大运节奏；3）最后给一个下一轮可继续观察的问题。",
          "只输出 JSON：{\"reflection\":\"...\"}。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          question: input.question,
          answer: input.latestAnswer,
          recentAnswers: input.answers?.slice(-3),
          answeredCount: input.answeredCount,
          explorationStage: stageName,
          baziProfile: input.profile,
          skillMethodNotes: {
            wangshuai: "按得令、得地、得势观察日主强弱，但这里只做启发，不下专业定论。",
            yongshen: "可提到调候、扶抑、病药、通关的观察角度，但不宣称最终喜用神。",
            validation: "用季节、颜色、方位、年份感受作为自然验证问题。"
          }
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
    source: llm.source
  };
}

function createDiagnosisBaseline(answers: ExplorationAnswer[]): DiagnosisDraft {
  const scores = scoreRedDots(answers);
  const analysis = analyzeDiagnosis(scores);
  const positiveScores = scores.filter((score) => score.score > 0);
  const topScores = positiveScores.length >= 3 ? positiveScores.slice(0, 3) : scores.slice(0, 3);

  return {
    scores,
    analysis,
    topScores,
    source: getGenerationSource("diagnosis-draft")
  };
}

export async function createDiagnosisDraft(answers: ExplorationAnswer[]): Promise<DiagnosisDraft> {
  const baseline = createDiagnosisBaseline(answers);
  const llm = await runJsonCompletion({
    task: "diagnosis-draft",
    schema: diagnosisDraftOutputSchema,
    temperature: 0.2,
    maxTokens: 3600,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的人生设计教练。",
          "你的任务是基于用户十二问回答，生成红九模型诊断草案。",
          "必须保护不确定性：证据不足、Top 候选分差很小、第三/第四边界不清时，status 必须是 needs_follow_up，并给出最多 2 个真实取舍补问。",
          "八字命理只可作为陪伴式语言，不能参与红点评分。",
          "只输出一个 JSON 对象，不要 markdown，不要解释。",
          "scores 必须包含 9 个红点，每个 id 各出现一次；topScores 必须是 scores 中排名最高的 3 个。",
          "evidence 必须引用用户真实回答中的生活事实、情绪、取舍或模型确认，不要编造。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          redDots,
          evidenceTags,
          answers,
          rulesBaseline: baseline,
          outputShape: {
            scores: "Array<{id, score:0-100, evidence:string[]}> length 9",
            analysis: "{status:'confident'|'needs_follow_up', reasons:string[], followUpQuestions:Array<{id,prompt,candidates,evidenceTags}>}",
            topScores: "Array of exactly top 3 score objects"
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

export async function createOdysseyPlans(input: { topDots: RedDotId[]; direction: string }): Promise<OdysseyPlansResult> {
  const baseline = {
    plans: generateOdysseyPlans(input.topDots, input.direction),
    source: getGenerationSource("odyssey-plan")
  };
  const llm = await runJsonCompletion({
    task: "odyssey-plan",
    schema: odysseyPlansOutputSchema,
    temperature: 0.55,
    maxTokens: 5200,
    messages: [
      {
        role: "system",
        content: [
          "你是人生罗盘 Pathfinder 的人生设计教练。",
          "你要基于用户确认的 Top 3 人生红点和探索方向，生成三版五年奥德赛计划。",
          "必须严格使用斯坦福人生设计课的奥德赛计划思路：当前轨道、备用轨道、理想轨道；每版要有五年时间线、四维仪表盘、风险排查、原型实验、第一年路径卡。",
          "计划要具体、可低成本试验，不要鸡汤化，不要命定化，不要替用户做绝对判断。",
          "只输出一个 JSON 对象，不要 markdown，不要解释。",
          "plans 必须正好 3 个，kind 分别为 current、alternate、ideal。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          direction: input.direction || "一个更适合自己的职业方向",
          topRedDots: input.topDots.map((id) => redDotById[id]),
          allRedDots: redDots,
          rulesBaseline: baseline,
          outputShape: {
            plans: "Array length 3. Each plan has title, kind, thesis, dashboard, timeline length 5, risks length 3, prototypes length 2, firstYearCards length 3."
          }
        })
      }
    ]
  });

  if (!llm.ok) return baseline;

  return {
    plans: llm.data.plans,
    source: llm.source
  };
}
