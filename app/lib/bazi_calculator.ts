// 八字排盘纯 TS 实现（供 Vercel serverless 使用，替代 Python 子进程）
// 历法基准：lunar-typescript（农历月/闰月/日）+ 仓库内置节气表（与 Python 版共用同一份数据）
// 真太阳时：NOAA 均时差 + 经度差（物理正确实现）
import { Solar, Lunar } from "lunar-typescript";
import jieqiTable from "../../八字命理分析/references/jieqi_1900_2100.json";
import cityCoordinates from "../../八字命理分析/references/cities.json";
import type { BaziCalculatorResult } from "./bazi";

export type BaziCalculateInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: "男" | "女";
  city: string;
};

const HEAVENLY_STEMS = "甲乙丙丁戊己庚辛壬癸";
const EARTHLY_BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const SHICHEN_NAMES = "子丑寅卯辰巳午未申酉戌亥";
const MONTH_CN = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
// 节（非中气）度数 → 月建序号（寅月=1）
const JIE_DEGREE_TO_MONTH: Record<number, number> = {
  315: 1, 345: 2, 15: 3, 45: 4, 75: 5, 105: 6,
  135: 7, 165: 8, 195: 9, 225: 10, 255: 11, 285: 12
};
// 五虎遁：年干 → 正月天干
const FIVE_TIGERS_START: Record<string, string> = {
  甲: "丙", 己: "丙", 乙: "戊", 庚: "戊", 丙: "庚", 辛: "庚", 丁: "壬", 壬: "壬", 戊: "甲", 癸: "甲"
};

type JieqiEvent = { timeUtc: Date; name: string; degree: number };

// 节气表按年份分组，扫描时取前后各一年
const jieqiByYear = jieqiTable as Record<string, Array<{ name: string; degree: number; iso: string }>>;

function jieqiEventsForYear(year: number): JieqiEvent[] {
  return (jieqiByYear[String(year)] ?? []).map((item) => ({
    timeUtc: new Date(item.iso),
    name: item.name,
    degree: item.degree
  }));
}

function scanJieqiEvents(year: number): JieqiEvent[] {
  return [
    ...jieqiEventsForYear(year - 1),
    ...jieqiEventsForYear(year),
    ...jieqiEventsForYear(year + 1)
  ].sort((a, b) => a.timeUtc.getTime() - b.timeUtc.getTime());
}

function sexagenary(index: number): string {
  const i = ((index % 60) + 60) % 60;
  return HEAVENLY_STEMS[i % 10] + EARTHLY_BRANCHES[i % 12];
}

function findIndex60(stem: string, branch: string): number {
  const stemIdx = HEAVENLY_STEMS.indexOf(stem);
  const branchIdx = EARTHLY_BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIdx && i % 12 === branchIdx) return i;
  }
  throw new Error("invalid month pillar");
}

// 中国 1986-1991 夏令时：4月中旬-9月中旬时钟拨快 1 小时
function chinaDstAdjust(year: number, month: number, day: number, hour: number, minute: number) {
  if (year >= 1986 && year <= 1991) {
    const inWindow =
      (month > 4 && month < 9) || (month === 4 && day >= 15) || (month === 9 && day <= 15);
    if (inWindow) {
      let h = hour - 1;
      let d = day;
      if (h < 0) {
        h += 24;
        d -= 1;
      }
      return { year, month, day: d, hour: h, minute };
    }
  }
  return { year, month, day, hour, minute };
}

// NOAA 均时差（分钟），视太阳时 = 平太阳时 + EoT
function equationOfTimeMinutes(utcDate: Date): number {
  const jd = utcDate.getTime() / 86400000 + 2440587.5;
  const jc = (jd - 2451545.0) / 36525.0;
  const rad = Math.PI / 180;
  const gmls = ((280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360 + 360) % 360;
  const gmas = ((357.52911 + jc * (35999.05029 - 0.0001537 * jc)) % 360 + 360) % 360;
  const eeo = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const om = ((125.04 - 1934.136 * jc) % 360 + 360) % 360;
  const sec =
    Math.sin(gmas * rad) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * gmas * rad) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * gmas * rad) * 0.000289;
  const eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(om * rad);
  const vary = Math.tan((eps / 2) * rad) ** 2;
  // NOAA 公式的三角项均为弧度，需乘 4×180/π 换算为分钟
  return (
    4 *
    (180 / Math.PI) *
    (vary * Math.sin(2 * gmls * rad) -
      2 * eeo * Math.sin(gmas * rad) +
      4 * eeo * vary * Math.sin(gmas * rad) * Math.cos(2 * gmls * rad) -
      0.5 * vary * vary * Math.sin(4 * gmls * rad) -
      1.25 * eeo * eeo * Math.sin(2 * gmas * rad))
  );
}

// 标准钟面时间 → 真太阳时（加上经度差与均时差）
function toTrueSolar(stdLocalMs: number, lonDeg: number, tzOffsetMinutes: number, utcDate: Date): number {
  const lonCorrMinutes = (lonDeg / 15.0) * 60 - tzOffsetMinutes;
  return stdLocalMs + (lonCorrMinutes + equationOfTimeMinutes(utcDate)) * 60000;
}

const TZ_OFFSET_MINUTES = 480; // 城市表内时区均为 Asia/Shanghai（UTC+8）

export function calculateBaziRaw(input: BaziCalculateInput): BaziCalculatorResult {
  const city = cityCoordinates[input.city as keyof typeof cityCoordinates];
  if (!city) throw new Error(`不支持的城市：${input.city}`);

  const dstAdjusted = chinaDstAdjust(input.year, input.month, input.day, input.hour, input.minute);
  const stdLocal = new Date(
    Date.UTC(dstAdjusted.year, dstAdjusted.month - 1, dstAdjusted.day, dstAdjusted.hour, dstAdjusted.minute)
  ); // 用 UTC 构造器表示"钟面时间"，减去时区偏移得到真实 UTC

  const realUtcMs = stdLocal.getTime() - TZ_OFFSET_MINUTES * 60000;
  const realUtc = new Date(realUtcMs);

  // 真太阳时（钟面毫秒）
  const tstMs = toTrueSolar(stdLocal.getTime(), city.lon, TZ_OFFSET_MINUTES, realUtc);
  const tst = new Date(tstMs);
  const tstYear = tst.getUTCFullYear();
  const tstMonth = tst.getUTCMonth() + 1;
  const tstDate = tst.getUTCDate();
  const tstHour = tst.getUTCHours();
  const tstMinute = tst.getUTCMinutes();

  // 农历月日（含闰月）——用真太阳时修正后的钟面时间
  const lunar = Lunar.fromSolar(Solar.fromYmdHms(tstYear, tstMonth, tstDate, tstHour, tstMinute, 0));
  const monthNo = Math.abs(lunar.getMonth());
  const isLeapMonth = lunar.getMonth() < 0;

  // 节气扫描（前后各一年），真太阳时口径比较
  const events = scanJieqiEvents(tstYear).map((event) => {
    const stdLocalMs = event.timeUtc.getTime() + TZ_OFFSET_MINUTES * 60000;
    const eventUtc = event.timeUtc;
    return {
      ...event,
      tstMs: toTrueSolar(stdLocalMs, city.lon, TZ_OFFSET_MINUTES, eventUtc)
    };
  });

  let prevEvent = events[0];
  let nextEvent = events[events.length - 1];
  for (const event of events) {
    if (event.tstMs <= tstMs) {
      prevEvent = event;
    } else {
      nextEvent = event;
      break;
    }
  }
  if (!prevEvent || !nextEvent) {
    throw new Error("节气表未能覆盖该出生时间");
  }

  // 年柱：以立春（315°）为界
  const lichunEvents = events.filter((event) => event.degree === 315);
  const lichunThisYear = lichunEvents.find((event) => event.timeUtc.getUTCFullYear() === tstYear);
  let yearGz: string;
  if (lichunThisYear && tstMs >= lichunThisYear.tstMs) {
    yearGz = sexagenary(tstYear - 1984);
  } else {
    yearGz = sexagenary(tstYear - 1 - 1984);
  }

  // 月柱：以节为界 + 五虎遁
  const monthNoByJie = JIE_DEGREE_TO_MONTH[prevEvent.degree];
  if (!monthNoByJie) throw new Error(`未知节度数：${prevEvent.degree}`);
  const startStem = FIVE_TIGERS_START[yearGz[0]];
  const monthStem = HEAVENLY_STEMS[(HEAVENLY_STEMS.indexOf(startStem) + monthNoByJie - 1) % 10];
  const monthBranch = "寅卯辰巳午未申酉戌亥子丑"[monthNoByJie - 1];
  const monthGz = monthStem + monthBranch;

  // 日柱：基准锚点 1986-09-17 UTC 零点为甲子日；晚子时（23 点）算次日
  let dayKeyDate = Date.UTC(tstYear, tstMonth - 1, tstDate);
  if (tstHour === 23) {
    dayKeyDate += 86400000;
  }
  const diffDays = Math.floor((dayKeyDate - Date.UTC(1986, 8, 17)) / 86400000);
  const dayGz = sexagenary(diffDays % 60);

  // 时柱：五鼠遁 + 时辰
  const shichenIdx = Math.floor((tstHour + 1) / 2) % 12;
  const hourStemIdx = (HEAVENLY_STEMS.indexOf(dayGz[0]) * 2 + shichenIdx) % 10;
  const hourGz = HEAVENLY_STEMS[hourStemIdx] + SHICHEN_NAMES[shichenIdx];

  const yearOfRealUtc = realUtc.getUTCFullYear();
  const monthOfRealUtc = realUtc.getUTCMonth() + 1;

  // 大运
  const dayun = calculateDayun({
    realUtc,
    tstMs,
    gender: input.gender,
    yearGz,
    monthGz,
    lon: city.lon,
    events
  });

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };

  return {
    input: {
      gregorian_local: fmt(tstMs),
      timezone: "Asia/Shanghai",
      lat: city.lat,
      lon: city.lon,
      true_solar_time: true
    },
    lunar: {
      date: {
        month_no: monthNo,
        month_cn: (isLeapMonth ? "闰" : "") + MONTH_CN[monthNo - 1] + "月",
        is_leap_month: isLeapMonth,
        day: lunar.getDay(),
        day_cn: "",
        shichen: SHICHEN_NAMES[shichenIdx],
        minute: tstMinute
      },
      gan_zhi: {
        year: yearGz,
        month: monthGz,
        day: dayGz,
        hour: hourGz,
        four_pillars: `${yearGz}年 ${monthGz}月 ${dayGz}日 ${hourGz}时`
      },
      jieqi: {
        current_jieqi: prevEvent.name,
        current_jieqi_time_local: fmt(prevEvent.tstMs),
        next_jieqi: nextEvent.name,
        next_jieqi_time_local: fmt(nextEvent.tstMs)
      }
    },
    dayun
  };
}

function calculateDayun(input: {
  realUtc: Date;
  tstMs: number;
  gender: "男" | "女";
  yearGz: string;
  monthGz: string;
  lon: number;
  events: Array<JieqiEvent & { tstMs: number }>;
}): BaziCalculatorResult["dayun"] {
  const { realUtc, tstMs, gender, yearGz, monthGz, lon, events } = input;
  const yearStem = yearGz[0];
  const isYangYear = "甲丙戊庚壬".includes(yearStem);
  const isMale = gender === "男";
  const shunPai = (isYangYear && isMale) || (!isYangYear && !isMale);

  // 找出生时刻前/后的节（真太阳时口径）
  let prevTst: number | null = null;
  let nextTst: number | null = null;
  for (const event of events) {
    if (event.tstMs <= tstMs) {
      prevTst = event.tstMs;
    } else {
      nextTst = event.tstMs;
      break;
    }
  }
  const targetTst = shunPai ? nextTst : prevTst;
  if (targetTst == null) throw new Error("节气表未能覆盖起运计算");

  const minutesDiff = Math.abs(targetTst - tstMs) / 60000;
  let daysFloat = minutesDiff / 1440.0;
  if (daysFloat > 33.0) daysFloat = 33.0 - 1e-6;

  const yearsFloat = daysFloat / 3.0;
  const y = Math.floor(yearsFloat);
  const remYears = yearsFloat - y;
  const m = Math.floor(remYears * 12.0);
  const remMonths = remYears * 12.0 - m;
  const d = Math.floor(remMonths * 30.0);

  const monthIdx60 = findIndex60(monthGz[0], monthGz[1]);
  const birthYear = realUtc.getUTCFullYear();
  const birthMonth = realUtc.getUTCMonth() + 1;
  const carryYears = Math.floor((birthMonth - 1 + m) / 12);
  const baseStartYear = birthYear + y + carryYears;

  const dayunList: BaziCalculatorResult["dayun"]["dayun_list"] = [];

  if (baseStartYear > birthYear) {
    dayunList.push({
      gan_zhi: "小运",
      start_age: 0,
      end_age: y,
      age_range: `0岁-${y}岁`,
      year_range: `${birthYear}-${baseStartYear - 1}`
    });
  }

  for (let i = 0; i < 10; i++) {
    const idx = shunPai ? monthIdx60 + i + 1 : monthIdx60 - i - 1;
    const gz = sexagenary(idx);
    const sa = y + i * 10;
    const ea = sa + 10;
    const sy = baseStartYear + i * 10;
    const ey = baseStartYear + (i + 1) * 10;
    dayunList.push({
      gan_zhi: gz,
      start_age: sa,
      end_age: ea,
      age_range: `${sa}岁-${ea}岁`,
      year_range: `${sy}-${ey}`
    });
  }

  return {
    start_age_description: `${y}岁${m}个月${d}天`,
    direction: shunPai ? "顺排" : "逆排",
    dayun_list: dayunList
  };
}
