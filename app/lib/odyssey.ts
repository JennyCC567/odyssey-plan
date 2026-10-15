import { evidenceTagById, evidenceTags, redDotById, redDots, type EvidenceTagId, type RedDotId } from "./theory";

export type ExplorationAnswer = {
  questionId: number;
  text: string;
  tags: EvidenceTagId[];
  confirmedRedDots?: RedDotId[];
};

export type RedDotScore = {
  id: RedDotId;
  score: number;
  evidence: string[];
};

export type FollowUpQuestion = {
  id: string;
  prompt: string;
  candidates: RedDotId[];
  evidenceTags: EvidenceTagId[];
};

export type DiagnosisAnalysis = {
  status: "confident" | "needs_follow_up";
  reasons: string[];
  followUpQuestions: FollowUpQuestion[];
};

export type OdysseyPlan = {
  title: string;
  kind: "current" | "alternate" | "ideal";
  thesis: string;
  dashboard: {
    resources: number;
    love: number;
    confidence: number;
    coherence: number;
  };
  timeline: Array<{
    year: string;
    theme: string;
    focus: string;
  }>;
  risks: string[];
  prototypes: string[];
  firstYearCards: Array<{
    title: string;
    type: "能力" | "资源" | "进步";
    actions: string[];
  }>;
};

const keywordWeights = redDots.flatMap((dot) =>
  dot.keywords.map((keyword) => ({
    keyword,
    id: dot.id
  }))
);

export function scoreRedDots(answers: ExplorationAnswer[]): RedDotScore[] {
  const scoreMap = new Map<RedDotId, RedDotScore>();

  redDots.forEach((dot) => {
    scoreMap.set(dot.id, {
      id: dot.id,
      score: 0,
      evidence: []
    });
  });

  answers.forEach((answer) => {
    answer.tags.forEach((tag) => {
      const evidenceTag = evidenceTagById[tag];
      if (!evidenceTag) return;

      Object.entries(evidenceTag.weights).forEach(([redDotId, weight]) => {
        const item = scoreMap.get(redDotId as RedDotId);
        if (!item || !weight) return;
        item.score += answer.questionId >= 10 ? weight * 1.5 : weight;
        item.evidence.push(`Q${answer.questionId} 出现“${evidenceTag.label}”线索`);
      });
    });

    answer.confirmedRedDots?.forEach((redDotId) => {
      const item = scoreMap.get(redDotId);
      if (!item) return;
      item.score += 6;
      item.evidence.push(`Q${answer.questionId} 在模型解释后确认了“${redDotById[redDotId].shortName}”假设`);
    });

    keywordWeights.forEach(({ keyword, id }) => {
      if (!answer.text.includes(keyword)) return;
      const item = scoreMap.get(id);
      if (!item) return;
      item.score += 2;
      item.evidence.push(`Q${answer.questionId} 提到了“${keyword}”`);
    });

    if (answer.text.trim().length > 30) {
      answer.tags.forEach((tag) => {
        const evidenceTag = evidenceTagById[tag];
        if (!evidenceTag) return;

        Object.keys(evidenceTag.weights).forEach((redDotId) => {
          const item = scoreMap.get(redDotId as RedDotId);
          if (item) item.score += 0.5;
        });
      });
    }
  });

  return Array.from(scoreMap.values())
    .map((item) => ({
      ...item,
      evidence: Array.from(new Set(item.evidence)).slice(0, 3)
    }))
    .sort((a, b) => b.score - a.score);
}

const MIN_TOP_SCORE = 12;
const CLOSE_SCORE_MARGIN = 2;

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function getEvidenceTagsForCandidates(candidates: RedDotId[]): EvidenceTagId[] {
  const rankedTags = evidenceTags
    .map((tag) => ({
      id: tag.id,
      weight: Math.max(...candidates.map((candidate) => tag.weights[candidate] ?? 0))
    }))
    .filter((tag) => tag.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((tag) => tag.id);

  return rankedTags.length ? rankedTags.slice(0, 5) : evidenceTags.slice(0, 5).map((tag) => tag.id);
}

function createFollowUpQuestion(
  kind: "low_evidence" | "top_conflict" | "third_boundary",
  candidates: RedDotId[],
  index: number
): FollowUpQuestion {
  const safeCandidates = unique(candidates).slice(0, 4);
  const names = safeCandidates.map((candidate) => redDotById[candidate].name).join(" / ");
  const promptByKind = {
    low_evidence: "目前证据还比较散。请补充一个最近 1-3 年真实发生的选择：当时你最想保护什么，最后为它付出了什么代价？",
    top_conflict: `现在最需要区分 ${names}。请举一个它们互相冲突时你真实做过的选择：你优先保护了哪一个，放弃了哪一个？`,
    third_boundary: `Top 3 的边界还不稳定，尤其是 ${names}。请补一个能证明“它必须进入前三”或“它只是底线需求”的具体经历。`
  };

  return {
    id: `${kind}-${safeCandidates.join("-")}-${index}`,
    prompt: promptByKind[kind],
    candidates: safeCandidates,
    evidenceTags: getEvidenceTagsForCandidates(safeCandidates)
  };
}

export function analyzeDiagnosis(scores: RedDotScore[]): DiagnosisAnalysis {
  const ranked = scores.filter((score) => score.score > 0);
  const fallbackCandidates = scores.slice(0, 3).map((score) => score.id);
  const top1 = ranked[0];
  const top2 = ranked[1];
  const top3 = ranked[2];
  const top4 = ranked[3];
  const reasons: string[] = [];
  const followUpQuestions: FollowUpQuestion[] = [];

  function addFollowUp(kind: "low_evidence" | "top_conflict" | "third_boundary", candidates: RedDotId[]) {
    const safeCandidates = unique(candidates.length ? candidates : fallbackCandidates).slice(0, 4);
    if (!safeCandidates.length) return;

    const key = `${kind}-${safeCandidates.join("-")}`;
    if (followUpQuestions.some((question) => question.id.startsWith(key))) return;

    followUpQuestions.push(createFollowUpQuestion(kind, safeCandidates, followUpQuestions.length + 1));
  }

  if (!top1 || top1.score < MIN_TOP_SCORE) {
    reasons.push("核心线索强度还不够，不适合直接下 Top 3 结论。");
    addFollowUp("low_evidence", ranked.slice(0, 3).map((score) => score.id));
  }

  if (!top3 || top3.score <= 0) {
    reasons.push("还没有形成三个稳定红点候选，需要再补一条能拉开排序的证据。");
    addFollowUp("low_evidence", ranked.slice(0, 3).map((score) => score.id));
  }

  if (top1 && top2 && top1.score - top2.score <= CLOSE_SCORE_MARGIN) {
    reasons.push(`第一候选“${redDotById[top1.id].shortName}”和第二候选“${redDotById[top2.id].shortName}”分差很小。`);
    addFollowUp("top_conflict", [top1.id, top2.id]);
  }

  if (top3 && top4 && top3.score - top4.score <= CLOSE_SCORE_MARGIN) {
    reasons.push(`第三候选“${redDotById[top3.id].shortName}”和第四候选“${redDotById[top4.id].shortName}”边界不清。`);
    addFollowUp("third_boundary", [top3.id, top4.id]);
  }

  return {
    status: reasons.length ? "needs_follow_up" : "confident",
    reasons: reasons.slice(0, 3),
    followUpQuestions: followUpQuestions.slice(0, 2)
  };
}

export function generateOdysseyPlans(topDots: RedDotId[], direction: string): OdysseyPlan[] {
  const safeDots: RedDotId[] = topDots.length ? topDots : ["inner", "work", "impact"];
  const [first, second = "work", third = "experience"] = safeDots;
  const main = redDotById[first];
  const support = redDotById[second];
  const fallback = redDotById[third];
  const target = direction.trim() || "一个更适合自己的职业方向";

  return [
    {
      kind: "current",
      title: `在现实轨道里靠近${main.shortName}`,
      thesis: `沿着当前资源继续前进，但把选择标准从“应该做什么”改成“是否服务于${main.name}”。方向暂定为：${target}。`,
      dashboard: {
        resources: 7,
        love: 6,
        confidence: 7,
        coherence: 8
      },
      timeline: [
        { year: "Year 1", theme: "校准", focus: `用小项目验证${target}是否真的承载${main.shortName}。` },
        { year: "Year 2", theme: "扎根", focus: `形成一个可展示的能力组合，并找到稳定反馈来源。` },
        { year: "Year 3", theme: "放大", focus: `进入更高质量的平台、团队或用户场景。` },
        { year: "Year 4", theme: "整合", focus: `把${support.shortName}纳入生活结构，减少长期消耗。` },
        { year: "Year 5", theme: "成形", focus: `沉淀个人方法论，形成可持续的人生版本。` }
      ],
      risks: ["只是优化现状，没有真正做选择", "被外部评价拉回旧轨道", "缺少可验证的里程碑"],
      prototypes: ["约 3 位已经在目标方向工作的人做人生设计访谈", "用 2 周完成一个最小作品或调研报告"],
      firstYearCards: [
        {
          type: "能力",
          title: "核心能力卡",
          actions: ["列出目标方向的 3 个硬技能", "每周固定 2 次深度练习", "月底输出一次作品复盘"]
        },
        {
          type: "资源",
          title: "同行者卡",
          actions: ["找到 5 个可访谈对象", "加入 1 个高质量社群", "每月主动建立 2 次弱连接"]
        },
        {
          type: "进步",
          title: "反馈循环卡",
          actions: ["每周记录能量变化", "每月对照红点排序复盘", "每季度调整一次路径假设"]
        }
      ]
    },
    {
      kind: "alternate",
      title: `如果当前路径消失，转向${support.shortName}版本`,
      thesis: `假设现在的主路径不再成立，你可以围绕${support.name}重新组织职业与生活，寻找更强的内在动力。`,
      dashboard: {
        resources: 5,
        love: 8,
        confidence: 5,
        coherence: 7
      },
      timeline: [
        { year: "Year 1", theme: "试水", focus: `用低成本副线测试${support.shortName}是否只是羡慕，还是能长期投入。` },
        { year: "Year 2", theme: "转译", focus: `把已有能力迁移到新场景，避免从零开始。` },
        { year: "Year 3", theme: "站稳", focus: `建立代表作、客户、证书或可被认可的成果。` },
        { year: "Year 4", theme: "扩张", focus: `把副线扩成主要身份之一。` },
        { year: "Year 5", theme: "选择", focus: `决定是否正式切换人生主线。` }
      ],
      risks: ["把逃离误认为热爱", "资源储备不足", "切换成本被低估"],
      prototypes: ["做一次周末角色扮演：完整体验这个方向的一天", "完成一轮公开输出，观察外部反馈"],
      firstYearCards: [
        {
          type: "能力",
          title: "迁移能力卡",
          actions: ["盘点当前能力可迁移部分", "补齐 1 个关键短板", "做一次公开演示"]
        },
        {
          type: "资源",
          title: "安全网卡",
          actions: ["预估 6 个月现金流", "找到 2 位转型前辈", "建立备选机会清单"]
        },
        {
          type: "进步",
          title: "试错节奏卡",
          actions: ["每两周一次原型实验", "记录喜欢度和自信度", "连续 3 个月后再判断"]
        }
      ]
    },
    {
      kind: "ideal",
      title: `不考虑评价的${fallback.shortName}人生`,
      thesis: `暂时放下收入、身份和他人期待，只看什么会让你觉得人生真的值得。这个版本围绕${fallback.name}展开。`,
      dashboard: {
        resources: 4,
        love: 9,
        confidence: 4,
        coherence: 9
      },
      timeline: [
        { year: "Year 1", theme: "允许", focus: `允许自己认真承认对${fallback.shortName}的向往。` },
        { year: "Year 2", theme: "表达", focus: `用作品、项目或生活实验让它具体化。` },
        { year: "Year 3", theme: "连接", focus: `找到同频的人与场域，不再单独幻想。` },
        { year: "Year 4", theme: "复利", focus: `让热爱形成能力、声誉或生活方式复利。` },
        { year: "Year 5", theme: "整合", focus: `把理想版本的一部分并入现实版本。` }
      ],
      risks: ["过度理想化", "缺少现实承载结构", "只停留在想象，没有原型实验"],
      prototypes: ["安排一次完全按理想版本生活的 24 小时", "用 30 天完成一个只为自己热爱的输出"],
      firstYearCards: [
        {
          type: "能力",
          title: "热爱具象卡",
          actions: ["写下理想版本的 10 个日常片段", "选择 1 个片段做成项目", "保留每周固定时间"]
        },
        {
          type: "资源",
          title: "同频连接卡",
          actions: ["关注 10 个相关样本", "访谈 2 个活成类似版本的人", "加入 1 个线下或线上场域"]
        },
        {
          type: "进步",
          title: "现实整合卡",
          actions: ["标记最小可并入现实生活的部分", "每月评估资源消耗", "季度决定保留或调整"]
        }
      ]
    }
  ];
}
