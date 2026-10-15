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
    `你的日主是${dayStem}${elementMeta[dayElement].label}，在这个 demo 里我们会把它当作“自我观察入口”，而不是定论。`,
    `四柱里较突出的五行是${sortedElements
      .filter((item) => item.count > 0)
      .slice(0, 2)
      .map((item) => `${item.label}（${item.cue}）`)
      .join("、")}，适合用来引出后面的红点探索。`,
    `接下来每 3 个红点问题，我会用命理线索做一次镜像回应，帮助你坚持回答，但红点排序仍以你的回答为主。`
  ];

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
    redDotHints,
    openingInsights
  };
}

export function createBaziReflection(profile: BaziProfile, answeredCount: number, latestAnswer: string): string {
  const group = Math.ceil(answeredCount / 3);
  const dominant = profile.dominantElements[0];
  const dayCue = profile.dayMaster.cue;
  const answerSignal = latestAnswer.trim() ? `你刚才提到的“${latestAnswer.trim().slice(0, 36)}”` : "你刚才的回答";

  if (group === 1) {
    return `${answerSignal}更像是在校准“什么让我有能量、什么让我消耗”。从${profile.dayMaster.label}的启发线索看，可以先留意那些让你感觉${dayCue}的场景，但我们暂时不下判断。`;
  }

  if (group === 2) {
    return `这三问开始进入向往画面。你的盘面里${dominant.label}气较明显，可以把它当作一种提问角度：哪些生活版本真的让你靠近“${dominant.cue}”，哪些只是外界期待。`;
  }

  if (group === 3) {
    return `现在出现的是冲突与边界。命理线索只提醒我们看见惯性，真正重要的是你在回答里反复保护的东西，那通常比任何外部标签都更接近红点。`;
  }

  return `十二问已经完成。命理开场提供了趣味入口，但最后排序应交给你的取舍：当红点互相冲突时，你愿意为哪一个长期承担代价。`;
}
