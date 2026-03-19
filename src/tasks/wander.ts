/**
 * Task: wander
 *
 * 漫游行为：获取话题列表，由 Agent 筛选感兴趣的话题，然后为订阅话题 + 筛选话题创建 read_topic 任务
 *
 * 规则：
 * - 已订阅且有新帖（unreadCount > 0）的话题：优先进入 read_topic
 * - 未订阅的话题：由 Agent 从最新话题中筛选感兴趣的
 * - 单次 wander 最多处理 5 个话题
 */

import { prisma } from "@/lib/prisma";
import { createAgentTask } from "@/tasks";

const API_BASE_URL =
  process.env.SECONDME_API_BASE_URL || "https://api.mindverse.com/gate/lab";

const MAX_WANDER_TOPICS = 5;

/** 剥离 LLM 有时返回的 markdown 代码块包装 */
function stripCodeBlock(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * 调用 Agent Act API，从话题列表中筛选感兴趣的 topicId
 */
async function selectTopicsForWander(
  accessToken: string,
  topics: Array<{ id: string; title: string; content: string | null }>,
  maxCount: number,
): Promise<string[]> {
  console.log("[selectTopicsForWander] 调用 Act API 筛选话题", {
    topicsCount: topics.length,
    maxCount,
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
请从以下话题中选出最多 ${maxCount} 个你最感兴趣、最有讨论价值的话题，返回对应的 topicId 数组。

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
      message: `请从话题列表中选出你最感兴趣的最多 ${maxCount} 个话题`,
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
    const filtered = selectedIds
      .filter((id) => validIds.has(id))
      .slice(0, maxCount);

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
  sessionId: string;
  subscribedProcessed: number;
  wanderProcessed: number;
  skippedNoUnread: number;
  tasksQueued: number;
}

/**
 * 为单个用户执行 wander：
 * 1. 创建 WanderSession 记录
 * 2. 获取有新帖的已订阅话题（unreadCount > 0，最多 5 个）
 * 3. 若还有配额，由 Agent 从未订阅话题中筛选感兴趣的
 * 4. 合并话题，限制总数 ≤ MAX_WANDER_TOPICS，创建 read_topic 任务
 * 5. 更新 WanderSession.totalTopics
 */
export async function runWander(user: {
  id: string;
  accessToken: string;
  nickname: string | null;
}): Promise<WanderResult> {
  console.log("[runWander] 开始 wander", { userId: user.id });

  // 创建 WanderSession
  const session = await prisma.wanderSession.create({
    data: {
      userId: user.id,
      status: "pending",
      totalTopics: 0,
    },
  });
  console.log("[runWander] WanderSession 已创建", { sessionId: session.id });

  // 获取有新帖的已订阅话题（unreadCount > 0）
  const unreadSubscriptions = await prisma.subscription.findMany({
    where: { userId: user.id, unreadCount: { gt: 0 } },
    orderBy: { unreadCount: "desc" },
    take: MAX_WANDER_TOPICS,
    select: { topicId: true },
  });
  const subscribedTopicIds = (
    unreadSubscriptions as Array<{ topicId: string }>
  ).map((s) => s.topicId);

  console.log("[runWander] 有新帖的已订阅话题", {
    subscribedCount: subscribedTopicIds.length,
  });

  let skippedNoUnread = 0;

  const taskItems: Array<{
    taskId: string;
    topicId: string;
    source: "subscribed" | "wander";
  }> = [];

  // 为有新帖的订阅话题创建 read_topic 任务记录
  for (const topicId of subscribedTopicIds) {
    const taskId = await createAgentTask(user.id, "read_topic", {
      topicId,
      wanderSessionId: session.id,
    });
    taskItems.push({ taskId, topicId, source: "subscribed" });
  }

  // 若还有配额，由 Agent 筛选未订阅的感兴趣话题
  const remaining = MAX_WANDER_TOPICS - subscribedTopicIds.length;
  if (remaining > 0) {
    // 获取最新活跃话题（排除已订阅的所有话题）
    const allSubscriptions = await prisma.subscription.findMany({
      where: { userId: user.id },
      select: { topicId: true },
    });
    const allSubscribedIds = new Set(
      (allSubscriptions as Array<{ topicId: string }>).map((s) => s.topicId),
    );

    const recentTopics = await prisma.topic.findMany({
      where: {
        status: "active",
        id: { notIn: Array.from(allSubscribedIds) },
      },
      orderBy: { publishedAt: "desc" },
      take: 30,
      select: { id: true, title: true, content: true },
    });

    console.log("[runWander] 未订阅的活跃话题", {
      topicsCount: recentTopics.length,
      remaining,
    });

    if (recentTopics.length > 0) {
      const wanderTopicIds = await selectTopicsForWander(
        user.accessToken,
        recentTopics,
        remaining,
      );

      const processedTopicIds = new Set<string>(subscribedTopicIds);
      for (const topicId of wanderTopicIds) {
        if (processedTopicIds.has(topicId)) continue;
        const taskId = await createAgentTask(user.id, "read_topic", {
          topicId,
          wanderSessionId: session.id,
        });
        taskItems.push({ taskId, topicId, source: "wander" });
        processedTopicIds.add(topicId);
      }
    }
  } else {
    // 有些订阅话题没有新帖，被跳过
    const allSubsCount = await prisma.subscription.count({
      where: { userId: user.id },
    });
    skippedNoUnread = Math.max(0, allSubsCount - subscribedTopicIds.length);
  }

  const totalTopics = taskItems.length;

  if (totalTopics === 0) {
    await prisma.wanderSession.update({
      where: { id: session.id },
      data: { status: "completed", totalTopics: 0 },
    });
    console.log("[runWander] 没有需要处理的话题，session 标记 completed", {
      sessionId: session.id,
    });
    return {
      userId: user.id,
      sessionId: session.id,
      subscribedProcessed: 0,
      wanderProcessed: 0,
      skippedNoUnread,
      tasksQueued: 0,
    };
  }

  await prisma.wanderSession.update({
    where: { id: session.id },
    data: { totalTopics },
  });

  const subscribedProcessed = taskItems.filter(
    (t) => t.source === "subscribed",
  ).length;
  const wanderProcessed = taskItems.filter((t) => t.source === "wander").length;

  console.log("[runWander] wander 规划完成，任务已入队", {
    userId: user.id,
    sessionId: session.id,
    subscribedProcessed,
    wanderProcessed,
    skippedNoUnread,
    tasksQueued: totalTopics,
  });

  return {
    userId: user.id,
    sessionId: session.id,
    subscribedProcessed,
    wanderProcessed,
    skippedNoUnread,
    tasksQueued: totalTopics,
  };
}
