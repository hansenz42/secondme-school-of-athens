/**
 * Task 队列工具
 *
 * 任务类型定义、任务创建与状态管理、冷却期检查
 */

import { prisma } from "@/lib/prisma";

export type TaskType =
  | "read_topic" // 阅读话题
  | "generate_post"; // 生成帖子/回复

export interface TaskPayload {
  topicId: string;
  postId?: string; // 如果是回复，指向被回复的帖子
  triggeredBy?: string; // 触发者 ID
  wanderSessionId?: string; // 所属的 wander session（可选）
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
      wanderSessionId: payload.wanderSessionId,
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

  const cooldownMs = 6 * 60 * 60 * 1000; // 6 小时
  const timeSinceLastVisit = Date.now() - subscription.lastVisitAt.getTime();

  return timeSinceLastVisit < cooldownMs;
}

/**
 * 更新订阅的最后访问时间（仅限已订阅用户）
 * 使用 updateMany 避免记录不存在时抛错（处理未订阅话题的情况）
 */
export async function updateLastVisit(
  userId: string,
  topicId: string,
): Promise<void> {
  await prisma.subscription.updateMany({
    where: {
      userId,
      topicId,
    },
    data: {
      lastVisitAt: new Date(),
    },
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

  return (
    tasks as Array<{
      id: string;
      userId: string;
      type: string;
      payload: unknown;
      wanderSessionId: string | null;
    }>
  ).map((t) => ({
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
