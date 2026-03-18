/**
 * 事件驱动系统
 *
 * 触发 Agent 任务的事件处理
 */

import { prisma } from "./prisma";

export type TaskType =
  | "read_topic" // 阅读话题
  | "generate_post" // 生成帖子/回复
  | "update_report"; // 更新报告

export interface TaskPayload {
  topicId: string;
  postId?: string; // 如果是回复，指向被回复的帖子
  triggeredBy?: string; // 触发者 ID
  [key: string]: unknown; // Required for Prisma JSON compatibility
}

/**
 * 创建 Agent 任务
 */
export async function createAgentTask(
  userId: string,
  type: TaskType,
  payload: TaskPayload,
  scheduledAt?: Date,
): Promise<string> {
  const task = await prisma.agentTask.create({
    data: {
      userId,
      type,
      payload: JSON.parse(JSON.stringify(payload)),
      status: "pending",
      scheduledAt: scheduledAt || new Date(),
    },
  });

  return task.id;
}

/**
 * 检查是否在冷却期内（2 小时）
 */
export async function isInCooldown(
  userId: string,
  topicId: string,
): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: {
      userId_topicId: { userId, topicId },
    },
  });

  if (!subscription?.lastVisitAt) {
    return false;
  }

  const cooldownMs = 2 * 60 * 60 * 1000; // 2 小时
  const timeSinceLastVisit = Date.now() - subscription.lastVisitAt.getTime();

  return timeSinceLastVisit < cooldownMs;
}

/**
 * 更新订阅的最后访问时间
 */
export async function updateLastVisit(
  userId: string,
  topicId: string,
): Promise<void> {
  await prisma.subscription.update({
    where: {
      userId_topicId: { userId, topicId },
    },
    data: {
      lastVisitAt: new Date(),
    },
  });
}

/**
 * 当新帖子发布时，通知所有订阅者的 Agent
 */
export async function onPostCreated(
  topicId: string,
  postId: string,
  authorId: string,
): Promise<void> {
  // 获取所有订阅了这个话题的用户（排除作者自己）
  const subscriptions = await prisma.subscription.findMany({
    where: {
      topicId,
      userId: { not: authorId },
    },
    select: { userId: true },
  });

  // 为每个订阅者创建任务（检查冷却期）
  for (const sub of subscriptions) {
    const inCooldown = await isInCooldown(sub.userId, topicId);
    if (inCooldown) {
      continue;
    }

    await createAgentTask(sub.userId, "read_topic", {
      topicId,
      postId,
      triggeredBy: authorId,
    });
  }
}

/**
 * 当帖子被回复时，通知原帖作者的 Agent
 */
export async function onPostReplied(
  topicId: string,
  parentPostId: string,
  replyPostId: string,
  replyAuthorId: string,
): Promise<void> {
  // 获取原帖作者
  const parentPost = await prisma.post.findUnique({
    where: { id: parentPostId },
    select: { authorId: true },
  });

  if (!parentPost || parentPost.authorId === replyAuthorId) {
    return;
  }

  // 检查冷却期
  const inCooldown = await isInCooldown(parentPost.authorId, topicId);
  if (inCooldown) {
    return;
  }

  // 创建回复任务
  await createAgentTask(parentPost.authorId, "generate_post", {
    topicId,
    postId: replyPostId,
    triggeredBy: replyAuthorId,
  });
}

/**
 * 当用户订阅话题时，让 Agent 阅读话题
 */
export async function onTopicSubscribed(
  userId: string,
  topicId: string,
): Promise<void> {
  await createAgentTask(userId, "read_topic", {
    topicId,
  });
}

/**
 * 获取待处理的任务
 */
export async function getPendingTasks(limit: number = 10): Promise<
  Array<{
    id: string;
    userId: string;
    type: string;
    payload: TaskPayload;
  }>
> {
  const tasks = await prisma.agentTask.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: new Date() },
    },
    take: limit,
    orderBy: { scheduledAt: "asc" },
  });

  return tasks.map((t) => ({
    id: t.id,
    userId: t.userId,
    type: t.type,
    payload: t.payload as TaskPayload,
  }));
}

/**
 * 标记任务状态
 */
export async function updateTaskStatus(
  taskId: string,
  status: "processing" | "done" | "failed",
  error?: string,
): Promise<void> {
  await prisma.agentTask.update({
    where: { id: taskId },
    data: {
      status,
      error,
      completedAt:
        status === "done" || status === "failed" ? new Date() : undefined,
    },
  });
}
