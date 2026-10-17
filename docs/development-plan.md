# 人生罗盘工程开发计划

更新时间：2026-10-15

本文档用于指导后续分阶段开发。产品主线是：八字命理轻分析 -> 人生红点十二问 -> 诊断草案与修订共识 -> 奥德赛计划。

## 1. 总工程判断

### 1.1 不建议现在拆成传统前后端分离

当前阶段最合适的架构是 **Next.js 全栈 BFF 单体**，也就是：

- 前端页面仍在 Next.js App Router 中开发。
- 后端能力先放在 `app/api/**/route.ts` 和 `app/lib/server/**` 里。
- LLM、提示词、数据库、命理算法都做成独立服务模块，避免和 UI 绑死。
- 等产品验证后，再决定是否拆成独立后端服务。

原因：

- 现在只有一个 Web 端，不需要为了“架构完整”额外维护独立后端仓库。
- LLM API key、会话存储、提示词版本、诊断状态这些确实需要服务端，但 Next.js API route 已经够用。
- BFF 单体可以最快闭环 demo、部署和试用，同时保留未来拆分空间。

未来满足以下条件时，再考虑真正前后端分离：

- 出现移动端、小程序、插件等多个客户端。
- 诊断服务要独立收费、独立扩容或给第三方调用。
- 提示词、模型编排、用户数据治理变得复杂，需要单独后端团队维护。
- 命理算法和 LLM 工作流需要异步任务队列、批处理或更复杂的权限系统。

### 1.2 Cloudflare 部署路线

你已有 Cloudflare 和自己的域名，所以生产部署优先按 Cloudflare 设计。

推荐路线：

- **MVP 生产环境：Cloudflare Workers 承载 Next.js 全栈应用**。
- **数据库：Cloudflare D1**，保存会话、回答、证据、诊断草案和计划版本。
- **未来文件：Cloudflare R2**，保存导出的 PDF、分享图、报告快照等。
- **域名：使用子域名**，例如 `odyssey.yourdomain.com` 或 `pathfinder.yourdomain.com`。

注意：当前八字计算是通过 Next.js route 调本地 Python 脚本实现的。Cloudflare Worker 环境不能直接沿用本地 `child_process` 调 Python 脚本的方式。上线前需要处理命理算法部署：

1. **推荐：把八字排盘核心算法移植到 TypeScript**。
   - 和 Next.js、Cloudflare Workers 最贴合。
   - 只保留城市数据、节气数据、四柱计算、五行统计、轻画像生成。
   - 用当前 Python 输出做回归测试，确保结果一致。

2. 备选：独立 Python Worker 或独立 Python 服务。
   - Cloudflare 已支持 Python Workers，但现有依赖和排盘脚本仍要验证兼容。
   - 独立服务会增加运维复杂度，不建议作为第一版。

3. 备选：先部署在支持 Node + Python 的平台，再迁 Cloudflare。
   - 可以更快上线，但不符合你已经有 Cloudflare 生态的长期方向。

我的建议是：**先做 LLM 后端和数据结构，再移植八字算法，最后上 Cloudflare 子域名**。

## 2. 当前状态

已完成：

- Next.js 前端 demo。
- 出生信息表单和可搜索城市选择。
- `/api/bazi` 调本地 Python 排盘。
- 八字轻画像、五行分布、三问一镜像的基础展示。
- 人生红点十二问主流程。
- 前 9 问不展示红点类型和证据标签。
- 后台用规则从回答文本提取证据标签。
- 诊断草案、补问、奥德赛计划目前以规则和模板为主。
- 东方水墨 + 希腊石色的视觉规范，见 `docs/visual-style-guide.md`。
- 理论模型底稿，见 `docs/theory-models.md`。

需要补齐：

- LLM 服务端调用。
- 提示词注册和版本管理。
- 结构化 JSON 输出校验。
- 会话和用户回答持久化。
- 诊断草案、补问、计划生成的真实 LLM 逻辑。
- 用户修订窗口和最终共识版本。
- Cloudflare 部署配置。
- 八字算法的生产部署方案。

## 3. 目标系统架构

```text
Browser
  |
  |  React UI, streaming display, session id
  v
Next.js App Router
  |
  |-- app/page.tsx
  |-- app/api/bazi/route.ts
  |-- app/api/session/route.ts
  |-- app/api/exploration/answer/route.ts
  |-- app/api/exploration/reflection/route.ts
  |-- app/api/diagnosis/draft/route.ts
  |-- app/api/diagnosis/follow-up/route.ts
  |-- app/api/diagnosis/confirm/route.ts
  |-- app/api/odyssey/plans/route.ts
  |
  v
Server Modules
  |
  |-- app/lib/domain/theory.ts
  |-- app/lib/domain/bazi.ts
  |-- app/lib/llm/client.ts
  |-- app/lib/llm/schemas.ts
  |-- app/lib/prompts/*.ts
  |-- app/lib/db/*.ts
  |-- app/lib/security/rate-limit.ts
  |
  v
External Services
  |
  |-- OpenAI API or compatible LLM
  |-- Cloudflare D1
  |-- Cloudflare R2, later
```

架构原则：

- UI 不直接调用 LLM。
- 所有模型调用都经过服务端 API。
- 所有 LLM 输出都必须是结构化 JSON，再由前端渲染。
- 诊断过程必须保存中间证据，不只保存最后报告。
- 八字只作为兴趣入口和镜像语言，不直接决定红点排序。
- 红点诊断必须基于生活证据、冲突取舍和用户确认。

## 4. 模块拆分

### 4.1 前端 UI

保留在 `app/page.tsx`，但后续逐步拆组件：

```text
app/components/
  BirthPanel.tsx
  ProfileSidebar.tsx
  QuestionPanel.tsx
  ReflectionPanel.tsx
  DiagnosisDraft.tsx
  RevisionWindow.tsx
  OdysseyPlans.tsx
```

前端职责：

- 展示当前阶段。
- 收集出生信息、十二问回答、补问回答、用户修订意见。
- 展示生成中状态。
- 渲染服务端返回的结构化结果。
- 不负责诊断逻辑，不保存 API key。

### 4.2 命理模块

短期：继续使用现有 Python 脚本本地开发。

中期：新增 TypeScript 命理模块：

```text
app/lib/bazi/
  calculator.ts
  jieqi.ts
  city.ts
  profile.ts
  fixtures.ts
```

命理模块输出只包括：

- 四柱。
- 日主和五行分布。
- 节气信息。
- 起运信息，如果稳定可用。
- 轻量观察线索。

命理模块禁止输出：

- 命定式判断。
- 绝对职业建议。
- 红点最终排序。
- 恐吓、灾祸、婚恋断言。

### 4.3 LLM 模块

建议目录：

```text
app/lib/llm/
  client.ts
  models.ts
  schemas.ts
  run-json.ts
  errors.ts

app/lib/prompts/
  system-coach.ts
  evidence-extractor.ts
  bazi-reflection.ts
  diagnosis-draft.ts
  diagnosis-follow-up.ts
  diagnosis-revision.ts
  odyssey-plan.ts
```

LLM 模块职责：

- 统一读取 `OPENAI_API_KEY` 和模型名。
- 统一设置超时、重试、日志脱敏。
- 统一使用 JSON Schema 或 Zod 校验输出。
- 统一处理模型失败时的降级文案。

### 4.4 数据模块

Cloudflare 方向建议优先用 D1。ORM 可以先不急，第一版可用轻量 SQL 封装，减少 Cloudflare 兼容风险。等表结构稳定后再引入 Drizzle。

```text
app/lib/db/
  client.ts
  schema.sql
  sessions.ts
  answers.ts
  diagnoses.ts
  plans.ts
```

## 5. 数据模型

第一版至少需要这些表。

### 5.1 sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  birth_year INTEGER,
  birth_month INTEGER,
  birth_day INTEGER,
  birth_hour INTEGER,
  birth_minute INTEGER,
  birth_city TEXT,
  gender TEXT,
  bazi_profile_json TEXT,
  final_red_dots_json TEXT
);
```

### 5.2 exploration_answers

```sql
CREATE TABLE exploration_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT NOT NULL,
  extracted_evidence_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.3 diagnosis_runs

```sql
CREATE TABLE diagnosis_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL,
  draft_json TEXT NOT NULL,
  follow_up_questions_json TEXT,
  user_revision_text TEXT,
  final_json TEXT,
  prompt_version TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 5.4 odyssey_plans

```sql
CREATE TABLE odyssey_plans (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  diagnosis_run_id TEXT NOT NULL,
  direction_text TEXT,
  plans_json TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

后续如果要登录，再加：

- `users`
- `session_users`
- `exports`
- `feedback_events`

MVP 阶段先做匿名 session。用户打开页面生成一个 session id，未来可以增加邮箱 magic link 保存报告。

## 6. API 设计

### 6.1 `POST /api/session`

创建匿名探索会话。

输入：

```json
{
  "source": "web"
}
```

输出：

```json
{
  "sessionId": "...",
  "status": "created"
}
```

### 6.2 `POST /api/bazi`

保留现有接口，后续内部从 Python 切换到 TypeScript。

输出需要保存到 `sessions.bazi_profile_json`。

### 6.3 `POST /api/exploration/answer`

保存单题回答，并调用 LLM 或规则引擎提取证据。

输入：

```json
{
  "sessionId": "...",
  "questionId": 1,
  "answerText": "..."
}
```

输出：

```json
{
  "saved": true,
  "evidence": [
    {
      "observation": "用户在关键选择里优先保护了长期自由。",
      "sourceQuote": "...",
      "candidateRedDots": ["experience", "wealth"],
      "confidence": 0.68,
      "counterEvidence": []
    }
  ]
}
```

前端不展示“证据标签选择”，但可以在诊断报告阶段展示经过解释的证据。

### 6.4 `POST /api/exploration/reflection`

每 3 问生成一次命理镜像回应。

输入：

```json
{
  "sessionId": "...",
  "answeredQuestionIds": [1, 2, 3]
}
```

输出：

```json
{
  "title": "第一面水镜",
  "text": "...",
  "reminder": "这只是命理启发，不参与红点定论。"
}
```

### 6.5 `POST /api/diagnosis/draft`

十二问完成后生成诊断草案。

输出必须允许两种状态：

```json
{
  "status": "needs_follow_up",
  "reason": "第三候选和第四候选边界不清。",
  "followUpQuestions": [
    {
      "prompt": "请补一个真实选择：当自由和稳定冲突时，你最后保护了什么？",
      "targetConflict": ["experience", "life"]
    }
  ]
}
```

或者：

```json
{
  "status": "draft_ready",
  "topCandidates": [
    {
      "redDotId": "work",
      "rank": 1,
      "confidence": 0.78,
      "why": "你反复提到希望把想法做成可沉淀的成果。",
      "evidence": ["Q2 ...", "Q5 ..."],
      "risksOfMisread": ["可能把被认可误读成作品本身。"]
    }
  ],
  "uncertainties": ["赚钱型和体验型仍有重叠。"],
  "revisionPrompt": "哪些地方不像你？哪些证据被我误读了？"
}
```

### 6.6 `POST /api/diagnosis/follow-up`

最多补问 2 题。

规则：

- 每次只问一个真正能区分候选的具体问题。
- 不让用户直接选类型名。
- 2 题后仍不确定，则输出低置信草案，而不是继续追问。

### 6.7 `POST /api/diagnosis/confirm`

用户修改、确认 Top 3，形成共同结论。

输入：

```json
{
  "sessionId": "...",
  "acceptedRedDots": ["work", "inner", "impact"],
  "revisionText": "我觉得出名不是核心，只是作品被看见后的结果。"
}
```

输出：

```json
{
  "finalRedDots": ["work", "inner", "impact"],
  "consensusSummary": "..."
}
```

### 6.8 `POST /api/odyssey/plans`

基于共同结论生成三版五年计划。

输入：

```json
{
  "sessionId": "...",
  "directionText": "我想探索内容产品、AI 工具和个人品牌结合的方向。"
}
```

输出：

```json
{
  "plans": [
    {
      "kind": "current",
      "title": "...",
      "thesis": "...",
      "timeline": [],
      "dashboard": {},
      "risks": [],
      "prototypes": [],
      "firstYearCards": []
    }
  ]
}
```

## 7. LLM 上下文策略

### 7.1 不把所有聊天都无脑塞给模型

每次调用模型都构造一个精简的 `caseFile`：

```ts
type CaseFile = {
  sessionId: string;
  baziProfile: BaziProfileSummary;
  questionAnswers: Array<{
    questionId: number;
    theme: string;
    prompt: string;
    answerText: string;
    extractedEvidence: EvidenceItem[];
  }>;
  currentHypotheses: RedDotHypothesis[];
  userRevision?: string;
};
```

上下文分层：

- **稳定理论上下文**：红九模型、十二问原则、产品守则。
- **用户事实上下文**：出生信息、命理轻画像、十二问回答、补问回答。
- **推理上下文**：证据项、候选红点、反证、不确定性。
- **任务上下文**：本次调用到底是提取证据、镜像回应、诊断草案还是生成计划。

### 7.2 证据格式

每条证据都要能回到用户原话：

```ts
type EvidenceItem = {
  questionId: number;
  sourceQuote: string;
  observation: string;
  candidateRedDots: RedDotId[];
  confidence: number;
  counterEvidence: string[];
};
```

禁止只有抽象结论：

- 不要只写“你是作品型”。
- 必须写“你在 Q5 提到希望留下一个可被反复使用的产品，这支持作品型，但还不能排除出名型，因为你也提到被看见。”

## 8. 提示词设计

提示词不要写成“算命大师”，而是“人生设计教练 + 证据推理员”。核心语气是温和、克制、可修订。

### 8.1 全局 System Prompt

```text
你是一个人生设计教练，任务是陪用户从八字命理的兴趣入口，进入人生红点十二问，并最终形成可测试的奥德赛计划。

你必须遵守：
1. 八字命理只作为自我观察入口，不作为命运定论。
2. 红点判断必须来自用户真实经历、选择、峰值、低谷、边界和取舍。
3. 前期不要诱导用户自我贴标签，不要让用户仅凭类型名字定义自己。
4. 当证据不足、候选分差小、边界不清时，必须说“不确定，需要补问”。
5. 补问最多 2 题。2 题后仍不确定，就输出低置信草案和可修订窗口。
6. 诊断报告是可讨论草案，不是权威判决。
7. 不使用“命中注定”“你一定适合”“你天生就是”这类定论式表达。
8. 输出必须遵循调用方提供的 JSON Schema。

你的表达气质：留白、克制、像共读一份手稿。不要营销，不要鸡血，不要玄学恐吓。
```

### 8.2 证据提取 Prompt

```text
任务：从用户对人生红点问题的回答中提取生活证据。

你会收到：
- 当前问题的编号、主题、原问题和追问。
- 用户回答原文。
- 红九模型定义。

请输出：
- 2 到 5 条证据。
- 每条证据必须包含用户原话短引、你的观察、可能支持的红点候选、置信度、可能的反证。
- 如果用户回答太空泛，要标记 needsMoreConcreteExample。

禁止：
- 不要直接告诉用户“你是某某型”。
- 不要因为出现一个关键词就下结论。
- 不要使用命理信息参与红点评分。
```

### 8.3 三问一命理镜像 Prompt

```text
任务：用户每完成 3 个红点问题后，生成一段命理镜像回应。

你会收到：
- 用户八字轻画像摘要。
- 最近 3 个问题和回答。
- 已提取的证据摘要。

请输出一段 120 到 180 字的回应：
- 先复述用户刚刚显露的一个真实张力。
- 再用命理轻画像作为一个观察角度。
- 最后提醒：真正的红点判断仍以用户经历和取舍为准。

语气：像水面映出一句提醒，轻、准、留白。
不要输出红点排序。
```

### 8.4 诊断草案 Prompt

```text
任务：基于十二问和补问证据，生成红点诊断草案。

你会收到：
- 红九模型。
- 用户十二问回答。
- 每题证据项。
- 命理轻画像摘要，但它只能用于表达风格，不可参与红点评分。

请判断：
- 是否足够输出 Top 3 草案。
- 如果不够，输出 needs_follow_up，并给出最多 2 个补问。
- 如果足够，输出 Top 3，每个候选必须包含支持证据、反证、不确定性和误读风险。

判断标准：
- 优先看真实发生的取舍，而不是用户的自我形容。
- 优先看冲突时保护了什么，而不是顺境里喜欢什么。
- 结果型和过程型要分开判断。
- 底线需求和核心追求要分开判断。

禁止：
- 不要把 Top 3 写成最终判决。
- 不要为了流程顺滑强行自信。
- 不要让用户直接从类型名里选答案。
```

### 8.5 诊断修订 Prompt

```text
任务：根据用户对诊断草案的反馈，形成共同结论。

你会收到：
- 诊断草案。
- 用户指出不认同、想修改或补充的内容。
- 原始证据。

请输出：
- 修订后的 Top 3。
- 哪些地方采纳了用户修订。
- 哪些地方仍保留专业提醒。
- 一个共识摘要，用于后续奥德赛计划。

原则：
- 用户不是被诊断对象，而是共同推理者。
- 用户认同很重要，但也要保留证据边界。
```

### 8.6 奥德赛计划 Prompt

```text
任务：基于共同确认的红点 Top 3 和用户想探索的方向，生成三版五年奥德赛计划。

你会收到：
- 最终红点 Top 3。
- 共识摘要。
- 用户方向输入。
- 用户关键资源、限制和风险，如果已有。

请生成三版计划：
1. 当前轨道：沿用当前资源和路径，但更贴近红点。
2. 备用轨道：当前路径消失时仍可认真投入的替代人生。
3. 理想轨道：暂时放下金钱、评价和身份压力后的版本。

每版必须包含：
- 标题。
- 核心假设。
- 五年时间线。
- 四维仪表盘：资源、热爱、信心、一致性。
- 三个风险。
- 两个低成本原型实验。
- 第一年行动卡：能力、资源、进步。

计划必须可测试，不要只写愿景。
```

## 9. 结构化输出 Schema

所有 LLM 输出都要结构化。示例：

```ts
export const EvidenceExtractionSchema = z.object({
  questionId: z.number(),
  needsMoreConcreteExample: z.boolean(),
  evidence: z.array(
    z.object({
      sourceQuote: z.string().max(120),
      observation: z.string(),
      candidateRedDots: z.array(redDotIdSchema).max(4),
      confidence: z.number().min(0).max(1),
      counterEvidence: z.array(z.string()).max(3)
    })
  ).min(1).max(5)
});
```

```ts
export const DiagnosisDraftSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("needs_follow_up"),
    reason: z.string(),
    followUpQuestions: z.array(
      z.object({
        prompt: z.string(),
        targetConflict: z.array(redDotIdSchema).min(1).max(4)
      })
    ).min(1).max(2)
  }),
  z.object({
    status: z.literal("draft_ready"),
    confidence: z.number().min(0).max(1),
    topCandidates: z.array(
      z.object({
        redDotId: redDotIdSchema,
        rank: z.number(),
        confidence: z.number().min(0).max(1),
        why: z.string(),
        evidence: z.array(z.string()).min(1).max(5),
        counterEvidence: z.array(z.string()).max(3),
        risksOfMisread: z.array(z.string()).max(3)
      })
    ).length(3),
    uncertainties: z.array(z.string()).max(5),
    revisionPrompt: z.string()
  })
]);
```

## 10. 隐私与安全

这个产品会收集出生时间、出生城市、人生经历和价值观判断，属于敏感度较高的数据。第一版也要做基本保护。

必须做：

- API key 只放服务端环境变量。
- 前端不暴露模型供应商 key。
- 不在日志里打印完整出生信息和完整回答。
- 给用户明确提示：命理是兴趣入口，诊断是探索草案。
- 提供删除当前会话数据的能力。
- 使用基础 rate limit，避免 LLM 调用被刷。

后续再做：

- 登录和报告归档。
- 导出 PDF 前的确认。
- 数据保留周期设置。
- 隐私政策页面。
- Cloudflare Turnstile 防滥用。

## 11. 环境变量

建议新增 `.env.example`：

```bash
OPENAI_API_KEY=
LLM_MODEL=
LLM_REASONING_MODEL=
APP_BASE_URL=http://localhost:3000
SESSION_COOKIE_NAME=odyssey_session
```

Cloudflare 生产环境后续使用：

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
```

D1 绑定名建议：

```text
DB
```

## 12. 测试策略

### 12.1 单元测试

- 城市搜索和城市校验。
- 红点模型映射。
- 证据提取 fallback 规则。
- 八字 TypeScript 移植后，对比 Python fixtures。

### 12.2 LLM 合约测试

- 用 mock LLM 输出验证 schema。
- 用 3 到 5 组样例回答跑 evidence extractor。
- 验证“不确定，需要补问”路径。
- 验证 2 题后不再无限追问。

### 12.3 E2E 测试

- 出生信息填写 -> 生成命理画像。
- 十二问填写 -> 三问一镜像出现。
- 诊断不确定 -> 补问出现。
- 用户修订 -> 共识 Top 3。
- 输入方向 -> 生成三版计划。

### 12.4 部署测试

- Cloudflare preview build。
- D1 migration。
- 自定义域名访问。
- LLM API key 是否只存在服务端。
- 八字计算在生产环境可用。

## 13. 分阶段执行计划

### Phase 0：收口当前 demo

目标：把当前前端 demo 和已讨论的产品原则稳定下来。

交付：

- 确认前 9 问不再展示证据标签。
- 保留后台规则证据推理作为 LLM 前的临时 fallback。
- 更新 README 和理论文档。
- `npm run build` 通过。
- 提交并推送当前改动。

完成标准：

- 用户回答十二问时不会看到“回报与自由 / 稳定与亲密”等干扰项。
- 页面仍能完整跑通到奥德赛计划模板。

### Phase 1：LLM 后端基础设施

目标：让项目具备真实模型调用能力，但不急着替换所有流程。

交付：

- `.env.example`。
- `app/lib/llm/client.ts`。
- `app/lib/llm/schemas.ts`。
- `app/lib/prompts/**` 第一版。
- 一个测试 API：`POST /api/llm/smoke`，开发期使用，生产前可删除。
- LLM 失败时的 fallback 策略。

完成标准：

- 本地配置 API key 后，可以得到结构化 JSON。
- 模型输出不符合 schema 时会被拦截，而不是直接进 UI。

### Phase 2：会话和数据库

目标：让探索过程可以保存和恢复。

交付：

- D1 schema 初版。
- 本地开发数据库方案。
- `POST /api/session`。
- 保存出生信息、八字画像、十二问回答。
- 会话恢复逻辑。

完成标准：

- 刷新页面后不会丢失当前 session。
- 数据表能看到用户每题回答和证据 JSON。

### Phase 3：LLM 证据提取和三问一镜像

目标：把最关键的“从生活细节推理，而不是用户自我贴标签”落到后端。

交付：

- `/api/exploration/answer` 调 LLM evidence extractor。
- 保存 evidence items。
- `/api/exploration/reflection` 调 LLM 生成三问一镜像。
- 前端仍不展示证据标签，只展示自然语言镜像。

完成标准：

- 用户每答一题，后台产生可追溯证据。
- 每 3 问生成的回应能结合命理，但不下红点结论。

### Phase 4：诊断草案、补问和修订窗口

目标：让红点诊断成为“专业分析 + 用户认同”的共同结论。

交付：

- `/api/diagnosis/draft`。
- `/api/diagnosis/follow-up`。
- `/api/diagnosis/confirm`。
- 前端新增诊断草案页。
- 前端新增用户修订窗口。
- 不确定时最多补问 2 题。

完成标准：

- 证据不足时明确显示“不确定，需要补问”。
- 2 题后仍不确定时，输出低置信草案和修订入口。
- 用户确认后形成最终 Top 3。

### Phase 5：LLM 奥德赛计划

目标：从模板计划升级为真正基于用户共识和方向的三版五年计划。

交付：

- `/api/odyssey/plans`。
- 三版计划结构化输出。
- 计划页 UI 优化。
- 支持重新生成或局部修改。

完成标准：

- 三版计划都能引用最终红点共识。
- 每版都有五年路径、仪表盘、风险、原型实验和第一年行动卡。
- 计划不是空泛愿景，而是可试验。

### Phase 6：Cloudflare 生产化

目标：部署到你的 Cloudflare 账号和子域名。

交付：

- 选择子域名。
- Cloudflare Workers 部署配置。
- D1 production database。
- 环境变量和 secret 配置。
- 八字算法生产方案落地，优先 TypeScript 移植。
- GitHub main 分支自动部署。

完成标准：

- 可以通过你的子域名访问。
- 生产环境能完成出生信息、十二问、诊断和计划。
- API key 不暴露在浏览器。

### Phase 7：报告、分享和增长功能

目标：让 demo 更像可传播产品。

交付：

- 报告导出 PDF。
- 分享链接或截图卡片。
- 用户反馈收集。
- 基础 analytics。
- 隐私政策和删除数据入口。

完成标准：

- 用户可以保存自己的诊断和奥德赛计划。
- 我们能看到漏斗数据：出生页完成率、十二问完成率、诊断确认率、计划生成率。

## 14. 近期最推荐的执行顺序

下一步不要先做 Cloudflare，也不要先大改 UI。建议按这个顺序：

1. 提交当前“去掉前端证据标签”的改动。
2. 做 Phase 1：LLM 后端基础设施和提示词注册。
3. 做 Phase 3 的一小块：只替换单题证据提取。
4. 再做 Phase 2 数据库，因为此时我们已经知道 evidence JSON 的真实形状。
5. 做诊断草案和修订窗口。
6. 做奥德赛计划 LLM。
7. 移植八字算法并部署 Cloudflare。

这样做的好处是：先验证最核心的智能体验，再投入生产化工程。

## 15. 需要你做决定的问题

这几个问题会影响后续开发优先级：

1. 第一版是否允许匿名使用，还是必须登录后保存报告？
   - 我的建议：匿名使用，生成报告后再引导保存。

2. 诊断报告是否要支持分享？
   - 我的建议：先支持本地导出，不急着公开分享链接。

3. 子域名叫什么？
   - 候选：`odyssey`、`pathfinder`、`redpoint`、`life-map`。

4. 命理结果展示到什么深度？
   - 我的建议：只展示四柱、五行、日主、轻画像，不展开大运细断。

5. 这个产品更像课程 demo、个人工具，还是未来要商业化？
   - 如果未来商业化，Phase 2 就要更早加入隐私、删除数据和使用限制。

## 16. 参考资料

- Cloudflare Workers Next.js：<https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
- Cloudflare Pages Next.js：<https://developers.cloudflare.com/pages/framework-guides/nextjs/>
- Cloudflare D1：<https://developers.cloudflare.com/d1/>
- Cloudflare Python Workers：<https://developers.cloudflare.com/workers/languages/python/>
- OpenAI Structured Outputs：<https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses>

