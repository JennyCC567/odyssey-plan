export type ElementKey = "wood" | "fire" | "earth" | "metal" | "water";

export type RedDotId =
  | "life"
  | "experience"
  | "process"
  | "inner"
  | "mastery"
  | "wealth"
  | "fame"
  | "work"
  | "impact";

export type RedDot = {
  id: RedDotId;
  name: string;
  shortName: string;
  quadrant: string;
  trait: string;
  motto: string;
  keywords: string[];
};

export type EvidenceTagId =
  | "stability"
  | "novelty"
  | "good_people"
  | "understanding"
  | "craft"
  | "practical_return"
  | "recognition"
  | "making"
  | "helping";

export type EvidenceTag = {
  id: EvidenceTagId;
  label: string;
  description: string;
  weights: Partial<Record<RedDotId, number>>;
};

export type RedDotQuestion = {
  id: number;
  theme: string;
  prompt: string;
  probes: string[];
  evidenceTags: EvidenceTagId[];
};

export const elementMeta: Record<ElementKey, { label: string; color: string; cue: string }> = {
  wood: {
    label: "木",
    color: "#3f7d4a",
    cue: "生长、探索、连接新可能"
  },
  fire: {
    label: "火",
    color: "#c84a31",
    cue: "表达、热情、被看见"
  },
  earth: {
    label: "土",
    color: "#a06f42",
    cue: "稳定、承载、长期经营"
  },
  metal: {
    label: "金",
    color: "#a88a30",
    cue: "标准、锋利、精进"
  },
  water: {
    label: "水",
    color: "#326f87",
    cue: "洞察、流动、适应"
  }
};

export const ganZhiElementMap: Record<string, ElementKey> = {
  甲: "wood",
  乙: "wood",
  寅: "wood",
  卯: "wood",
  丙: "fire",
  丁: "fire",
  巳: "fire",
  午: "fire",
  戊: "earth",
  己: "earth",
  辰: "earth",
  戌: "earth",
  丑: "earth",
  未: "earth",
  庚: "metal",
  辛: "metal",
  申: "metal",
  酉: "metal",
  壬: "water",
  癸: "water",
  子: "water",
  亥: "water"
};

export const redDots: RedDot[] = [
  {
    id: "life",
    name: "生活型",
    shortName: "生活",
    quadrant: "现实主义 / 追求过程",
    trait: "重视家庭生活的和谐与美满，把关系、安稳和真实生活放在重要位置。",
    motto: "出门是谋生，回家才是生活。",
    keywords: ["家庭", "陪伴", "稳定", "生活", "健康", "平衡", "亲密", "日常"]
  },
  {
    id: "experience",
    name: "体验型",
    shortName: "体验",
    quadrant: "现实主义 / 追求过程",
    trait: "渴望丰富体验、挑战、新奇和变化，喜欢探索世界与人生的不同可能。",
    motto: "世界那么大，我想去看看。",
    keywords: ["自由", "探索", "旅行", "体验", "变化", "冒险", "新鲜", "挑战"]
  },
  {
    id: "process",
    name: "过程型",
    shortName: "过程",
    quadrant: "现实主义 / 追求过程",
    trait: "看重同行者、团队氛围和过程质量，享受与优秀的人一起共事。",
    motto: "目的地不重要，与谁同行最重要。",
    keywords: ["团队", "伙伴", "氛围", "环境", "协作", "共事", "关系", "文化"]
  },
  {
    id: "inner",
    name: "内心型（求知）",
    shortName: "求知",
    quadrant: "理想主义 / 追求过程",
    trait: "以学习、理解和洞察世界为内在驱动力，享受认知被点亮的过程。",
    motto: "我想搞明白世界的底层运作逻辑。",
    keywords: ["学习", "研究", "理解", "知识", "洞察", "逻辑", "本质", "思考"]
  },
  {
    id: "mastery",
    name: "高手型（匠人）",
    shortName: "高手",
    quadrant: "理想主义 / 追求过程",
    trait: "追求在特定领域达到高水平，重视技艺、标准、长期练习和自我认同。",
    motto: "匠人精神，精益求精。",
    keywords: ["专业", "技能", "高手", "精进", "练习", "作品质量", "标准", "专注"]
  },
  {
    id: "wealth",
    name: "赚钱型",
    shortName: "赚钱",
    quadrant: "现实主义 / 追求结果",
    trait: "以财富积累、商业结果和财务自由为核心目标，重视可量化的回报。",
    motto: "人生最终极的自由，是财务自由。",
    keywords: ["钱", "收入", "商业", "回报", "财务自由", "资产", "变现", "利润"]
  },
  {
    id: "fame",
    name: "出名型",
    shortName: "出名",
    quadrant: "现实主义 / 追求结果",
    trait: "渴望获得社会声望、影响力和公众认可，享受被看见和被记住。",
    motto: "出名要趁早。",
    keywords: ["影响力", "出名", "认可", "声望", "曝光", "粉丝", "表达", "舞台"]
  },
  {
    id: "work",
    name: "作品型",
    shortName: "作品",
    quadrant: "理想主义 / 追求结果",
    trait: "希望创造能长久影响他人的作品、产品、内容或组织成果。",
    motto: "用作品证明我来过这个世界。",
    keywords: ["作品", "产品", "创造", "内容", "留下", "项目", "影响", "表达"]
  },
  {
    id: "impact",
    name: "成就型（利他）",
    shortName: "成就",
    quadrant: "理想主义 / 追求结果",
    trait: "以社会价值、帮助他人和推动改变为核心人生目标。",
    motto: "你能为别人创造多大价值，你就有多大价值。",
    keywords: ["帮助", "改变", "价值", "教育", "公益", "社会", "赋能", "解决问题"]
  }
];

export const redDotById = Object.fromEntries(redDots.map((item) => [item.id, item])) as Record<RedDotId, RedDot>;

export const evidenceTags: EvidenceTag[] = [
  {
    id: "stability",
    label: "稳定与亲密",
    description: "你在保护关系、生活秩序、健康感或可持续节奏。",
    weights: { life: 4, process: 1, wealth: 1 }
  },
  {
    id: "novelty",
    label: "探索与变化",
    description: "你会被新体验、自由度、挑战和未知可能激活。",
    weights: { experience: 4, inner: 1, fame: 1 }
  },
  {
    id: "good_people",
    label: "同行者质量",
    description: "你反复在意和谁一起做事、团队氛围和过程体验。",
    weights: { process: 4, life: 1, mastery: 1 }
  },
  {
    id: "understanding",
    label: "理解与洞察",
    description: "你享受把事情想明白、看见底层逻辑和持续学习。",
    weights: { inner: 4, mastery: 1, work: 1 }
  },
  {
    id: "craft",
    label: "精进与标准",
    description: "你在意专业水平、长期练习、质量和能否成为高手。",
    weights: { mastery: 4, work: 2, inner: 1 }
  },
  {
    id: "practical_return",
    label: "回报与自由",
    description: "你在意收入、资源、商业结果，或用现实回报换取自由。",
    weights: { wealth: 4, life: 1, fame: 1 }
  },
  {
    id: "recognition",
    label: "被看见与认可",
    description: "你会被舞台、声望、表达权和外部认可明显激活。",
    weights: { fame: 4, work: 1, wealth: 1 }
  },
  {
    id: "making",
    label: "创造与作品",
    description: "你想把想法做成可被看见、可沉淀、可复用的成果。",
    weights: { work: 4, mastery: 1, impact: 1 }
  },
  {
    id: "helping",
    label: "帮助与改变",
    description: "你会因帮助他人、解决问题或创造社会价值而获得意义。",
    weights: { impact: 4, work: 1, process: 1 }
  }
];

export const evidenceTagById = Object.fromEntries(evidenceTags.map((item) => [item.id, item])) as Record<EvidenceTagId, EvidenceTag>;

export const redDotQuestions: RedDotQuestion[] = [
  {
    id: 1,
    theme: "关键选择",
    prompt: "回忆你过去做过的关键人生决策，你为什么那样选？背后有没有反复出现的逻辑？",
    probes: ["当时你放弃了什么？", "别人如何评价这个选择？", "如果重来一次，你还会这样选吗？"],
    evidenceTags: ["practical_return", "stability", "understanding", "craft", "helping"]
  },
  {
    id: 2,
    theme: "峰值瞬间",
    prompt: "过去有哪些特别开心、充实或兴奋的时刻？那些时刻具体发生了什么？",
    probes: ["你是在被看见、学会新东西、完成作品，还是和某些人在一起？", "这种感觉后来是否重复出现过？"],
    evidenceTags: ["novelty", "good_people", "recognition", "making", "understanding"]
  },
  {
    id: 3,
    theme: "低谷瞬间",
    prompt: "过去有哪些特别沮丧、失望或厌恶的时刻？它们暴露了你不愿忍受什么？",
    probes: ["你最抗拒的是无意义、低标准、失控、贫穷、无聊，还是关系消耗？", "当时你最想逃离什么？"],
    evidenceTags: ["stability", "craft", "good_people", "helping", "novelty"]
  },
  {
    id: 4,
    theme: "对标标杆",
    prompt: "你特别想对标谁？他们身上哪些故事、状态或能力打动你？",
    probes: ["你羡慕的是结果、过程、关系、表达权，还是创造力？", "他们的人生里有哪些代价你也愿意承受？"],
    evidenceTags: ["craft", "recognition", "making", "practical_return", "helping"]
  },
  {
    id: 5,
    theme: "无限想象",
    prompt: "如果钱不是问题、也不用证明给任何人看，你这一生最想做成什么？",
    probes: ["你希望别人如何评价你的一生？", "什么事情成功了，会让你觉得这一生很值得？"],
    evidenceTags: ["making", "helping", "novelty", "stability", "understanding"]
  },
  {
    id: 6,
    theme: "具体画面",
    prompt: "想象一个最美好的工作与生活日常：你在哪里、和谁一起、在做什么、被什么节奏包围？",
    probes: ["你最向往的画面里有什么？", "哪些画面一出现，你就知道自己不想要？"],
    evidenceTags: ["stability", "good_people", "novelty", "craft", "recognition"]
  },
  {
    id: 7,
    theme: "挖掘共性",
    prompt: "把过去的选择、开心瞬间和未来向往放在一起看，有哪些共同主题？",
    probes: ["这些共同点背后是能力偏好，还是价值追求？", "它们更像过程满足，还是结果满足？"],
    evidenceTags: ["understanding", "craft", "good_people", "making", "helping"]
  },
  {
    id: 8,
    theme: "找寻冲突",
    prompt: "你过去有没有做过价值判断很不一致的选择？那些冲突背后分别在保护什么？",
    probes: ["你是在安全感和自由之间摇摆，还是在自我实现和外部认可之间摇摆？", "哪些冲突到今天还没被解决？"],
    evidenceTags: ["stability", "novelty", "practical_return", "recognition", "helping"]
  },
  {
    id: 9,
    theme: "内核边界",
    prompt: "未来你最想持续做的事情类型是什么？哪些事越过边界你就不想要了？",
    probes: ["你想守住的内核是什么？", "你绝不愿长期忍受的工作方式、关系或生活状态是什么？"],
    evidenceTags: ["craft", "understanding", "stability", "good_people", "making"]
  },
  {
    id: 10,
    theme: "红点排除",
    prompt: "九个红点里，哪些你可以先排除？如果必要，你愿意妥协或舍弃哪些？",
    probes: ["你排除它，是因为不喜欢，还是只是现在不紧急？", "哪个红点做不到也不会让你人生失色？"],
    evidenceTags: ["practical_return", "recognition", "stability", "novelty", "good_people"]
  },
  {
    id: 11,
    theme: "设置底线",
    prompt: "哪些方面你只需要达到 60 分就可以？如果它们稳定及格，你的人生是否已经足够 ok？",
    probes: ["钱、名、稳定、自由、陪伴、作品、贡献分别到什么水平算及格？", "哪些绝不只是底线，而是核心目标？"],
    evidenceTags: ["stability", "practical_return", "recognition", "novelty", "helping"]
  },
  {
    id: 12,
    theme: "最终取舍",
    prompt: "如果未来三年只允许把一个红点作为主轴全力推进，且必须为此接受真实的代价，你会选哪个？",
    probes: ["Top 1 和 Top 2 若只能活一个，你保哪个？用一句话说服自己。", "为了主轴红点，你愿意放弃或暂时搁置什么？这个代价你承受得起吗？", "这个选择是你真实想要的，还是你觉得自己应该想要的？"],
    evidenceTags: ["helping", "making", "craft", "understanding", "novelty"]
  }
];

export const elementToRedDotHints: Record<ElementKey, RedDotId[]> = {
  wood: ["experience", "inner", "impact"],
  fire: ["fame", "work", "experience"],
  earth: ["life", "process", "wealth"],
  metal: ["mastery", "work", "wealth"],
  water: ["inner", "experience", "process"]
};
