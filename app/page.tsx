"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Download,
  Loader2,
  MessageSquareText,
  PenLine,
  ScrollText,
  Sparkles,
  Target,
  Waypoints
} from "lucide-react";
import { tenGodRelation, type BaziProfile, type TenGod } from "./lib/bazi";
import { isSupportedCity, searchCities, supportedCities } from "./lib/cities";
import {
  inferEvidenceTagsFromText,
  scoreRedDots,
  type ExplorationAnswer,
  type OdysseyPlan,
  type RedDotScore
} from "./lib/odyssey";
import { elementMeta, redDotById, redDotQuestions, redDots, type RedDotId } from "./lib/theory";

type BirthForm = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender: "女" | "男";
  city: string;
};

type BaziResponse = {
  profile: BaziProfile;
};

type SessionResponse = {
  session: {
    id: string;
  };
};

type AnswerResponse = {
  sessionId: string;
  answer: ExplorationAnswer;
  answers: ExplorationAnswer[];
};

type ReflectionResponse = {
  reflection: string;
  keywords?: string[];
  source: string;
};

type ShortlistResponse = {
  candidates: Array<{ id: RedDotId; evidence: string }>;
  source: string;
};

type RankingPromptsResponse = {
  prompts: Array<{ id: RedDotId; description: string; question: string }>;
  source: string;
};

type MirrorEntry = {
  id: string;
  questionId: number;
  theme: string;
  text: string;
  status: "loading" | "done" | "fallback";
  note?: string;
  keywords?: string[];
};

type DiagnosisDraftResponse = {
  draftId?: string;
  scores: RedDotScore[];
  topScores: RedDotScore[];
  top3Reasons: string[];
  lifeInterpretation: string;
  personPortrait: string;
  source: string;
};

const defaultBirthForm: BirthForm = {
  year: "2001",
  month: "5",
  day: "20",
  hour: "10",
  minute: "0",
  gender: "女",
  city: "北京"
};

const steps = [
  {
    title: "命理开场",
    copy: "只做兴趣入口和自我观察线索。",
    icon: Sparkles
  },
  {
    title: "红点十二问",
    copy: "真正的判断来自用户回答。",
    icon: MessageSquareText
  },
  {
    title: "三问一镜像",
    copy: "每 3 问用命理回应一次，帮助坚持。",
    icon: Waypoints
  },
  {
    title: "奥德赛计划",
    copy: "生成当前、备用、理想三版五年路径。",
    icon: Compass
  }
];

const CITY_DATALIST_ID = "birth-city-options";

function PillarView({ label, value, tenGod }: { label: string; value: string; tenGod?: string }) {
  return (
    <div className="pillar">
      <strong>{value}</strong>
      <span>{label}</span>
      {tenGod ? <em className="pillar-ten-god">{tenGod}</em> : null}
    </div>
  );
}

function ProfileSidebar({ profile, activeStep }: { profile: BaziProfile | null; activeStep: number }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-row">
          <h1>人生罗盘</h1>
          <span className="badge">
            <Compass size={14} />
            Pathfinder
          </span>
        </div>
        <p>用命理制造好奇，用十二问保留主体性，用奥德赛计划把方向变成可试验的人生版本。</p>
      </div>

      <div className="steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const className = index === activeStep ? "step is-active" : index < activeStep ? "step is-done" : "step";

          return (
            <div className={className} key={step.title}>
              <div className="step-icon">
                {index < activeStep ? <Check size={16} /> : <Icon size={16} />}
              </div>
              <div>
                <p className="step-title">{step.title}</p>
                <p className="step-copy">{step.copy}</p>
              </div>
            </div>
          );
        })}
      </div>

      {profile ? (
        <>
          <div className="profile-card">
            <h2>命理画像</h2>
            <div className="pillar-grid">
              <PillarView label="年柱" value={profile.pillars.year} tenGod={profile.tenGods?.year} />
              <PillarView label="月柱" value={profile.pillars.month} tenGod={profile.tenGods?.month} />
              <PillarView label="日柱" value={profile.pillars.day} tenGod="日主" />
              <PillarView label="时柱" value={profile.pillars.hour} tenGod={profile.tenGods?.hour} />
            </div>

            <div className="energy-list">
              {profile.dominantElements.map((item) => (
                <div className="energy-row" key={item.element}>
                  <span>{item.label}</span>
                  <div className="energy-track">
                    <div
                      className="energy-fill"
                      style={{
                        width: `${Math.max(8, (item.count / 8) * 100)}%`,
                        backgroundColor: elementMeta[item.element].color
                      }}
                    />
                  </div>
                  <span>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="side-section">
            <h2>命理启发线索</h2>
            <div className="hint-list">
              {[profile.dayMaster.cue, ...profile.dominantElements.slice(0, 2).map((item) => item.cue)].map((cue) => (
                <span className="tag" key={cue}>
                  {cue}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}

function BirthPanel({
  birthForm,
  setBirthForm,
  onSubmit,
  loading,
  error
}: {
  birthForm: BirthForm;
  setBirthForm: (form: BirthForm) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
}) {
  const cityMatches = useMemo(() => searchCities(birthForm.city, 8), [birthForm.city]);
  const cityIsValid = isSupportedCity(birthForm.city);

  return (
    <div className="content">
      <div className="ritual-copy">
        <span>初入海图</span>
        <h3>先借命盘起风，再把答案交还给你的经历。</h3>
      </div>

      <div className="form-grid">
        <div className="field span-2">
          <label>出生年份</label>
          <input value={birthForm.year} onChange={(event) => setBirthForm({ ...birthForm, year: event.target.value })} />
        </div>
        <div className="field">
          <label>月</label>
          <input value={birthForm.month} onChange={(event) => setBirthForm({ ...birthForm, month: event.target.value })} />
        </div>
        <div className="field">
          <label>日</label>
          <input value={birthForm.day} onChange={(event) => setBirthForm({ ...birthForm, day: event.target.value })} />
        </div>
        <div className="field">
          <label>时</label>
          <input value={birthForm.hour} onChange={(event) => setBirthForm({ ...birthForm, hour: event.target.value })} />
        </div>
        <div className="field">
          <label>分</label>
          <input value={birthForm.minute} onChange={(event) => setBirthForm({ ...birthForm, minute: event.target.value })} />
        </div>
        <div className="field span-2">
          <label>性别</label>
          <select
            value={birthForm.gender}
            onChange={(event) => setBirthForm({ ...birthForm, gender: event.target.value as BirthForm["gender"] })}
          >
            <option value="女">女</option>
            <option value="男">男</option>
          </select>
        </div>
        <div className="field span-2">
          <label>出生城市</label>
          <div className="city-combobox">
            <input
              value={birthForm.city}
              onChange={(event) => setBirthForm({ ...birthForm, city: event.target.value })}
              list={CITY_DATALIST_ID}
              placeholder="搜索并选择城市"
            />
            <datalist id={CITY_DATALIST_ID}>
              {supportedCities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
            <div className="city-suggestions" aria-label="城市候选">
              {cityMatches.map((city) => (
                <button
                  className={birthForm.city === city ? "city-option is-selected" : "city-option"}
                  key={city}
                  onClick={() => setBirthForm({ ...birthForm, city })}
                  type="button"
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
          {birthForm.city.trim() && !cityIsValid ? <p className="field-hint is-error">请选择列表中的城市，省份暂不支持真太阳时校正。</p> : null}
        </div>
      </div>

      <div className="notice">
        <ScrollText size={18} />
        <span>
          命理分析在这里是趣味化入口，只提供观察角度。后续红点排序会以十二问回答、主动选择和取舍为主要依据。
        </span>
      </div>

      {error ? <div className="notice">{error}</div> : null}

      <div className="button-row">
        <button className="primary-button" onClick={onSubmit} disabled={loading || !cityIsValid}>
          {loading ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
          生成命理画像
        </button>
      </div>
    </div>
  );
}

function BaziIntro({ profile, onStart }: { profile: BaziProfile; onStart: () => void }) {
  return (
    <div className="content">
      <div className="ritual-copy">
        <span>命理画像</span>
        <h3>这不是结论，只是一面先照见惯性的镜子。</h3>
      </div>

      <div className="split-grid">
        <section className="panel-block">
          <div className="panel-block-header">
            <h3>命理开场</h3>
            <span className="badge">日主 {profile.dayMaster.stem}{profile.dayMaster.label}</span>
          </div>
          <div className="panel-body">
            <ul className="insight-list">
              {profile.openingInsights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
            <div className="button-row">
              <button className="primary-button" onClick={onStart}>
                进入红点十二问
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="panel-block">
          <div className="panel-block-header">
            <h3>排盘信息</h3>
          </div>
          <div className="panel-body">
            <div className="timeline">
              <div className="saved-answer">
                <h4>四柱</h4>
                <p>{profile.pillars.fourPillars}</p>
              </div>
              <div className="saved-answer">
                <h4>节气</h4>
                <p>当前节气 {profile.currentJieqi}，下一节气 {profile.nextJieqi}</p>
              </div>
              <div className="saved-answer">
                <h4>起运</h4>
                <p>{profile.startLuck}{profile.currentLuck ? `；当前大运 ${profile.currentLuck.ganZhi}（${profile.currentLuck.yearRange}）` : ""}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function OdysseyLoading() {
  return (
    <div className="odyssey-overlay" role="status" aria-label="正在生成奥德赛计划">
      <svg className="odyssey-scene" viewBox="0 0 320 210" width="320" height="210" aria-hidden="true">
        <defs>
          <linearGradient id="ribbonInk" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2e2a24" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#a8813b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2e2a24" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          className="odyssey-ribbon odyssey-ribbon-base"
          d="M 58 104 C 58 62, 138 62, 160 102 C 182 142, 262 142, 262 100 C 262 58, 182 58, 160 98 C 138 138, 58 138, 58 104 Z"
          fill="none"
          stroke="url(#ribbonInk)"
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          className="odyssey-ribbon odyssey-ribbon-flow"
          d="M 58 104 C 58 62, 138 62, 160 102 C 182 142, 262 142, 262 100 C 262 58, 182 58, 160 98 C 138 138, 58 138, 58 104 Z"
          fill="none"
          stroke="url(#ribbonInk)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="26 50"
        />
        <path
          className="odyssey-wave"
          d="M 34 172 C 64 164, 94 180, 124 172 C 154 164, 184 180, 214 172 C 244 164, 268 178, 286 172"
          fill="none"
          stroke="#a8813b"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.5"
          strokeDasharray="10 14"
        />
        <g className="odyssey-boat-track">
          <g className="odyssey-boat-rock">
            <path d="M -16 0 L 16 0 L 8 9 L -8 9 Z" fill="#2e2a24" opacity="0.82" />
            <path d="M 1 -17 L 12 -3 L 1 -3 Z" fill="#a8813b" opacity="0.9" />
            <path d="M -2 -12 L -10 -3 L -2 -3 Z" fill="#2e2a24" opacity="0.55" />
          </g>
        </g>
      </svg>
      <p className="odyssey-loading-text">正沿时间之河，绘制你的三版五年奥德赛计划</p>
      <p className="odyssey-loading-sub">路线越长，绘制越慢——大约需要一分钟，请稍候</p>
    </div>
  );
}

const TEN_GOD_MEANING: Record<TenGod, string> = {
  比肩: "独立把事扛起来的自主性，也容易单打独斗",
  劫财: "拉上同伴一起冲的行动力，节奏快、敢投入",
  食神: "从容表达与创造的天赋——把想法慢慢做出来的能力",
  伤官: "锋利的才华与表达欲，常有打破常规的洞察",
  偏财: "抓住机会、灵活调动资源的手感",
  正财: "踏实积累、把价值一步步兑现的耐性",
  七杀: "高压环境里反而被激发的韧性，敢啃硬仗",
  正官: "对规则、责任和标准的天然自觉",
  偏印: "直觉式的学习力，擅长冷门领域和深度思考",
  正印: "系统吸收知识的天赋，也常是被人信任的稳压器"
};

function BaziInsightPanel({ profile }: { profile: BaziProfile }) {
  const counts: Partial<Record<TenGod, number>> = {};

  if (profile.tenGods) {
    for (const god of [profile.tenGods.year, profile.tenGods.month, profile.tenGods.hour]) {
      counts[god] = (counts[god] ?? 0) + 1;
    }
  }
  if (profile.hiddenStems) {
    for (const stem of Object.values(profile.hiddenStems).flat()) {
      counts[stem.tenGod] = (counts[stem.tenGod] ?? 0) + 1;
    }
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]) as Array<[TenGod, number]>;
  const currentLuck = profile.currentLuck;
  const currentLuckTenGod = currentLuck
    ? tenGodRelation(profile.dayMaster.stem, currentLuck.ganZhi[0] ?? "甲")
    : undefined;

  return (
    <div className="bazi-insight">
      <div className="bazi-insight-block">
        <h4>十神解析 · 你的天赋点</h4>
        {ranked.length ? (
          ranked.slice(0, 3).map(([god, count]) => (
            <p key={god}>
              <strong>{god}×{count}</strong>——{TEN_GOD_MEANING[god]}。
            </p>
          ))
        ) : (
          <p>十神数据需要重新排盘后才会显示。</p>
        )}
      </div>
      <div className="bazi-insight-block">
        <h4>大运流年</h4>
        {currentLuck && currentLuckTenGod ? (
          <>
            <p>
              你现在正走 <strong>{currentLuck.ganZhi}</strong> 大运（{currentLuck.ageRange}，{currentLuck.yearRange}），大运天干是你的<strong>{currentLuckTenGod}</strong>——{TEN_GOD_MEANING[currentLuckTenGod]}。
            </p>
            <p className="bazi-insight-hint">这十年的主题是环境给你的底色，不是判决；它在下面的镜像信里只会作为参照出现。</p>
          </>
        ) : (
          <p>当前大运信息暂缺。</p>
        )}
      </div>
      <div className="empty-state">完成第 3 问后，这里会出现第一封命理镜像信。</div>
    </div>
  );
}

function QuestionPanel({
  profile,
  answers,
  setAnswers,
  currentIndex,
  setCurrentIndex,
  reflections,
  setReflections,
  sessionId,
  setSessionId,
  setError,
  onComplete
}: {
  profile: BaziProfile;
  answers: ExplorationAnswer[];
  setAnswers: (answers: ExplorationAnswer[]) => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  reflections: MirrorEntry[];
  setReflections: Dispatch<SetStateAction<MirrorEntry[]>>;
  sessionId: string;
  setSessionId: (value: string) => void;
  setError: (value: string) => void;
  onComplete: () => void;
}) {
  const question = redDotQuestions[currentIndex];
  const existing = answers.find((answer) => answer.questionId === question.id);
  const previousConfirmed = question.id === 12
    ? answers.find((answer) => answer.questionId === 11)?.confirmedRedDots ?? []
    : [];
  const [draft, setDraft] = useState(existing?.text ?? "");
  const [confirmedRedDots, setConfirmedRedDots] = useState<RedDotId[]>(existing?.confirmedRedDots ?? previousConfirmed);
  const [excludedRedDots, setExcludedRedDots] = useState<RedDotId[]>(existing?.excludedRedDots ?? []);
  const [shortlist, setShortlist] = useState<ShortlistResponse | null>(null);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [rankingPrompts, setRankingPrompts] = useState<RankingPromptsResponse | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const progress = answers.length;
  const showRedDotModel = question.id >= 10;
  const isExclusionStep = question.id === 10;
  const isRankingStep = question.id === 12 && confirmedRedDots.length === 3;
  const ruleCandidates = useMemo(() => {
    const ranked = scoreRedDots(answers)
      .filter((score) => score.score > 0)
      .slice(0, 5)
      .map((score) => redDotById[score.id]);

    return ranked.length >= 3 ? ranked : redDots.slice(0, 5);
  }, [answers]);
  const shortlistItems = useMemo(() => {
    const items = shortlist?.candidates ?? ruleCandidates.map((dot) => ({ id: dot.id, evidence: "" }));
    const poolIds = new Set(items.map((item) => item.id));
    const carried = confirmedRedDots
      .filter((id) => !poolIds.has(id))
      .map((id) => ({ id, evidence: "你上一次确认的选择，可直接保留或修改。" }));
    return [...items, ...carried];
  }, [shortlist, ruleCandidates, confirmedRedDots]);

  const shortlistKeyRef = useRef("");
  useEffect(() => {
    if (!showRedDotModel) return;
    const excluded = answers.find((answer) => answer.questionId === 10)?.excludedRedDots ?? [];
    const key = `${excluded.join(",")}|${answers.length}`;
    if (shortlistKeyRef.current === key) return;
    shortlistKeyRef.current = key;
    let canceled = false;
    setShortlistLoading(true);
    fetch("/api/diagnosis/shortlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        answers,
        excluded,
        profile
      })
    })
      .then(async (response) => {
        const data = (await response.json()) as ShortlistResponse & { message?: string };
        if (!response.ok) throw new Error(data.message ?? "候选预筛失败");
        if (!canceled) setShortlist(data);
      })
      .catch(() => {
        if (!canceled) setShortlist(null);
      })
      .finally(() => {
        if (!canceled) setShortlistLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [showRedDotModel, answers]);

  const rankingKeyRef = useRef("");
  useEffect(() => {
    if (!isRankingStep) return;
    const key = confirmedRedDots.join(",");
    if (rankingKeyRef.current === key) return;
    rankingKeyRef.current = key;
    let canceled = false;
    setRankingLoading(true);
    fetch("/api/diagnosis/ranking-prompts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        answers,
        topDots: confirmedRedDots,
        profile
      })
    })
      .then(async (response) => {
        const data = (await response.json()) as RankingPromptsResponse & { message?: string };
        if (!response.ok) throw new Error(data.message ?? "关键问题生成失败");
        if (!canceled) setRankingPrompts(data);
      })
      .catch(() => {
        if (!canceled) setRankingPrompts(null);
      })
      .finally(() => {
        if (!canceled) setRankingLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [isRankingStep, confirmedRedDots, answers]);

  function toggleRedDot(redDotId: RedDotId) {
    setConfirmedRedDots((items) => {
      if (items.includes(redDotId)) return items.filter((item) => item !== redDotId);
      if (items.length >= 3) return [...items.slice(1), redDotId];
      return [...items, redDotId];
    });
  }

  function toggleExcluded(redDotId: RedDotId) {
    setExcludedRedDots((items) => {
      if (items.includes(redDotId)) return items.filter((item) => item !== redDotId);
      if (items.length >= 4) return items;
      return [...items, redDotId];
    });
  }

  function updateMirrorNote(mirrorId: string, note: string) {
    setReflections((items) =>
      items.map((item) => (item.id === mirrorId ? { ...item, note } : item))
    );
  }

  function getRank(redDotId: RedDotId) {
    const index = confirmedRedDots.indexOf(redDotId);
    return index >= 0 ? index + 1 : undefined;
  }

  async function saveAnswer() {
    const nextAnswer: ExplorationAnswer = {
      questionId: question.id,
      text: draft,
      tags: inferEvidenceTagsFromText(draft, question.evidenceTags),
      confirmedRedDots: showRedDotModel && !isExclusionStep ? confirmedRedDots : undefined,
      excludedRedDots: isExclusionStep ? excludedRedDots : undefined
    };
    let normalizedAnswer = nextAnswer;
    const mirrorId = `q${question.id}-${Date.now()}`;
    let nextAnswers = [...answers.filter((answer) => answer.questionId !== question.id), nextAnswer].sort((a, b) => a.questionId - b.questionId);
    const shouldCreateMirror = question.id % 3 === 0;

    if (shouldCreateMirror) {
      setReflections([
        ...reflections.filter((item) => item.questionId !== question.id),
        {
          id: mirrorId,
          questionId: question.id,
          theme: `第 ${question.id - 2}-${question.id} 问回看`,
          text: "命理镜像正在结合这一轮三题回答生成...",
          status: "loading"
        }
      ]);
    }

    try {
      const response = await fetch("/api/exploration/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          profile,
          answer: nextAnswer,
          answers: nextAnswers,
          shouldReflect: false
        })
      });
      const data = (await response.json()) as AnswerResponse & { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "保存回答失败");
      }

      normalizedAnswer = data.answer;
      nextAnswers = data.answers.length ? data.answers : nextAnswers;
      if (data.sessionId && data.sessionId !== sessionId) setSessionId(data.sessionId);
      setError("");

      if (shouldCreateMirror) {
        const mirrorAnswers = nextAnswers.filter((answer) => answer.questionId >= question.id - 2 && answer.questionId <= question.id);

        fetch("/api/exploration/reflection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            profile,
            answeredCount: question.id,
            latestAnswer: normalizedAnswer.text,
            answers: mirrorAnswers,
            question: {
              id: question.id,
              theme: question.theme,
              prompt: question.prompt
            }
          })
        })
          .then(async (reflectionResponse) => {
            const reflectionData = (await reflectionResponse.json()) as ReflectionResponse & { message?: string };
            if (!reflectionResponse.ok) throw new Error(reflectionData.message ?? "命理镜像生成失败");
            setReflections((items) => items.map((item) => item.id === mirrorId
              ? {
                  ...item,
                  text: reflectionData.reflection,
                  keywords: reflectionData.keywords ?? [],
                  status: "done"
                }
              : item));
          })
          .catch(() => {
            setReflections((items) => items.map((item) => item.id === mirrorId
              ? {
                  ...item,
                  text: "这一轮三题已经保存。命理镜像暂时没有生成成功，但它只作为陪伴式复盘，不影响红点判断。",
                  status: "fallback"
                }
              : item));
          });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存回答失败，已先保留在当前页面。 ");
      nextAnswers = [...answers.filter((answer) => answer.questionId !== question.id), normalizedAnswer].sort((a, b) => a.questionId - b.questionId);
      if (shouldCreateMirror) {
        setReflections((items) => items.map((item) => item.id === mirrorId
          ? {
              ...item,
              text: "这一轮三题已先保存在页面里。模型镜像暂时失败，可以继续回答，稍后再试。",
              status: "fallback"
            }
          : item));
      }
    }

    setAnswers(nextAnswers);

    if (question.id === redDotQuestions.length) {
      onComplete();
      return;
    }

    const nextIndex = currentIndex + 1;
    const nextExisting = nextAnswers.find((answer) => answer.questionId === redDotQuestions[nextIndex].id);
    const carriedDots = nextExisting?.confirmedRedDots
      ?? (redDotQuestions[nextIndex].id === 12 ? confirmedRedDots : []);
    setCurrentIndex(nextIndex);
    setDraft(nextExisting?.text ?? "");
    setConfirmedRedDots(carriedDots);
    setExcludedRedDots(nextExisting?.excludedRedDots ?? []);
  }

  function goPrevious() {
    const nextIndex = Math.max(0, currentIndex - 1);
    const nextExisting = answers.find((answer) => answer.questionId === redDotQuestions[nextIndex].id);
    setCurrentIndex(nextIndex);
    setDraft(nextExisting?.text ?? "");
    setConfirmedRedDots(nextExisting?.confirmedRedDots ?? []);
    setExcludedRedDots(nextExisting?.excludedRedDots ?? []);
  }

  return (
    <div className="content">
      <div className="split-grid">
        <section className="panel-block question-panel-block">
          <div className="panel-body">
            <div className="question-meta">
              <span>问题 {question.id} / 12</span>
              <span>{progress} 已保存</span>
            </div>
            <h3 className="question-title">{question.theme}</h3>
            <p>{question.prompt}</p>

            <div className="probes">
              {question.probes.map((probe) => (
                <div className="probe" key={probe}>
                  <Target size={14} />
                  <span>{probe}</span>
                </div>
              ))}
            </div>

            <div className="field">
              <label>你的回答</label>
              <textarea
                className="answer-box"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="写下具体事件、画面、情绪和取舍。越具体，后面的诊断草案越可靠。"
              />
            </div>

            {showRedDotModel ? (
              <div className="model-explainer">
                {isExclusionStep ? (
                  <>
                    <h4>红点排除</h4>
                    <p>九个红点里，把不符合你的先划掉：至少划掉 1 个，最多划掉 4 个（至少剩 5 个）。与此同时，系统正在结合你前面的全部回答做模型预筛，下一问会给你 5 个候选。</p>
                    <div className="ranked-red-dot-grid">
                      {redDots.map((dot) => (
                        <button
                          className={excludedRedDots.includes(dot.id) ? "red-dot-option is-excluded" : "red-dot-option"}
                          key={dot.id}
                          onClick={() => toggleExcluded(dot.id)}
                          type="button"
                          title={dot.trait}
                        >
                          <span className="rank-mark">{excludedRedDots.includes(dot.id) ? "已划掉" : "候选"}</span>
                          <strong>{dot.name}</strong>
                          <span>{dot.trait}</span>
                          <em>{dot.motto}</em>
                        </button>
                      ))}
                    </div>
                    <div className="rank-summary">
                      <div className="rank-slot">
                        <span>已划掉</span>
                        <strong>{excludedRedDots.length} / 4</strong>
                      </div>
                      <div className="rank-slot">
                        <span>剩余候选</span>
                        <strong>{9 - excludedRedDots.length} 个</strong>
                      </div>
                    </div>
                  </>
                ) : isRankingStep ? (
                  <>
                    <h4>最终取舍 · 承诺与退路</h4>
                    {rankingLoading ? (
                      <p className="shortlist-status">正在结合你的全部回答，为 Top 1 与退路红点分别提炼代价场景式的抉择问题，请稍候…</p>
                    ) : (
                      <p>上一题你已排出 Top 3，这一题不再选红点，只做最后的取舍确认。下面三张卡各附一道抉择问题，每道都会把你推向一个真实的代价场景。读完凭直觉，在下方写下你的最终倾向：哪一个成为未来三年的主轴、你愿意为它接受什么。</p>
                    )}
                    <div className="ranking-prompt-list">
                      {confirmedRedDots.map((dotId) => {
                        const dot = redDotById[dotId];
                        const prompt = rankingPrompts?.prompts.find((item) => item.id === dotId);
                        if (rankingLoading) {
                          return (
                            <div className="red-dot-option ranking-prompt-card is-skeleton" key={dotId}>
                              <span className="rank-mark">Top {getRank(dotId)}</span>
                              <strong>{dot.name}</strong>
                              <span className="skeleton-line" style={{ width: "92%" }} />
                              <span className="skeleton-line" style={{ width: "85%" }} />
                              <span className="skeleton-line skeleton-line-question" style={{ width: "70%" }} />
                            </div>
                          );
                        }
                        return (
                          <div className="red-dot-option ranking-prompt-card" key={dotId}>
                            <span className="rank-mark">Top {getRank(dotId)}</span>
                            <strong>{dot.name}</strong>
                            {prompt ? (
                              <>
                                <span className="ranking-description">{prompt.description}</span>
                                <em className="ranking-question">{prompt.question}</em>
                              </>
                            ) : (
                              <span>{dot.trait}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="rank-summary">
                      {[0, 1, 2].map((index) => {
                        const selected = confirmedRedDots[index];
                        return (
                          <div className="rank-slot" key={index}>
                            <span>Top {index + 1}</span>
                            <strong>{selected ? redDotById[selected].name : "待选择"}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <h4>候选 5 选 3</h4>
                    {shortlistLoading ? (
                      <p className="shortlist-status">正在结合你的全部回答做模型分析，请稍候…</p>
                    ) : (
                      <p>这是模型基于你所有回答给出的 5 个候选。点击卡片会按选择顺序排成 Top 1 / Top 2 / Top 3；再次点击可移除。</p>
                    )}
                    {!shortlistLoading ? (
                      <>
                        <div className="ranked-red-dot-grid">
                          {shortlistItems.map((candidate) => {
                            const dot = redDotById[candidate.id];
                            return (
                              <button
                                className={confirmedRedDots.includes(dot.id) ? "red-dot-option is-selected" : "red-dot-option"}
                                key={dot.id}
                                onClick={() => toggleRedDot(dot.id)}
                                type="button"
                                title={dot.trait}
                              >
                                <span className="rank-mark">{getRank(dot.id) ? `Top ${getRank(dot.id)}` : "候选"}</span>
                                <strong>{dot.name}</strong>
                                <span>{dot.trait}</span>
                                <em>{candidate.evidence || dot.motto}</em>
                              </button>
                            );
                          })}
                        </div>
                        <div className="rank-summary">
                          {[0, 1, 2].map((index) => {
                            const selected = confirmedRedDots[index];
                            return (
                              <div className="rank-slot" key={index}>
                                <span>Top {index + 1}</span>
                                <strong>{selected ? redDotById[selected].name : "待选择"}</strong>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className="button-row">
              <button className="ghost-button" onClick={goPrevious} disabled={currentIndex === 0}>
                <ArrowLeft size={18} />
                上一问
              </button>
              <button
                className="primary-button"
                onClick={saveAnswer}
                disabled={!draft.trim() || (showRedDotModel && (isExclusionStep ? excludedRedDots.length < 1 : isRankingStep ? confirmedRedDots.length < 3 : shortlistLoading || confirmedRedDots.length === 0))}
              >
                {question.id === 12 ? "生成诊断草案" : "保存并继续"}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="panel-block mirror-panel-block">
          <div className="panel-block-header">
            <h3>三问一镜像</h3>
            <span className="badge">命理只回应，不打分</span>
          </div>
          <div className="panel-body">
            {reflections.length ? (
              reflections.map((reflection) => (
                <MirrorCard
                  key={reflection.id}
                  reflection={reflection}
                  onUpdateNote={updateMirrorNote}
                />
              ))
            ) : (
              <BaziInsightPanel profile={profile} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MirrorCard({
  reflection,
  onUpdateNote
}: {
  reflection: MirrorEntry;
  onUpdateNote: (mirrorId: string, note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteDraft, setNoteDraft] = useState(reflection.note ?? "");
  const loading = reflection.status === "loading";
  const tags = loading
    ? []
    : (reflection.keywords?.length ? reflection.keywords : ["本轮复盘"]);

  return (
    <article className={loading ? "mirror-card is-loading" : "mirror-card"} data-note={noteDraft.trim() ? "yes" : "no"}>
      <button className="mirror-envelope" onClick={() => setExpanded((value) => !value)} type="button">
        <span className="mirror-tags">
          {loading
            ? <span className="mirror-tags-loading">正在提炼关键词……</span>
            : tags.map((tag) => <span className="mirror-tag" key={tag}>{tag}</span>)}
        </span>
        <span className="mirror-meta">
          {noteDraft.trim() ? <Bookmark className="mirror-bookmark" size={14} /> : null}
          <ChevronDown className={expanded ? "mirror-chevron is-open" : "mirror-chevron"} size={16} />
        </span>
      </button>

      <div className={expanded ? "mirror-fold is-open" : "mirror-fold"}>
        <div className="mirror-fold-inner">
          <p className="mirror-letter">{reflection.text}</p>

          <div className="mirror-margin-note">
            <div className="mirror-margin-note-header">
              <PenLine size={13} />
              <span>随手批注</span>
            </div>
            <textarea
              className="mirror-note-input"
              value={noteDraft}
              placeholder="读完这封信，有什么想随手记下的？留白也没关系。"
              onChange={(event) => setNoteDraft(event.target.value)}
              onBlur={() => onUpdateNote(reflection.id, noteDraft.trim())}
            />
            <span className="mirror-note-hint">失焦即存 · 会随报告一起保存</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ResultPanel({
  answers,
  profile,
  reflections,
  onUpdateNote,
  onGeneratePlans,
  direction,
  setDirection,
  sessionId,
  diagnosisDraft,
  setDiagnosisDraft,
  setError
}: {
  answers: ExplorationAnswer[];
  profile: BaziProfile | null;
  reflections: MirrorEntry[];
  onUpdateNote: (mirrorId: string, note: string) => void;
  onGeneratePlans: (topDots: RedDotId[]) => void;
  direction: string;
  setDirection: (value: string) => void;
  sessionId: string;
  diagnosisDraft: DiagnosisDraftResponse | null;
  setDiagnosisDraft: (draft: DiagnosisDraftResponse | null) => void;
  setError: (value: string) => void;
}) {
  const localScores = useMemo(() => scoreRedDots(answers), [answers]);
  const positiveLocalScores = localScores.filter((score) => score.score > 0);
  const scores = diagnosisDraft?.scores ?? localScores;
  const topScores = diagnosisDraft?.topScores ?? (positiveLocalScores.length >= 3 ? positiveLocalScores.slice(0, 3) : localScores.slice(0, 3));
  const recommendedDots = useMemo(() => {
    const ranked = scores.filter((score) => score.score > 0).slice(0, 5).map((score) => redDotById[score.id]);
    return ranked.length >= 3 ? ranked : redDots.slice(0, 5);
  }, [scores]);
  const [showAllDots, setShowAllDots] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(true);
  const selectableDots = showAllDots ? redDots : recommendedDots;

  const finalRanking = useMemo(() => {
    const lastRanked = [...answers].reverse().find((answer) => (answer.confirmedRedDots?.length ?? 0) === 3);
    return lastRanked?.confirmedRedDots as RedDotId[] | undefined;
  }, [answers]);

  const [consensusDots, setConsensusDots] = useState<RedDotId[]>([]);
  const consensusInitialized = useRef(false);

  useEffect(() => {
    if (consensusInitialized.current) return;
    const seed = finalRanking ?? (diagnosisDraft && diagnosisDraft.topScores.length === 3
      ? diagnosisDraft.topScores.map((score) => score.id)
      : undefined);
    if (seed && seed.length === 3) {
      setConsensusDots(seed);
      consensusInitialized.current = true;
    }
  }, [finalRanking, diagnosisDraft]);

  useEffect(() => {
    let canceled = false;

    async function fetchDiagnosisDraft() {
      if (!answers.length) return;

      try {
        const response = await fetch("/api/diagnosis/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sessionId: sessionId || undefined,
            answers,
            profile: profile ?? undefined,
            reflections: reflections
              .filter((mirror) => mirror.status !== "loading")
              .map(({ id, keywords, text, note }) => ({ id, keywords, text, note }))
          })
        });
        const data = (await response.json()) as DiagnosisDraftResponse & { message?: string };

        if (!response.ok) {
          throw new Error(data.message ?? "生成诊断报告失败");
        }

        if (!canceled) {
          setDiagnosisDraft(data);
          setError("");
        }
      } catch (requestError) {
        if (!canceled) {
          setDiagnosisDraft(null);
          setError(requestError instanceof Error ? requestError.message : "生成诊断报告失败，已展示本地规则草案。");
        }
      }
    }

    fetchDiagnosisDraft();

    return () => {
      canceled = true;
    };
    // 诊断只在进入结果页时请求一次，回看批注的变化不应触发重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleConsensusDot(redDotId: RedDotId) {
    setConsensusDots((items) => {
      if (items.includes(redDotId)) return items.filter((item) => item !== redDotId);
      if (items.length >= 3) return [...items.slice(1), redDotId];
      return [...items, redDotId];
    });
  }

  function getConsensusRank(redDotId: RedDotId) {
    const index = consensusDots.indexOf(redDotId);
    return index >= 0 ? index + 1 : undefined;
  }

  const isAnalyzing = !diagnosisDraft;

  return (
    <div className="content">
      <section className="panel-block manuscript-panel">
        <div className="panel-block-header">
          <h3>诊断报告</h3>
          <span className="badge">十二问证据 + 命理镜面</span>
        </div>
        <div className="panel-body">
          {isAnalyzing ? (
            <>
              <div className="notice is-warning" style={{ marginTop: 0 }}>
                <ScrollText size={18} />
                <span>模型正在结合你的十二问回答和命理镜像信撰写诊断报告，约需 30-60 秒。等待期间，你可以自由回看下方的十二张问答卡片和镜像信。</span>
              </div>
              <div className="report-skeleton">
                <span className="skeleton-line" style={{ width: "88%" }} />
                <span className="skeleton-line" style={{ width: "94%" }} />
                <span className="skeleton-line" style={{ width: "76%" }} />
                <span className="skeleton-line" style={{ width: "58%" }} />
              </div>
            </>
          ) : (
            <>
              <div className="notice" style={{ marginTop: 0 }}>
                <ScrollText size={18} />
                <span>这份报告来自你的十二问回答与命理镜面，请把它当作可讨论的假设，而不是最终判决；你可以在下方微调 Top 3，确认后再生成奥德赛计划。</span>
              </div>

              <div className="score-grid">
                {topScores.map((score, index) => {
                  const dot = redDotById[score.id];
                  const max = Math.max(topScores[0]?.score ?? 1, 1);

                  return (
                    <article className="red-dot-card" key={score.id}>
                      <span className="badge">Top {index + 1}</span>
                      <h3>{dot.name}</h3>
                      <p>{dot.trait}</p>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${Math.max(12, (score.score / max) * 100)}%` }} />
                      </div>
                      <div className="timeline">
                        {score.evidence.length ? score.evidence.map((item) => <p key={item}>{item}</p>) : <p>来自你的证据线索与文本回答。</p>}
                      </div>
                    </article>
                  );
                })}
              </div>

              {diagnosisDraft.source.includes("fallback") ? (
                <div className="fallback-note">当前展示的是本地规则草案（模型暂时不可用）。重新进入本页或稍后刷新即可重新生成模型报告。</div>
              ) : null}

              <div className="model-explainer" style={{ marginTop: 18 }}>
                <h4>为什么是这三个</h4>
                <div className="reason-list">
                  {diagnosisDraft.top3Reasons.map((reason) => (
                    <div className="reason-item" key={reason}>{reason}</div>
                  ))}
                </div>
              </div>

              <article className="report-letter">
                <h4>结合命理的过往解读</h4>
                <p className="mirror-letter">{diagnosisDraft.lifeInterpretation}</p>
              </article>

              <article className="report-letter">
                <h4>现在的你，是什么样的人</h4>
                <p className="mirror-letter">{diagnosisDraft.personPortrait}</p>
              </article>
            </>
          )}

          <div className="model-explainer" style={{ marginTop: 18 }}>
            <h4>确认你的 Top 3</h4>
            <p>
              {finalRanking
                ? "已默认继承你在第 11-12 问确认的排序，可以直接确认，也可以微调。这里的选择会作为奥德赛计划的前提。"
                : "如果草案不符合你的真实感受，可以从候选里重新选择最终 Top 3。这里的选择会作为奥德赛计划的前提。"}
            </p>
            <div className="ranked-red-dot-grid">
              {selectableDots.map((dot) => (
                <button
                  className={consensusDots.includes(dot.id) ? "red-dot-option is-selected" : "red-dot-option"}
                  key={dot.id}
                  onClick={() => toggleConsensusDot(dot.id)}
                  type="button"
                  title={dot.trait}
                >
                  <span className="rank-mark">{getConsensusRank(dot.id) ? `Top ${getConsensusRank(dot.id)}` : "候选"}</span>
                  <strong>{dot.name}</strong>
                  <span>{dot.trait}</span>
                  <em>{dot.motto}</em>
                </button>
              ))}
            </div>
            <div className="rank-summary">
              {[0, 1, 2].map((index) => {
                const selected = consensusDots[index];
                return (
                  <div className="rank-slot" key={index}>
                    <span>Top {index + 1}</span>
                    <strong>{selected ? redDotById[selected].name : "待选择"}</strong>
                  </div>
                );
              })}
            </div>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button className="ghost-button" type="button" onClick={() => setShowAllDots((value) => !value)}>
                {showAllDots ? "收起全部类型" : "查看全部 9 类"}
              </button>
            </div>
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label>你想探索的职业或人生方向</label>
            <input value={direction} onChange={(event) => setDirection(event.target.value)} placeholder="例如：AI 产品经理、教育创业、内容创作、金融科技..." />
          </div>

          <div className="button-row">
            <button className="primary-button" onClick={() => onGeneratePlans(consensusDots)} disabled={consensusDots.length !== 3 || isAnalyzing}>
              {isAnalyzing ? "诊断生成中，请稍候" : "确认共识，生成三版奥德赛计划"}
              <Compass size={18} />
            </button>
          </div>

          <div className="review-section">
            <button className="review-toggle" onClick={() => setReviewOpen((value) => !value)} type="button">
              <ChevronDown className={reviewOpen ? "mirror-chevron is-open" : "mirror-chevron"} size={16} />
              <span>十二问回看与命理镜像</span>
              <em>{reviewOpen ? "收起" : "展开"}</em>
            </button>
            {reviewOpen ? (
              <>
                <div className="review-grid">
                  {answers
                    .filter((answer) => answer.questionId <= redDotQuestions.length)
                    .map((answer) => {
                      const question = redDotQuestions.find((item) => item.id === answer.questionId);
                      return (
                        <div className="review-card" key={answer.questionId}>
                          <span className="review-q">Q{answer.questionId} · {question?.theme}</span>
                          <p className="review-question">{question?.prompt}</p>
                          <p className="review-answer">{answer.text}</p>
                          {answer.confirmedRedDots?.length ? (
                            <span className="review-tags">
                              {answer.confirmedRedDots.map((id) => redDotById[id].shortName).join(" · ")}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
                {reflections.length ? (
                  <div className="review-mirrors">
                    <h4>命理镜像</h4>
                    {reflections.map((mirror) => (
                      <MirrorCard key={mirror.id} reflection={mirror} onUpdateNote={onUpdateNote} />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

const PLAN_KIND_ORDER: OdysseyPlan["kind"][] = ["current", "alternate", "ideal"];

const planKindMeta: Record<OdysseyPlan["kind"], { label: string; tag: string }> = {
  current: { label: "计划一 · 你已拥有的生活", tag: "CURRENT" },
  alternate: { label: "计划二 · 如果计划一突然消失", tag: "ALTERNATE" },
  ideal: { label: "计划三 · 不考虑金钱与形象", tag: "IDEAL" }
};

const PLAN_AXIS_LABELS = ["资源", "喜爱", "自信", "一致"];

const PLAN_KIND_COLORS: Record<OdysseyPlan["kind"], string> = {
  current: "#b08a3e",
  alternate: "#4a7d78",
  ideal: "#96607c"
};

type RadarSeries = { values: number[]; color: string };

// 四维雷达图（资源/喜爱/自信/一致），纯 SVG 字符串，页面与 HTML 导出共用
function radarChartSvg(series: RadarSeries[], options?: { size?: number; withLabels?: boolean }): string {
  const size = options?.size ?? 128;
  const withLabels = options?.withLabels ?? true;
  const pad = withLabels ? 22 : 10;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - pad;
  const angles = [-90, 0, 90, 180].map((deg) => (deg * Math.PI) / 180);
  const pt = (angle: number, value: number) => {
    const radius = R * Math.min(10, Math.max(0, value)) / 10;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  };
  const rings = [2.5, 5, 7.5, 10]
    .map((v) => `<polygon points="${angles.map((a) => pt(a, v)).join(" ")}" fill="none" stroke="rgba(36,33,29,0.12)" stroke-width="1" />`)
    .join("");
  const axes = angles
    .map((a) => {
      const [x, y] = pt(a, 10).split(",");
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(36,33,29,0.10)" stroke-width="1" />`;
    })
    .join("");
  const labels = withLabels
    ? angles
        .map((a, i) => {
          const lx = cx + (R + 10) * Math.cos(a);
          const ly = cy + (R + 10) * Math.sin(a);
          const anchor = Math.abs(Math.cos(a)) < 0.01 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
          const dy = Math.sin(a) < -0.01 ? -3 : Math.sin(a) > 0.01 ? 9 : 4;
          return `<text x="${lx.toFixed(1)}" y="${(ly + dy).toFixed(1)}" text-anchor="${anchor}" font-size="10" fill="#8a8272">${PLAN_AXIS_LABELS[i]}</text>`;
        })
        .join("")
    : "";
  const data = series
    .map(
      (s) =>
        `<polygon points="${angles.map((a, i) => pt(a, s.values[i] ?? 0)).join(" ")}" fill="${s.color}" fill-opacity="0.14" stroke="${s.color}" stroke-width="1.8" stroke-linejoin="round" />`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rings}${axes}${data}${labels}</svg>`;
}

function planRadarSeries(plan: OdysseyPlan, color: string): RadarSeries {
  return {
    values: [plan.dashboard.resources, plan.dashboard.love, plan.dashboard.confidence, plan.dashboard.coherence],
    color
  };
}

function Radar({ svg }: { svg: string }) {
  return <div className="radar" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// 莫比乌斯环加载动画：三色渐变的光点沿「8」字环追逐，暗示三版计划在同一循环中推演
function MobiusLoader() {
  const loopPath =
    "M40,70 C40,26 118,26 160,70 C202,114 280,114 280,70 C280,26 202,26 160,70 C118,114 40,114 40,70 Z";

  return (
    <svg className="mobius" viewBox="0 0 320 140" width="320" height="140" role="img" aria-label="推演中">
      <defs>
        <linearGradient id="mobius-grad-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b08a3e" />
          <stop offset="55%" stopColor="#4a7d78" />
          <stop offset="100%" stopColor="#96607c" />
        </linearGradient>
        <linearGradient id="mobius-grad-b" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#96607c" />
          <stop offset="55%" stopColor="#4a7d78" />
          <stop offset="100%" stopColor="#b08a3e" />
        </linearGradient>
      </defs>
      <path className="mobius-track" d={loopPath} pathLength="100" />
      <path className="mobius-run mobius-run-a" d={loopPath} pathLength="100" />
      <path className="mobius-run mobius-run-b" d={loopPath} pathLength="100" />
    </svg>
  );
}

function PlanBootScreen() {
  return (
    <div className="plan-boot">
      <MobiusLoader />
      <p className="plan-boot-title">正在沿莫比乌斯环推演你的三版人生</p>
      <p className="plan-boot-sub">计划一 · 你已拥有的生活　→　计划二 · 如果计划一突然消失　→　计划三 · 不考虑金钱与形象</p>
    </div>
  );
}

function PlanCardSkeleton({ kind }: { kind: OdysseyPlan["kind"] }) {
  return (
    <article className="plan-card is-skeleton" key={`skeleton-${kind}`}>
      <div className="plan-head">
        <div>
          <span className="plan-kind-tag">{planKindMeta[kind].tag}</span>
          <div className="skeleton-line skeleton-plan-title" />
          <div className="skeleton-line skeleton-plan-thesis" />
        </div>
        <div className="dashboard-mini">
          {[0, 1, 2, 3].map((i) => (
            <div className="dash-item" key={i}>
              <div className="skeleton-line skeleton-dash" />
              <span>{["资源", "喜爱", "自信", "一致"][i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="plan-body">
        <div>
          <h4>五年时间线</h4>
          <ul className="year-list">
            {[0, 1, 2, 3, 4].map((i) => (
              <li className="year-item" key={i}>
                <div className="skeleton-line skeleton-year" />
                <div>
                  <div className="skeleton-line skeleton-line-short" />
                  <div className="skeleton-line skeleton-line-long" />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-stack">
          <div className="path-card">
            <h4>风险排查</h4>
            {[0, 1, 2].map((i) => (
              <div className="skeleton-line skeleton-line-mid" key={i} />
            ))}
          </div>
          <div className="path-card">
            <h4>原型实验</h4>
            {[0, 1].map((i) => (
              <div className="skeleton-line skeleton-line-mid" key={i} />
            ))}
          </div>
        </div>
      </div>
      <div className="plan-body" style={{ paddingTop: 0 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <h4>第一年路径卡</h4>
          <div className="card-stack">
            {[0, 1, 2].map((i) => (
              <div className="path-card" key={i}>
                <div className="skeleton-line skeleton-line-short" />
                {[0, 1].map((j) => (
                  <div className="skeleton-line skeleton-line-mid" key={j} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function PlansPanel({ plans }: { plans: OdysseyPlan[] }) {
  const allReady = PLAN_KIND_ORDER.every((kind) => plans.some((item) => item.kind === kind));
  const overlaySvg = allReady
    ? radarChartSvg(
        PLAN_KIND_ORDER.map((kind) => planRadarSeries(plans.find((item) => item.kind === kind)!, PLAN_KIND_COLORS[kind])),
        { size: 156 }
      )
    : "";

  // 三版都未出现前，先整屏展示莫比乌斯环推演加载页；第一张卡出来后切回「已出卡片 + 骨架」网格
  if (plans.length === 0) {
    return (
      <div className="content">
        <PlanBootScreen />
      </div>
    );
  }

  return (
    <div className="content">
      {allReady ? (
        <div className="plan-compare">
          <Radar svg={overlaySvg} />
          <div className="compare-legend">
            <h4>三版四维对比</h4>
            <p>同一组红点，三种约束条件。四个维度是 资源（现实支撑）、喜爱（热爱程度）、自信（把握感）、一致（与内核的契合）。面积越饱满，这一版当下的动能越均衡。</p>
            <ul>
              {PLAN_KIND_ORDER.map((kind) => (
                <li key={kind}>
                  <i style={{ background: PLAN_KIND_COLORS[kind] }} />
                  {planKindMeta[kind].label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="plan-grid">
        {PLAN_KIND_ORDER.map((kind) => {
          const plan = plans.find((item) => item.kind === kind);

          if (!plan) {
            return <PlanCardSkeleton key={`skeleton-${kind}`} kind={kind} />;
          }

          return (
          <article className="plan-card" key={kind}>
            <div className="plan-head">
              <div>
                <span className="plan-kind-tag">{planKindMeta[kind].tag}</span>
                <h3>{plan.title}</h3>
                <p>{plan.thesis}</p>
              </div>
              <div className="plan-head-radar">
                <Radar svg={radarChartSvg([planRadarSeries(plan, PLAN_KIND_COLORS[kind])], { size: 132 })} />
              </div>
            </div>

            <div className="plan-body">
              <div>
                <h4>五年时间线</h4>
                <ol className="timeline-rail">
                  {plan.timeline.map((item) => (
                    <li key={item.year}>
                      <span className="rail-node">{item.year.replace(/\D/g, "") || "•"}</span>
                      <div className="rail-content">
                        <b>{item.year} · {item.theme}</b>
                        <p>{item.focus}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="card-stack">
                <div className="path-card">
                  <h4>风险排查</h4>
                  <ol className="risk-list">
                    {plan.risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ol>
                </div>
                <div className="path-card">
                  <h4>原型实验</h4>
                  <ol className="proto-list">
                    {plan.prototypes.map((prototype) => (
                      <li key={prototype}>{prototype}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <div className="plan-body" style={{ paddingTop: 0 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <h4>第一年路径卡</h4>
                <div className="card-stack">
                  {plan.firstYearCards.map((card, index) => (
                    <div className={`path-card type-${index}`} key={card.title}>
                      <h4><span className="card-type-tag">{card.type}</span>{card.category} · {card.title}</h4>
                      <ul>
                        {card.actions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [birthForm, setBirthForm] = useState<BirthForm>(defaultBirthForm);
  const [profile, setProfile] = useState<BaziProfile | null>(null);
  const [stage, setStage] = useState<"birth" | "intro" | "questions" | "result" | "plans">("birth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [diagnosisDraft, setDiagnosisDraft] = useState<DiagnosisDraftResponse | null>(null);
  const [answers, setAnswers] = useState<ExplorationAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reflections, setReflections] = useState<MirrorEntry[]>([]);
  const [direction, setDirection] = useState("");
  const [plans, setPlans] = useState<OdysseyPlan[]>([]);

  const activeStep = stage === "birth" || stage === "intro" ? 0 : stage === "questions" ? 1 : stage === "result" ? 2 : 3;

  async function submitBirthInfo() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/bazi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(birthForm)
      });
      const data = (await response.json()) as BaziResponse & { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "排盘失败");
      }

      setProfile(data.profile);

      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          birthForm,
          baziProfile: data.profile
        })
      });
      const sessionData = (await sessionResponse.json()) as SessionResponse & { message?: string };

      if (sessionResponse.ok) {
        setSessionId(sessionData.session.id);
      }

      setStage("intro");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "排盘失败");
    } finally {
      setLoading(false);
    }
  }

  function updateReflectionNote(mirrorId: string, note: string) {
    setReflections((items) =>
      items.map((item) => (item.id === mirrorId ? { ...item, note } : item))
    );
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildExportHtml(): string {
    const section = (title: string, body: string) =>
      `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;

    const baziSection = profile
      ? section(
          "命理画像",
          `<div class="pillars">
            ${(["year", "month", "day", "hour"] as const)
              .map((key) => {
                const labelMap = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" };
                const tenGod = key === "day" ? "日主" : profile?.tenGods?.[key] ?? "";
                return `<div class="pillar"><strong>${escapeHtml(profile.pillars[key])}</strong><span>${labelMap[key]}</span>${tenGod ? `<em>${escapeHtml(tenGod)}</em>` : ""}</div>`;
              })
              .join("")}
          </div>
          <p class="muted">日主 ${escapeHtml(profile.dayMaster.stem)}${escapeHtml(profile.dayMaster.label)} · ${escapeHtml(profile.dayMaster.cue)}</p>`
        )
      : "";

    const diagnosisSection = diagnosisDraft
      ? section(
          "诊断报告",
          `<h3>现在的你是什么人</h3><p>${escapeHtml(diagnosisDraft.personPortrait)}</p>
           <h3>结合命理的过往解读</h3><p>${escapeHtml(diagnosisDraft.lifeInterpretation)}</p>
           <h3>Top 3 红点与原因</h3><ul>${diagnosisDraft.top3Reasons
             .map((reason) => `<li>${escapeHtml(reason)}</li>`)
             .join("")}</ul>`
        )
      : "";

    const mirrorSection = reflections.length
      ? section(
          "命理镜像信笺",
          reflections
            .map(
              (mirror) => `<div class="mirror">
                ${mirror.keywords?.length ? `<p class="keywords">${mirror.keywords.map((k) => `<span>${escapeHtml(k)}</span>`).join("")}</p>` : ""}
                <p class="mirror-text">${escapeHtml(mirror.text)}</p>
                ${mirror.note ? `<p class="note">批注：${escapeHtml(mirror.note)}</p>` : ""}
              </div>`
            )
            .join("")
        )
      : "";

    const answersSection = answers.length
      ? section(
          "十二问回答",
          answers
            .map((answer) => {
              const question = redDotQuestions.find((item) => item.id === answer.questionId);
              return `<div class="qa"><p class="q">${answer.questionId}. ${escapeHtml(question?.prompt ?? "")}</p><p class="a">${escapeHtml(answer.text)}</p></div>`;
            })
            .join("")
        )
      : "";

    const plansSection = plans.length
      ? section(
          "三版奥德赛计划",
          (PLAN_KIND_ORDER.every((kind) => plans.some((item) => item.kind === kind))
            ? `<div class="plan-compare">
                <div class="radar">${radarChartSvg(
                  PLAN_KIND_ORDER.map((kind) => {
                    const plan = plans.find((item) => item.kind === kind)!;
                    return planRadarSeries(plan, PLAN_KIND_COLORS[kind]);
                  }),
                  { size: 156 }
                )}</div>
                <div class="compare-legend">
                  <h4>三版四维对比</h4>
                  <p>同一组红点，三种约束条件。面积越饱满，这一版当下的动能越均衡。</p>
                  <ul>${PLAN_KIND_ORDER.map((kind) => `<li><i style="background:${PLAN_KIND_COLORS[kind]}"></i>${planKindMeta[kind].label}</li>`).join("")}</ul>
                </div>
              </div>`
            : "") +
          PLAN_KIND_ORDER.map((kind) => {
            const plan = plans.find((item) => item.kind === kind);
            if (!plan) return "";
            return `<div class="plan">
              <p class="plan-kind">${planKindMeta[kind].label}</p>
              <h3>${escapeHtml(plan.title)}</h3>
              <p class="thesis">${escapeHtml(plan.thesis)}</p>
              <div class="plan-visual">
                <div class="radar">${radarChartSvg([planRadarSeries(plan, PLAN_KIND_COLORS[kind])], { size: 132 })}</div>
                <div class="dash">${([
                  ["资源", plan.dashboard.resources],
                  ["喜爱", plan.dashboard.love],
                  ["自信", plan.dashboard.confidence],
                  ["一致", plan.dashboard.coherence]
                ] as const)
                  .map(([label, value]) => `<div class="dash-item"><strong>${value}</strong><span>${label}</span></div>`)
                  .join("")}</div>
              </div>
              <h4>五年时间线</h4>
              <ul>${plan.timeline.map((item) => `<li><strong>${escapeHtml(item.year)} ${escapeHtml(item.theme)}</strong> — ${escapeHtml(item.focus)}</li>`).join("")}</ul>
              <h4>风险排查</h4><ul>${plan.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
              <h4>原型实验</h4><ul>${plan.prototypes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              <h4>第一年路径卡</h4>
              ${plan.firstYearCards
                .map(
                  (card) => `<div class="path-card"><p class="card-title">${escapeHtml(card.type)}卡 · ${escapeHtml(card.category)} · ${escapeHtml(card.title)}</p><ul>${card.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul></div>`
                )
                .join("")}
            </div>`;
          }).join("")
        )
      : "";

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>人生罗盘 · 奥德赛计划报告</title>
<style>
  body { margin: 0; padding: 48px 24px; background: #f6f2ea; color: #2c2a26; font-family: "Songti SC", "Noto Serif SC", serif; line-height: 1.75; }
  main { max-width: 860px; margin: 0 auto; background: #fffdf8; border: 1px solid #e5ddcb; border-radius: 16px; padding: 48px 56px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 20px; margin: 40px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #c9a25e; color: #8a6a2f; }
  h3 { font-size: 16px; margin: 18px 0 6px; }
  h4 { font-size: 14px; margin: 16px 0 6px; color: #6b6255; }
  p, li { font-size: 14px; }
  .meta { color: #8a8272; font-size: 13px; margin-bottom: 8px; }
  .muted { color: #8a8272; font-size: 13px; }
  .pillars { display: flex; gap: 12px; margin-bottom: 10px; }
  .pillar { border: 1px solid #e5ddcb; border-radius: 10px; padding: 10px 16px; text-align: center; background: #fbf7ee; }
  .pillar strong { display: block; font-size: 20px; }
  .pillar span { font-size: 12px; color: #8a8272; }
  .pillar em { font-style: normal; font-size: 12px; color: #b08a3e; }
  .mirror { border-left: 3px solid #c9a25e; background: #fbf7ee; padding: 14px 18px; margin: 12px 0; border-radius: 0 10px 10px 0; }
  .keywords span { display: inline-block; background: #f0e2c4; color: #8a6a2f; border-radius: 999px; padding: 2px 12px; font-size: 12px; margin-right: 6px; }
  .note { color: #b08a3e; font-size: 13px; }
  .qa { margin: 12px 0; }
  .q { font-weight: 600; margin-bottom: 2px; }
  .a { color: #55503f; margin: 0; white-space: pre-wrap; }
  .plan { border: 1px solid #e5ddcb; border-radius: 14px; padding: 20px 24px; margin: 16px 0; background: #fffdf8; }
  .plan-kind { color: #b08a3e; font-size: 12px; letter-spacing: 2px; margin: 0; }
  .thesis { color: #55503f; }
  .dash { display: flex; gap: 12px; margin: 10px 0; }
  .dash-item { border: 1px solid #e5ddcb; border-radius: 10px; padding: 6px 14px; text-align: center; }
  .dash-item strong { display: block; font-size: 18px; }
  .dash-item span { font-size: 12px; color: #8a8272; }
  .plan-visual { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
  .radar { flex: none; }
  .radar svg { display: block; }
  .plan-compare { display: flex; gap: 22px; align-items: center; border: 1px solid #e5ddcb; border-radius: 14px; background: #fbf7ee; padding: 16px 20px; margin-bottom: 16px; flex-wrap: wrap; }
  .compare-legend h4 { margin: 0 0 6px; }
  .compare-legend p { color: #8a8272; font-size: 13px; margin: 0 0 8px; }
  .compare-legend ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
  .compare-legend li { font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .compare-legend li i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  ul { padding-left: 20px; }
  .path-card { border: 1px dashed #c9a25e; border-radius: 10px; padding: 12px 16px; margin: 8px 0; }
  .card-title { font-weight: 600; margin: 0 0 4px; }
</style>
</head>
<body>
<main>
  <h1>人生罗盘 · 奥德赛计划报告</h1>
  <p class="meta">生成时间 ${new Date().toLocaleString("zh-CN")}${direction ? ` · 探索方向：${escapeHtml(direction)}` : ""}</p>
  ${baziSection}
  ${diagnosisSection}
  ${mirrorSection}
  ${answersSection}
  ${plansSection}
</main>
</body>
</html>`;
  }

  function exportHtml() {
    const blob = new Blob([buildExportHtml()], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pathfinder-奥德赛计划.html";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      {loading ? <OdysseyLoading /> : null}
      <div className="workspace">
        <ProfileSidebar profile={profile} activeStep={activeStep} />

        <section className="main-panel">
          <header className="main-header">
            <div>
              <h2>从八字命理，到红点探索，再到奥德赛计划</h2>
            </div>
            <div className="header-actions">
              <button className="icon-button" onClick={exportHtml} title="导出 HTML 报告" disabled={!profile}>
                <Download size={18} />
              </button>
            </div>
          </header>

          {error && stage !== "birth" ? <div className="global-error notice">{error}</div> : null}

          {stage === "birth" ? (
            <BirthPanel birthForm={birthForm} setBirthForm={setBirthForm} onSubmit={submitBirthInfo} loading={loading} error={error} />
          ) : null}

          {stage === "intro" && profile ? <BaziIntro profile={profile} onStart={() => setStage("questions")} /> : null}

          {stage === "questions" && profile ? (
            <QuestionPanel
              profile={profile}
              answers={answers}
              setAnswers={setAnswers}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              reflections={reflections}
              setReflections={setReflections}
              sessionId={sessionId}
              setSessionId={setSessionId}
              setError={setError}
              onComplete={() => setStage("result")}
            />
          ) : null}

          {stage === "result" ? (
            <ResultPanel
              answers={answers}
              profile={profile}
              reflections={reflections}
              onUpdateNote={updateReflectionNote}
              direction={direction}
              setDirection={setDirection}
              sessionId={sessionId}
              diagnosisDraft={diagnosisDraft}
              setDiagnosisDraft={setDiagnosisDraft}
              setError={setError}
              onGeneratePlans={async (topDots) => {
                setError("");

                // 计划一先行，计划二三并行（都参考计划一的摘要，保证承接逻辑，同时省一半等待）
                  type PlanSummary = { kind: string; title: string; thesis: string; timelineThemes: string[] };
                  const requestPlan = async (kind: OdysseyPlan["kind"], previous: PlanSummary[]) => {
                    const response = await fetch("/api/odyssey/plans", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        sessionId: sessionId || undefined,
                        kind,
                        topDots,
                        direction,
                        answers,
                        profile: profile ?? undefined,
                        previouslyGenerated: previous.length ? previous : undefined
                      })
                    });

                    if (!response.ok) {
                      const data = (await response.json().catch(() => null)) as { message?: string } | null;
                      throw new Error(data?.message ?? "生成奥德赛计划失败");
                    }

                    return ((await response.json()) as { plan: OdysseyPlan }).plan;
                  };

                  try {
                    await fetch("/api/diagnosis/confirm", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        sessionId: sessionId || undefined,
                        finalRedDots: topDots
                      })
                    });

                    setPlans([]);
                    setStage("plans");

                    const currentPlan = await requestPlan("current", []);
                    setPlans((prev2) => [...prev2.filter((item) => item.kind !== currentPlan.kind), currentPlan]);

                    const currentSummary: PlanSummary[] = [
                      {
                        kind: currentPlan.kind,
                        title: currentPlan.title,
                        thesis: currentPlan.thesis,
                        timelineThemes: currentPlan.timeline.map((item) => item.theme)
                      }
                    ];

                    const restResults = await Promise.allSettled([
                      requestPlan("alternate", currentSummary),
                      requestPlan("ideal", currentSummary)
                    ]);

                    const failedKinds: string[] = [];
                    restResults.forEach((result, index) => {
                      if (result.status === "fulfilled") {
                        const plan = result.value;
                        setPlans((prev2) => [...prev2.filter((item) => item.kind !== plan.kind), plan]);
                      } else {
                        failedKinds.push(index === 0 ? "计划二" : "计划三");
                      }
                    });

                    if (failedKinds.length) {
                      setError(`${failedKinds.join("、")}生成失败，其余版本已就绪，请稍后重试。`);
                    }
                  } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : "生成奥德赛计划失败");
                  }
              }}
            />
          ) : null}

          {stage === "plans" ? <PlansPanel plans={plans} /> : null}
        </section>
      </div>
    </main>
  );
}
