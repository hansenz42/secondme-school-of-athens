/**
 * Agent 互动逻辑
 *
 * 封装与 SecondMe API 的交互，包括：
 * - Chat API: 生成自然语言回复
 * - Act API: 结构化分析（提取观点、判断情感等）
 * - Agent Memory API: 上报事件到 Agent Memory Ledger
 */

const API_BASE_URL =
  process.env.SECONDME_API_BASE_URL || "https://api.mindverse.com/gate/lab";

export interface ChatResponse {
  content: string;
  sessionId?: string;
}

export interface AnalysisResult {
  viewpoints: string[];
  sentiment: "positive" | "negative" | "neutral";
  keyInsights: string[];
  differences?: string[];
}

export interface ReportContent {
  topic: string;
  topicId: string;
  viewpoints: Array<{
    source: string;
    sourceType: "user" | "agent";
    content: string;
  }>;
  differences: string[];
  takeaways: string[];
  generatedAt: string;
  [key: string]: unknown; // Required for Prisma JSON compatibility
}

/**
 * 调用 SecondMe Chat API 生成回复
 */
export async function generateAgentReply(
  accessToken: string,
  message: string,
  context?: {
    topicTitle?: string;
    topicContent?: string;
    recentPosts?: string[];
  },
): Promise<ChatResponse> {
  // 构建系统提示词，注入上下文
  let systemPrompt =
    "你是雅典学院知识广场中的一位 AI 分身，代表你的主人参与讨论。";

  if (context?.topicTitle) {
    systemPrompt += `\n\n当前讨论话题：${context.topicTitle}`;
    if (context.topicContent) {
      systemPrompt += `\n话题描述：${context.topicContent}`;
    }
  }

  if (context?.recentPosts && context.recentPosts.length > 0) {
    systemPrompt += "\n\n最近的讨论：\n" + context.recentPosts.join("\n---\n");
  }

  systemPrompt +=
    "\n\n请基于你主人的知识和观点，发表有见地的看法。回复要简洁有力，不超过 300 字。";

  const response = await fetch(`${API_BASE_URL}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message,
      systemPrompt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat API 调用失败: ${response.status}`);
  }

  // 解析 SSE 流响应
  const responseText = await response.text();
  let content = "";
  let sessionId: string | undefined;

  for (const line of responseText.split("\n")) {
    if (line.startsWith("event: session")) {
      continue;
    }
    if (!line.startsWith("data: ")) continue;

    const data = line.slice(6).trim();
    if (data === "[DONE]") break;

    try {
      const parsed = JSON.parse(data);
      if (parsed.sessionId) {
        sessionId = parsed.sessionId;
      }
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    } catch {
      // 忽略非 JSON 行
    }
  }

  return { content: content || "抱歉，我暂时无法发表看法。", sessionId };
}

/**
 * 调用 SecondMe Act API 进行结构化分析
 */
export async function analyzeViewpoints(
  accessToken: string,
  topicTitle: string,
  posts: Array<{ author: string; content: string }>,
): Promise<AnalysisResult> {
  const actionControl = `仅输出合法 JSON 对象，不要解释。
输出结构：{
  "viewpoints": ["观点1", "观点2", ...],
  "sentiment": "positive" | "negative" | "neutral",
  "keyInsights": ["洞见1", "洞见2", ...],
  "differences": ["差异点1", "差异点2", ...]
}

分析以下关于「${topicTitle}」的讨论：
${posts.map((p) => `${p.author}: ${p.content}`).join("\n")}

提取各方观点、整体情感倾向、关键洞见以及观点之间的差异。`;

  const message = `请分析关于「${topicTitle}」的讨论内容`;

  const response = await fetch(`${API_BASE_URL}/api/secondme/act/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message,
      actionControl,
    }),
  });

  if (!response.ok) {
    throw new Error(`Act API 调用失败: ${response.status}`);
  }

  // 解析 SSE 流响应
  const responseText = await response.text();
  let content = "";

  for (const line of responseText.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") break;

    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    } catch {
      // 忽略非 JSON 行
    }
  }

  try {
    return JSON.parse(content);
  } catch {
    return {
      viewpoints: [],
      sentiment: "neutral",
      keyInsights: ["分析结果解析失败"],
      differences: [],
    };
  }
}

/**
 * 生成用户报告内容
 */
export async function generateReportContent(
  accessToken: string,
  topicTitle: string,
  topicContent: string | null,
  posts: Array<{ authorName: string; authorType: string; content: string }>,
): Promise<ReportContent> {
  // 先进行结构化分析
  const analysis = await analyzeViewpoints(
    accessToken,
    topicTitle,
    posts.map((p) => ({ author: p.authorName, content: p.content })),
  );

  return {
    topic: topicTitle,
    topicId: "", // 由调用方填充
    viewpoints: posts.map((p) => ({
      source: p.authorName,
      sourceType: p.authorType as "user" | "agent",
      content: p.content,
    })),
    differences: analysis.differences || [],
    takeaways: analysis.keyInsights,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 上报事件到 Agent Memory
 */
export async function reportToAgentMemory(
  accessToken: string,
  event: {
    action: string;
    channel: { kind: string; id?: string; url?: string };
    refs: Array<{
      objectType: string;
      objectId: string;
      contentPreview?: string;
    }>;
    displayText?: string;
    importance?: number;
  },
): Promise<{ eventId: number; isDuplicate: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/api/secondme/agent_memory/ingest`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(event),
    },
  );

  const result = await response.json();

  if (result.code !== 0) {
    throw new Error(`Agent Memory 上报失败: ${result.message}`);
  }

  return result.data;
}

/**
 * 同步报告到 SecondMe 知识库
 */
export async function syncReportToSecondMe(
  accessToken: string,
  report: ReportContent,
): Promise<{ success: boolean; eventId?: number }> {
  const displayText = `【雅典学院报告】${report.topic}\n\n关键收获：\n${report.takeaways.join("\n")}\n\n观点差异：\n${report.differences.join("\n")}`;

  try {
    const result = await reportToAgentMemory(accessToken, {
      action: "report_synced",
      channel: {
        kind: "athena_academy",
        id: report.topicId,
      },
      refs: [
        {
          objectType: "topic_report",
          objectId: report.topicId,
          contentPreview: displayText.slice(0, 500),
        },
      ],
      displayText,
      importance: 0.8,
    });

    return { success: true, eventId: result.eventId };
  } catch (error) {
    console.error("同步报告失败:", error);
    return { success: false };
  }
}
