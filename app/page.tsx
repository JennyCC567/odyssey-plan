"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Download,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  ScrollText,
  Sparkles,
  Target,
  Waypoints
} from "lucide-react";
import { createBaziReflection, type BaziProfile } from "./lib/bazi";
import { isSupportedCity, searchCities, supportedCities } from "./lib/cities";
import { analyzeDiagnosis, generateOdysseyPlans, inferEvidenceTagsFromText, scoreRedDots, type ExplorationAnswer, type OdysseyPlan } from "./lib/odyssey";
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
    title: "轻命理开场",
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

const MAX_FOLLOW_UP_QUESTIONS = 2;
const CITY_DATALIST_ID = "birth-city-options";

function PillarView({ label, value }: { label: string; value: string }) {
  return (
    <div className="pillar">
      <strong>{value}</strong>
      <span>{label}</span>
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
            <h2>命理轻画像</h2>
            <div className="pillar-grid">
              <PillarView label="年柱" value={profile.pillars.year} />
              <PillarView label="月柱" value={profile.pillars.month} />
              <PillarView label="日柱" value={profile.pillars.day} />
              <PillarView label="时柱" value={profile.pillars.hour} />
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
          生成轻命理画像
        </button>
      </div>
    </div>
  );
}

function BaziIntro({ profile, onStart }: { profile: BaziProfile; onStart: () => void }) {
  return (
    <div className="content">
      <div className="ritual-copy">
        <span>命理轻画像</span>
        <h3>这不是结论，只是一面先照见惯性的镜子。</h3>
      </div>

      <div className="split-grid">
        <section className="panel-block">
          <div className="panel-block-header">
            <h3>轻命理开场</h3>
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

function QuestionPanel({
  profile,
  answers,
  setAnswers,
  currentIndex,
  setCurrentIndex,
  reflections,
  setReflections,
  onComplete
}: {
  profile: BaziProfile;
  answers: ExplorationAnswer[];
  setAnswers: (answers: ExplorationAnswer[]) => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  reflections: string[];
  setReflections: (items: string[]) => void;
  onComplete: () => void;
}) {
  const question = redDotQuestions[currentIndex];
  const existing = answers.find((answer) => answer.questionId === question.id);
  const [draft, setDraft] = useState(existing?.text ?? "");
  const [confirmedRedDots, setConfirmedRedDots] = useState<RedDotId[]>(existing?.confirmedRedDots ?? []);
  const progress = answers.length;
  const showRedDotModel = question.id >= 10;
  const redDotCandidates = useMemo(() => {
    const ranked = scoreRedDots(answers)
      .filter((score) => score.score > 0)
      .slice(0, 5)
      .map((score) => redDotById[score.id]);

    return ranked.length >= 3 ? ranked : redDots.slice(0, 5);
  }, [answers]);

  function toggleRedDot(redDotId: RedDotId) {
    setConfirmedRedDots((items) => (items.includes(redDotId) ? items.filter((item) => item !== redDotId) : [...items, redDotId]));
  }

  function saveAnswer() {
    const nextAnswer: ExplorationAnswer = {
      questionId: question.id,
      text: draft,
      tags: inferEvidenceTagsFromText(draft, question.evidenceTags),
      confirmedRedDots: showRedDotModel ? confirmedRedDots : undefined
    };
    const nextAnswers = [...answers.filter((answer) => answer.questionId !== question.id), nextAnswer].sort(
      (a, b) => a.questionId - b.questionId
    );
    setAnswers(nextAnswers);

    if (question.id % 3 === 0) {
      const reflection = createBaziReflection(profile, question.id, draft);
      setReflections([...reflections, reflection]);
    }

    if (question.id === redDotQuestions.length) {
      onComplete();
      return;
    }

    const nextIndex = currentIndex + 1;
    const nextExisting = nextAnswers.find((answer) => answer.questionId === redDotQuestions[nextIndex].id);
    setCurrentIndex(nextIndex);
    setDraft(nextExisting?.text ?? "");
    setConfirmedRedDots(nextExisting?.confirmedRedDots ?? []);
  }

  function goPrevious() {
    const nextIndex = Math.max(0, currentIndex - 1);
    const nextExisting = answers.find((answer) => answer.questionId === redDotQuestions[nextIndex].id);
    setCurrentIndex(nextIndex);
    setDraft(nextExisting?.text ?? "");
    setConfirmedRedDots(nextExisting?.confirmedRedDots ?? []);
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
                <h4>红九模型对照</h4>
                <p>现在才进入类型解释：这里不是让你凭名字认领，而是从前面积累的证据里筛出最多 5 个候选，再让你对照含义确认 Top 3。</p>
                <div className="choice-grid">
                  {redDotCandidates.map((dot) => (
                    <button
                      className={confirmedRedDots.includes(dot.id) ? "choice-chip is-selected" : "choice-chip"}
                      key={dot.id}
                      onClick={() => toggleRedDot(dot.id)}
                      type="button"
                      title={dot.trait}
                    >
                      {dot.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="button-row">
              <button className="ghost-button" onClick={goPrevious} disabled={currentIndex === 0}>
                <ArrowLeft size={18} />
                上一问
              </button>
              <button className="primary-button" onClick={saveAnswer} disabled={!draft.trim() || (showRedDotModel && confirmedRedDots.length === 0)}>
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
              reflections.map((reflection, index) => (
                <div className="mirror-card" key={reflection}>
                  <strong>第 {index + 1} 次镜像</strong>
                  <p>{reflection}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">完成第 3、6、9、12 问后，这里会出现命理镜像回应。</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ResultPanel({
  answers,
  setAnswers,
  onGeneratePlans,
  direction,
  setDirection
}: {
  answers: ExplorationAnswer[];
  setAnswers: (answers: ExplorationAnswer[]) => void;
  onGeneratePlans: (topDots: RedDotId[]) => void;
  direction: string;
  setDirection: (value: string) => void;
}) {
  const scores = useMemo(() => scoreRedDots(answers), [answers]);
  const diagnosis = useMemo(() => analyzeDiagnosis(scores), [scores]);
  const positiveScores = scores.filter((score) => score.score > 0);
  const topScores = positiveScores.length >= 3 ? positiveScores.slice(0, 3) : scores.slice(0, 3);
  const consensusSeedKey = positiveScores.slice(0, 3).map((score) => score.id).join("|");
  const followUpCount = answers.filter((answer) => answer.questionId >= 13).length;
  const canAskFollowUp = diagnosis.status === "needs_follow_up" && followUpCount < MAX_FOLLOW_UP_QUESTIONS;
  const isLowConfidenceDraft = diagnosis.status === "needs_follow_up" && !canAskFollowUp;
  const canEditConsensus = diagnosis.status === "confident" || isLowConfidenceDraft;
  const recommendedDots = useMemo(() => {
    const ranked = scores.filter((score) => score.score > 0).slice(0, 5).map((score) => redDotById[score.id]);
    return ranked.length >= 3 ? ranked : redDots.slice(0, 5);
  }, [scores]);
  const activeFollowUp = canAskFollowUp ? diagnosis.followUpQuestions[0] : undefined;
  const [showAllDots, setShowAllDots] = useState(false);
  const [consensusDots, setConsensusDots] = useState<RedDotId[]>(positiveScores.slice(0, 3).map((score) => score.id));
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [followUpConfirmedDots, setFollowUpConfirmedDots] = useState<RedDotId[]>([]);
  const selectableDots = showAllDots ? redDots : recommendedDots;

  useEffect(() => {
    setConsensusDots(consensusSeedKey ? (consensusSeedKey.split("|") as RedDotId[]) : []);
  }, [consensusSeedKey]);

  useEffect(() => {
    setFollowUpDraft("");
    setFollowUpConfirmedDots([]);
  }, [activeFollowUp?.id]);

  function toggleConsensusDot(redDotId: RedDotId) {
    setConsensusDots((items) => {
      if (items.includes(redDotId)) return items.filter((item) => item !== redDotId);
      if (items.length >= 3) return [...items.slice(1), redDotId];
      return [...items, redDotId];
    });
  }

  function toggleFollowUpRedDot(redDotId: RedDotId) {
    setFollowUpConfirmedDots((items) => (items.includes(redDotId) ? [] : [redDotId]));
  }

  function saveFollowUpAnswer() {
    if (!activeFollowUp) return;

    const questionId = Math.max(13, ...answers.map((answer) => answer.questionId + 1));
    const nextAnswers = [
      ...answers,
      {
        questionId,
        text: followUpDraft,
        tags: inferEvidenceTagsFromText(followUpDraft, activeFollowUp.evidenceTags),
        confirmedRedDots: followUpConfirmedDots
      }
    ].sort((a, b) => a.questionId - b.questionId);

    setAnswers(nextAnswers);
  }

  return (
    <div className="content">
      <section className="panel-block manuscript-panel">
        <div className="panel-block-header">
          <h3>诊断草案</h3>
          <span className="badge">专业分析 + 用户确认</span>
        </div>
        <div className="panel-body">
          <div className="notice" style={{ marginTop: 0 }}>
            <ScrollText size={18} />
            <span>这是基于前 9 问生活证据、第 10-12 问模型确认和文本关键词生成的草案。请把它当作可讨论的假设，而不是最终判决；你可以在下方修订 Top 3，形成共同共识后再生成奥德赛计划。</span>
          </div>

          {diagnosis.status === "needs_follow_up" ? (
            <div className="diagnosis-gate">
              <div className="notice is-warning" style={{ marginTop: 0 }}>
                <MessageSquareText size={18} />
                <span>
                  {canAskFollowUp
                    ? `不确定，需要补问。当前是第 ${followUpCount + 1} / ${MAX_FOLLOW_UP_QUESTIONS} 题；现在不会强行给出最终 Top 3，也不会直接生成奥德赛计划。`
                    : "已经完成 2 题补问，系统仍保留不确定性。下面进入低置信诊断草案，请由用户修订并形成共识后再继续。"}
                </span>
              </div>

              <div className="reason-list">
                {diagnosis.reasons.map((reason) => (
                  <div className="reason-item" key={reason}>{reason}</div>
                ))}
              </div>

              {activeFollowUp ? (
                <div className="model-explainer" style={{ marginTop: 18 }}>
                  <h4>补问：用真实取舍校准诊断</h4>
                  <p>{activeFollowUp.prompt}</p>

                  <div className="candidate-strip">
                    {activeFollowUp.candidates.map((candidate) => {
                      const dot = redDotById[candidate];

                      return (
                        <div className="candidate-pill" key={candidate} title={dot.trait}>
                          <strong>{dot.shortName}</strong>
                          <span>{dot.quadrant}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="field" style={{ marginTop: 14 }}>
                    <label>补充回答</label>
                    <textarea
                      className="answer-box"
                      value={followUpDraft}
                      onChange={(event) => setFollowUpDraft(event.target.value)}
                      placeholder="写一个真实发生的例子：当时有哪些选项、你实际选择了什么、付出了什么代价、现在回看是否仍然认可。"
                    />
                  </div>

                  <p className="choice-caption">如果必须判断，这个例子更支持哪一个候选？</p>
                  <div className="choice-grid">
                    {activeFollowUp.candidates.map((candidate) => {
                      const dot = redDotById[candidate];

                      return (
                        <button
                          className={followUpConfirmedDots.includes(candidate) ? "choice-chip is-selected" : "choice-chip"}
                          key={candidate}
                          onClick={() => toggleFollowUpRedDot(candidate)}
                          type="button"
                          title={dot.trait}
                        >
                          {dot.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="button-row">
                    <button
                      className="primary-button"
                      onClick={saveFollowUpAnswer}
                      disabled={!followUpDraft.trim() || followUpConfirmedDots.length === 0}
                    >
                      保存补问并重新诊断
                      <ArrowRight size={18} />
                    </button>
                    <button className="ghost-button" type="button" disabled>
                      共识未形成，暂不生成计划
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

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

          {canEditConsensus ? (
            <>
              <div className="model-explainer" style={{ marginTop: 18 }}>
                <h4>{isLowConfidenceDraft ? "低置信修订窗口：人工确认共同结论" : "修订窗口：确认共同结论"}</h4>
                <p>
                  {isLowConfidenceDraft
                    ? "系统已经补问两轮但证据仍未完全收敛。此时不再继续追问，请把推荐候选当作低置信草案，由你重新选择最终 Top 3；这个人工确认会作为后续奥德赛计划的前提。"
                    : "如果草案不符合你的真实感受，可以先从推荐候选里重新选择最终 Top 3。这里的选择会作为后续奥德赛计划的前提。"}
                </p>
                <div className="choice-grid">
                  {selectableDots.map((dot) => (
                    <button
                      className={consensusDots.includes(dot.id) ? "choice-chip is-selected" : "choice-chip"}
                      key={dot.id}
                      onClick={() => toggleConsensusDot(dot.id)}
                      type="button"
                      title={dot.trait}
                    >
                      {dot.name}
                    </button>
                  ))}
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
                <button className="primary-button" onClick={() => onGeneratePlans(consensusDots)} disabled={consensusDots.length !== 3}>
                  确认共识，生成三版奥德赛计划
                  <Compass size={18} />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PlansPanel({ plans }: { plans: OdysseyPlan[] }) {
  return (
    <div className="content">
      <div className="plan-grid">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.kind}>
            <div className="plan-head">
              <div>
                <h3>{plan.title}</h3>
                <p>{plan.thesis}</p>
              </div>
              <div className="dashboard-mini">
                <div className="dash-item">
                  <strong>{plan.dashboard.resources}</strong>
                  <span>资源</span>
                </div>
                <div className="dash-item">
                  <strong>{plan.dashboard.love}</strong>
                  <span>喜爱</span>
                </div>
                <div className="dash-item">
                  <strong>{plan.dashboard.confidence}</strong>
                  <span>自信</span>
                </div>
                <div className="dash-item">
                  <strong>{plan.dashboard.coherence}</strong>
                  <span>一致</span>
                </div>
              </div>
            </div>

            <div className="plan-body">
              <div>
                <h4>五年时间线</h4>
                <ul className="year-list">
                  {plan.timeline.map((item) => (
                    <li className="year-item" key={item.year}>
                      <strong>{item.year}</strong>
                      <div>
                        <b>{item.theme}</b>
                        <p>{item.focus}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-stack">
                <div className="path-card">
                  <h4>风险排查</h4>
                  <ul>
                    {plan.risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
                <div className="path-card">
                  <h4>原型实验</h4>
                  <ul>
                    {plan.prototypes.map((prototype) => (
                      <li key={prototype}>{prototype}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="plan-body" style={{ paddingTop: 0 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <h4>第一年路径卡</h4>
                <div className="card-stack">
                  {plan.firstYearCards.map((card) => (
                    <div className="path-card" key={card.title}>
                      <h4>{card.type} · {card.title}</h4>
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
        ))}
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
  const [answers, setAnswers] = useState<ExplorationAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reflections, setReflections] = useState<string[]>([]);
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
      setStage("intro");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "排盘失败");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setProfile(null);
    setStage("birth");
    setAnswers([]);
    setCurrentIndex(0);
    setReflections([]);
    setDirection("");
    setPlans([]);
    setError("");
  }

  function exportJson() {
    const payload = JSON.stringify({ birthForm, profile, answers, reflections, direction, plans }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pathfinder-demo-session.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <div className="workspace">
        <ProfileSidebar profile={profile} activeStep={activeStep} />

        <section className="main-panel">
          <header className="main-header">
            <div>
              <h2>从八字命理，到红点探索，再到奥德赛计划</h2>
              <p>
                第一版 demo 采用“轻命理开场 + 十二问主线 + 三问一镜像”的节奏，让用户因为有趣开始，也因为自己的回答完成真正的方向判断。
              </p>
            </div>
            <div className="header-actions">
              <button className="icon-button" onClick={resetAll} title="重置">
                <RefreshCcw size={18} />
              </button>
              <button className="icon-button" onClick={exportJson} title="导出 JSON" disabled={!profile}>
                <Download size={18} />
              </button>
            </div>
          </header>

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
              onComplete={() => setStage("result")}
            />
          ) : null}

          {stage === "result" ? (
            <ResultPanel
              answers={answers}
              setAnswers={setAnswers}
              direction={direction}
              setDirection={setDirection}
              onGeneratePlans={(topDots) => {
                setPlans(generateOdysseyPlans(topDots, direction));
                setStage("plans");
              }}
            />
          ) : null}

          {stage === "plans" ? <PlansPanel plans={plans} /> : null}
        </section>
      </div>
    </main>
  );
}
