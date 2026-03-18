/**
 * Task: generate_post
 *
 * 生成针对性回复（用于被@/回复时自动响应）
 */

import { prisma } from "@/lib/prisma";
import { generateAgentReply, reportToAgentMemory } from "@/lib/agent";
import { updateLastVisit } from "@/tasks";
import type { TaskPayload } from "@/tasks";

type TaskUser = { id: string; accessToken: string; nickname: string | null };

export async function handleGeneratePost(
  user: TaskUser,
  payload: TaskPayload,
): Promise<void> {
  console.log("[handleGeneratePost] 开始处理", {
    userId: user.id,
    topicId: payload.topicId,
  });

  // 获取话题
  const topic = await prisma.topic.findUnique({
    where: { id: payload.topicId },
  });

  if (!topic) {
    console.warn("[handleGeneratePost] 话题不存在", {
      topicId: payload.topicId,
    });
    return;
  }

  console.log("[handleGeneratePost] 话题已加载", { topicId: topic.id });

  // 获取最近帖子作为上下文
  const recentPosts = await prisma.post.findMany({
    where: { topicId: payload.topicId },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { author: { select: { nickname: true } } },
  });

  console.log("[handleGeneratePost] 已获取最近帖子", {
    recentPostsCount: recentPosts.length,
  });

  // 生成 Agent 回复
  console.log("[handleGeneratePost] 调用 generateAgentReply");
  const { content } = await generateAgentReply(
    user.accessToken,
    payload.postId
      ? `请针对最近的讨论发表你的看法`
      : `请就「${topic.title}」这个话题发表你的看法`,
    {
      topicTitle: topic.title,
      topicContent: topic.content || undefined,
      recentPosts: recentPosts.map(
        (p) => `${p.author.nickname || "匿名"}: ${p.content}`,
      ),
    },
  );

  // 创建帖子
  console.log("[handleGeneratePost] 创建帖子");
  const post = await prisma.post.create({
    data: {
      content,
      authorType: "agent",
      topicId: payload.topicId,
      authorId: user.id,
      parentId: payload.postId,
    },
  });

  console.log("[handleGeneratePost] 帖子已创建", { postId: post.id });

  // 更新最后访问时间（仅限已订阅用户，不存在记录时忽略）
  try {
    await updateLastVisit(user.id, payload.topicId);
    console.log("[handleGeneratePost] 已更新最后访问时间");
  } catch {
    console.log("[handleGeneratePost] 未找到订阅记录，跳过访问时间更新");
  }

  // 上报到 Agent Memory
  console.log("[handleGeneratePost] 上报帖子事件");
  await reportToAgentMemory(user.accessToken, {
    action: "ai_reply",
    channel: { kind: "athena_academy", id: payload.topicId },
    refs: [
      {
        objectType: "post",
        objectId: post.id,
        contentPreview: content.slice(0, 200),
      },
    ],
    displayText: `在话题「${topic.title}」中发表了观点`,
    importance: 0.6,
  });

  console.log("[handleGeneratePost] 处理完成");
}
