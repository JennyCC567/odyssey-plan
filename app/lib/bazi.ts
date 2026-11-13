import { ganZhiElementMap, elementMeta, elementToRedDotHints, type ElementKey, type RedDotId } from "./theory";

export type BaziCalculatorResult = {
  input: {
    gregorian_local: string;
    timezone: string;
    lat: number;
    lon: number;
    true_solar_time: boolean;
  };
  lunar: {
    date: {
      month_no: number;
      month_cn: string;
      is_leap_month: boolean;
      day: number;
      day_cn: string;
      shichen: string;
      minute: number;
    };
    gan_zhi: {
      year: string;
      month: string;
      day: string;
      hour: string;
      four_pillars: string;
    };
    jieqi: {
      current_jieqi: string;
      current_jieqi_time_local: string;
      next_jieqi: string;
      next_jieqi_time_local: string;
    };
  };
  dayun: {
    start_age_description: string;
    direction: string;
    dayun_list: Array<{
      gan_zhi: string;
      start_age: number;
      end_age: number;
      age_range: string;
      year_range: string;
    }>;
  };
};

export type ElementDistribution = Record<ElementKey, number>;

export type TenGod =
  | "比肩"
  | "劫财"
  | "食神"
  | "伤官"
  | "偏财"
  | "正财"
  | "七杀"
  | "正官"
  | "偏印"
  | "正印";

const STEM_INFO: Array<{ char: string; element: ElementKey; yang: boolean }> = [
  { char: "甲", element: "wood", yang: true },
  { char: "乙", element: "wood", yang: false },
  { char: "丙", element: "fire", yang: true },
  { char: "丁", element: "fire", yang: false },
  { char: "戊", element: "earth", yang: true },
  { char: "己", element: "earth", yang: false },
  { char: "庚", element: "metal", yang: true },
  { char: "辛", element: "metal", yang: false },
  { char: "壬", element: "water", yang: true },
  { char: "癸", element: "water", yang: false }
];

// 五行相生：木生火、火生土、土生金、金生水、水生木
const GENERATES: Record<ElementKey, ElementKey> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood"
};

// 五行相克：木克土、土克水、水克火、火克金、金克木
const CONTROLS: Record<ElementKey, ElementKey> = {
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood"
};

// 地支藏干（主气在前）
const BRANCH_HIDDEN: Record<string, string[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"]
};

export function tenGodRelation(dayStem: string, otherStem: string): TenGod {
  const day = STEM_INFO.find((item) => item.char === dayStem);
  const other = STEM_INFO.find((item) => item.char === otherStem);
  if (!day || !other) return "比肩";
  const samePolarity = day.yang === other.yang;
  if (other.element === day.element) return samePolarity ? "比肩" : "劫财";
  if (GENERATES[day.element] === other.element) return samePolarity ? "食神" : "伤官";
  if (CONTROLS[day.element] === other.element) return samePolarity ? "偏财" : "正财";
  if (CONTROLS[other.element] === day.element) return samePolarity ? "七杀" : "正官";
  return samePolarity ? "偏印" : "正印";
}

export type BaziProfile = {
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
    fourPillars: string;
  };
  dayMaster: {
    stem: string;
    element: ElementKey;
    label: string;
    cue: string;
  };
  dominantElements: Array<{
    element: ElementKey;
    label: string;
    count: number;
    cue: string;
  }>;
  distribution: ElementDistribution;
  currentJieqi: string;
  nextJieqi: string;
  startLuck: string;
  currentLuck?: {
    ganZhi: string;
    ageRange: string;
    yearRange: string;
  };
  redDotHints: RedDotId[];
  openingInsights: string[];
  tenGods?: {
    year: TenGod;
    month: TenGod;
    hour: TenGod;
    day?: undefined;
  };
  hiddenStems?: Record<"year" | "month" | "day" | "hour", Array<{
    char: string;
    element: ElementKey;
    label: string;
    tenGod: TenGod;
  }>>;
  luckPillars?: Array<{
    ganZhi: string;
    ageRange: string;
    yearRange: string;
  }>;
};

const emptyDistribution: ElementDistribution = {
  wood: 0,
  fire: 0,
  earth: 0,
  metal: 0,
  water: 0
};

export function getElementForChar(char: string): ElementKey {
  return ganZhiElementMap[char] ?? "earth";
}

export function createBaziProfile(result: BaziCalculatorResult, birthYear: number): BaziProfile {
  const pillars = result.lunar.gan_zhi;
  const allChars = [pillars.year, pillars.month, pillars.day, pillars.hour].join("").split("");
  const distribution = allChars.reduce<ElementDistribution>(
    (acc, char) => {
      const element = getElementForChar(char);
      acc[element] += 1;
      return acc;
    },
    { ...emptyDistribution }
  );

  const sortedElements = (Object.keys(distribution) as ElementKey[])
    .map((element) => ({
      element,
      label: elementMeta[element].label,
      cue: elementMeta[element].cue,
      count: distribution[element]
    }))
    .sort((a, b) => b.count - a.count);

  const dayStem = pillars.day[0] ?? "甲";
  const dayElement = getElementForChar(dayStem);
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - birthYear);
  const currentLuck = result.dayun.dayun_list.find((item) => age >= item.start_age && age <= item.end_age);
  const redDotHints = Array.from(
    new Set([
      ...elementToRedDotHints[dayElement],
      ...sortedElements.slice(0, 2).flatMap((item) => elementToRedDotHints[item.element])
    ])
  ).slice(0, 5);

  const openingInsights = [
    `你的日主是${dayStem}${elementMeta[dayElement].label}，我们会把它当作“自我观察入口”，而不是定论。`,
    `四柱里较突出的五行是${sortedElements
      .filter((item) => item.count > 0)
      .slice(0, 2)
      .map((item) => `${item.label}（${item.cue}）`)
      .join("、")}，适合用来引出后面的红点探索。`,
    `接下来每 3 个红点问题，我会用命理线索做一次镜像回应，帮助你坚持回答，但红点排序仍以你的回答为主。`
  ];

  const tenGods = {
    year: tenGodRelation(dayStem, pillars.year[0] ?? "甲"),
    month: tenGodRelation(dayStem, pillars.month[0] ?? "甲"),
    hour: tenGodRelation(dayStem, pillars.hour[0] ?? "甲")
  };
  const hiddenStems = (["year", "month", "day", "hour"] as const).reduce(
    (acc, key) => {
      acc[key] = BRANCH_HIDDEN[pillars[key][1] ?? "子"].map((char) => ({
        char,
        element: getElementForChar(char),
        label: elementMeta[getElementForChar(char)].label,
        tenGod: tenGodRelation(dayStem, char)
      }));
      return acc;
    },
    {} as NonNullable<BaziProfile["hiddenStems"]>
  );
  const luckPillars = result.dayun.dayun_list.map((item) => ({
    ganZhi: item.gan_zhi,
    ageRange: item.age_range,
    yearRange: item.year_range
  }));
  const tenGodCount = [
    ...Object.values(tenGods),
    ...(Object.values(hiddenStems) as Array<Array<{ char: string; tenGod: TenGod }>>)
      .flat()
      .map((item) => item.tenGod)
  ].reduce<Record<string, number>>((acc, god) => {
    acc[god] = (acc[god] ?? 0) + 1;
    return acc;
  }, {});
  const tenGodSummary = Object.entries(tenGodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([god, count]) => `${god}×${count}`)
    .join("、");

  openingInsights.push(
    `十神视角下，你的盘面里最集中的关系是${tenGodSummary}（含地支藏干），它们描述的是你和世界打交道的方式，只作镜面参照。`
  );

  return {
    pillars: {
      year: pillars.year,
      month: pillars.month,
      day: pillars.day,
      hour: pillars.hour,
      fourPillars: pillars.four_pillars
    },
    dayMaster: {
      stem: dayStem,
      element: dayElement,
      label: elementMeta[dayElement].label,
      cue: elementMeta[dayElement].cue
    },
    dominantElements: sortedElements,
    distribution,
    currentJieqi: result.lunar.jieqi.current_jieqi,
    nextJieqi: result.lunar.jieqi.next_jieqi,
    startLuck: result.dayun.start_age_description,
    currentLuck: currentLuck
      ? {
          ganZhi: currentLuck.gan_zhi,
          ageRange: currentLuck.age_range,
          yearRange: currentLuck.year_range
        }
      : undefined,
    tenGods,
    hiddenStems,
    luckPillars,
    redDotHints,
    openingInsights
  };
}

export function createBaziReflection(
  profile: BaziProfile,
  answeredCount: number,
  latestAnswer: string,
  recentTurns?: Array<{ id?: number; answer: string }>
): string {
  const group = Math.ceil(answeredCount / 3);
  const texts = (recentTurns ?? [])
    .map((turn) => (turn.answer ?? "").trim())
    .filter(Boolean);
  if (!texts.length && latestAnswer.trim()) texts.push(latestAnswer.trim());
  const quotes = texts.slice(-3).map((text) => `“${text.slice(0, 30)}”`);
  const quoted = quotes.join("、");
  const cue = profile.dayMaster.cue;

  if (group === 1) {
    return `${quoted || "你这一轮的回答"}里反复出现的，是那些给你能量、或让你消耗的东西。可以把它当作一种自我观察的入口——不必急着下结论，后面几问里留意它们是否继续出现。`;
  }

  if (group === 2) {
    return `${quoted}。这三问开始进入向往的画面，值得留意的是：哪些版本真的让你心动，哪些更多是外界期待。命理线索（${cue}）只作参考，你的回答才是主线。`;
  }

  if (group === 3) {
    return `${quoted}。现在出现的是冲突与边界。真正重要的是你在回答里反复保护的东西，那通常比任何外部标签都更接近你的红点。`;
  }

  return `十二问已经完成。命理开场提供了趣味入口，但最后排序应交给你的取舍：当红点互相冲突时，你愿意为哪一个长期承担代价。`;
}
