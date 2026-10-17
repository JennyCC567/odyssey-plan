import { z } from "zod";

export type LlmMode = "disabled" | "configured";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmRuntime = {
  mode: LlmMode;
  model: string;
  baseUrl: string;
  provider: "anthropic-compatible" | "openai-compatible" | "none";
};

export type JsonGenerationResult<T> =
  | {
      ok: true;
      data: T;
      source: string;
    }
  | {
      ok: false;
      error: string;
      source: string;
    };

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
const DEFAULT_MODEL = "glm-5.3";

export function getLlmRuntime(): LlmRuntime {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.ZAI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const model = process.env.PATHFINDER_MODEL ?? process.env.OPENAI_MODEL ?? process.env.ZAI_MODEL ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.ANTHROPIC_BASE_URL ?? process.env.ZAI_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL;

  if (!apiKey) {
    return {
      mode: "disabled",
      model: "rules-fallback",
      baseUrl: "",
      provider: "none"
    };
  }

  return {
    mode: "configured",
    model,
    baseUrl,
    provider: baseUrl.includes("/anthropic") ? "anthropic-compatible" : "openai-compatible"
  };
}

export function getGenerationSource(task: string): string {
  const runtime = getLlmRuntime();

  if (runtime.mode === "disabled") {
    return `${task}:rules-fallback`;
  }

  return `${task}:${runtime.provider}:${runtime.model}`;
}

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY ?? process.env.ZAI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
}

function createChatCompletionsUrl(baseUrl: string): string {
  return new URL("chat/completions", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function createAnthropicMessagesUrl(baseUrl: string): string {
  return new URL("v1/messages", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function splitAnthropicMessages(messages: ChatMessage[]): { system?: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n") || undefined;
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content
    }));

  return {
    system,
    messages: conversation.length ? conversation : [{ role: "user", content: "请输出符合要求的 JSON。" }]
  };
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }

    throw new Error("模型没有返回可解析的 JSON。 ");
  }
}

export async function runJsonCompletion<T>(input: {
  task: string;
  messages: ChatMessage[];
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}): Promise<JsonGenerationResult<T>> {
  const runtime = getLlmRuntime();
  const source = getGenerationSource(input.task);
  const apiKey = getApiKey();

  if (runtime.mode === "disabled" || !apiKey) {
    return {
      ok: false,
      error: "LLM runtime is disabled because no API key is configured.",
      source
    };
  }

  const timeoutMs = Number(process.env.PATHFINDER_LLM_TIMEOUT_MS ?? 45000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const maxTokens = input.maxTokens ?? Number(process.env.PATHFINDER_LLM_MAX_TOKENS ?? 3000);
    const response = runtime.provider === "anthropic-compatible"
      ? await fetch(createAnthropicMessagesUrl(runtime.baseUrl), {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: runtime.model,
            ...splitAnthropicMessages(input.messages),
            temperature: input.temperature ?? 0.4,
            max_tokens: maxTokens
          }),
          signal: controller.signal
        })
      : await fetch(createChatCompletionsUrl(runtime.baseUrl), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: runtime.model,
            messages: input.messages,
            temperature: input.temperature ?? 0.4,
            top_p: 0.8,
            max_tokens: maxTokens
          }),
          signal: controller.signal
        });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `LLM request failed with ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
        source
      };
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      content?: Array<{
        type?: string;
        text?: string;
        content?: string;
        input?: unknown;
      }>;
      message?: {
        content?: string;
      };
      output_text?: string;
    };
    const content = runtime.provider === "anthropic-compatible"
      ? (payload.content?.map((part) => part.text ?? part.content ?? (part.input ? JSON.stringify(part.input) : "")).join("\n").trim() ||
          payload.choices?.[0]?.message?.content ||
          payload.message?.content ||
          payload.output_text)
      : payload.choices?.[0]?.message?.content;

    if (!content) {
      return {
        ok: false,
        error: "LLM response did not include message content.",
        source
      };
    }

    const parsed = input.schema.safeParse(extractJsonObject(content));

    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.message,
        source
      };
    }

    return {
      ok: true,
      data: parsed.data,
      source
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "LLM request failed.",
      source
    };
  } finally {
    clearTimeout(timeout);
  }
}
