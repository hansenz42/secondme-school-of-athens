/**
 * Task: wander
 *
 * 漫游行为：获取话题列表，由 Agent 筛选感兴趣的话题，然后为订阅话题 + 筛选话题创建 read_topic 任务
 *
 * 规则：
 * - 已订阅的话题：必须进入 read_topic（不受 AI 筛选限制，但受 2 小时冷却期约束）
 * - 未订阅的话题：由 Agent 从最新话题中筛选 3~5 个感兴趣的
 */

import { prisma } from "@/lib/prisma";
import { createAgentTask, isInCooldown } from "@/tasks";

const API_BASE_URL =
  process.env.SECONDME_API_BASE_URL || "https://api.mindverse.com/gate/lab";

/** 剥离 LLM 有时返回的 markdown 代码块包装 */
function stripCodeBlock(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * 调用 Agent Act API，从话题列表中筛选 3~5 个感兴趣的 topicId
 */
async function selectTopicsForWander(
  accessToken: string,
  topics: Array<{ id: string; title: string; content: string | null }>,
): Promise<string[]> {
  console.log("[selectTopicsForWander] 调用 Act API 筛选话题", {
    topicsCount: topics.length,
  });

  const topicList = topics
    .map(
      (t, i) =>
        `${i + 1}. [${t.id}] ${t.title}${t.content ? `：${t.content.slice(0, 80)}` : ""}`,
    )
    .join("\n");

  const actionControl = `仅输出合法 JSON 对象，不要解释。
输出结构：{ "selectedIds": ["topicId1", "topicId2", ...] }

你是一个知识型 AI 分身，正在浏览知识广场的话题列表。
请从以下话题中选出 3 到 5 个你最感兴趣、最有讨论价值的话题，返回对应的 topicId 数组。

话题列表：
${topicList}

选择标准：优先选择有深度、有争议、或与你主人兴趣领域高度匹配的话题。`;

  const response = await fetch(`${API_BASE_URL}/api/secondme/act/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: "请从话题列表中选出你最感兴趣的 3~5 个话题",
      actionControl,
    }),
  });

  if (!response.ok) {
    console.error("[selectTopicsForWander] Act API 调用失败", {
      status: response.status,
    });
    return [];
  }

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
    const result = JSON.parse(stripCodeBlock(content));
    const selectedIds: string[] = Array.isArray(result.selectedIds)
      ? result.selectedIds
      : [];

    // 验证返回的 ID 合法（只保留存在于话题列表中的 ID）
    const validIds = new Set(topics.map((t) => t.id));
    const filtered = selectedIds.filter((id) => validIds.has(id)).slice(0, 5);

    console.log("[selectTopicsForWander] 筛选完成", {
      selectedCount: filtered.length,
      selectedIds: filtered,
    });
    return filtered;
  } catch {
    console.warn("[selectTopicsForWander] JSON 解析失败，返回空列表", {
      content: content.substring(0, 200),
    });
    return [];
  }
}

export interface WanderResult {
  userId: string;
  subscribedQueued: number;
  wanderQueued: number;
  skippedCooldown: number;
}

/**
 * 为单个用户执行 wander：
 * 1. 获取最新 30 个活跃话题
 * 2. 由 Agent 筛选 3~5 个感兴趣且未订阅的话题
 * 3. 获取用户已订阅话题（必须进入 read_topic）
 * 4. 合并 + 检查冷却期 + 创建 read_topic 任务
 */
export async function runWander(user: {
  id: string;
  accessToken: string;
  nickname: string | null;
}): Promise<WanderResult> {
  console.log("[runWander] 开始 wander", { userId: user.id });

  // 获取最新 30 个活跃话题
  const recentTopics = await prisma.topic.findMany({
    where: { status: "active" },
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: { id: true, title: true, content: true },
  });

  console.log("[runWander] 已获取活跃话题", {
    topicsCount: recentTopics.length,
  });

  // 获取用户已订阅的话题 ID 集合
  const subscriptions = await prisma.subscription.findMany({
    where: { userId: user.id },
    select: { topicId: true },
  });
  const subscribedTopicIds = new Set(subscriptions.map((s) => s.topicId));

  console.log("[runWander] 用户已订阅话题数", {
    subscribedCount: subscribedTopicIds.size,
  });

  // Agent 从未订阅的话题中筛选感兴趣的
  const unsubscribedTopics = recentTopics.filter(
    (t) => !subscribedTopicIds.has(t.id),
  );

  let wanderTopicIds: string[] = [];
  if (unsubscribedTopics.length > 0) {
    wanderTopicIds = await selectTopicsForWander(
      user.accessToken,
      unsubscribedTopics,
    );
  }

  // 合并：已订阅话题 + Agent 筛选的话题（去重）
  const allTopicIds = [
    ...subscribedTopicIds,
    ...wanderTopicIds.filter((id) => !subscribedTopicIds.has(id)),
  ];

  console.log("[runWander] 合并后待处理话题", {
    totalCount: allTopicIds.length,
    subscribedCount: subscribedTopicIds.size,
    wanderCount: wanderTopicIds.length,
  });

  let subscribedQueued = 0;
  let wanderQueued = 0;
  let skippedCooldown = 0;

  for (const topicId of allTopicIds) {
    const inCooldown = await isInCooldown(user.id, topicId);
    if (inCooldown) {
      console.log("[runWander] 话题在冷却期内，跳过", { topicId });
      skippedCooldown++;
      continue;
    }

    await createAgentTask(user.id, "read_topic", { topicId });

    if (subscribedTopicIds.has(topicId)) {
      subscribedQueued++;
    } else {
      wanderQueued++;
    }
  }

  console.log("[runWander] wander 完成", {
    userId: user.id,
    subscribedQueued,
    wanderQueued,
    skippedCooldown,
  });

  return { userId: user.id, subscribedQueued, wanderQueued, skippedCooldown };
}
