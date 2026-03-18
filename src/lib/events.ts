/**
 * 事件驱动系统
 *
 * 触发 Agent 任务的事件处理
 * 任务类型、队列工具函数请参考 @/tasks/index.ts
 */

import { prisma } from "./prisma";
import { createAgentTask, isInCooldown, type TaskPayload } from "@/tasks";

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
