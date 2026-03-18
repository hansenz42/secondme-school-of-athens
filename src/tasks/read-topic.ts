/**
 * Task: read_topic
 *
 * 详细阅读话题，判断是否发表意见，然后生成报告
 */

import { prisma } from "@/lib/prisma";
import {
  generateAgentReply,
  judgeAgentReply,
  reportToAgentMemory,
} from "@/lib/agent";
import { updateLastVisit } from "@/tasks";
import { handleUpdateReport } from "@/tasks/update-report";
import type { TaskPayload } from "@/tasks";

type TaskUser = { id: string; accessToken: string; nickname: string | null };

export async function handleReadTopic(
  user: TaskUser,
  payload: TaskPayload,
): Promise<void> {
  console.log("[handleReadTopic] 开始处理", {
    userId: user.id,
    topicId: payload.topicId,
  });

  // 获取话题和最近帖子
  const topic = await prisma.topic.findUnique({
    where: { id: payload.topicId },
    include: {
      posts: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { author: { select: { nickname: true } } },
      },
    },
  });

  if (!topic) {
    console.warn("[handleReadTopic] 话题不存在", { topicId: payload.topicId });
    return;
  }

  console.log("[handleReadTopic] 话题已加载", {
    topicId: topic.id,
    postsCount: topic.posts.length,
  });

  // 更新最后访问时间（仅限已订阅用户，不存在记录时忽略）
  try {
    await updateLastVisit(user.id, payload.topicId);
    console.log("[handleReadTopic] 已更新最后访问时间");
  } catch {
    console.log("[handleReadTopic] 未找到订阅记录，跳过访问时间更新");
  }

  // 上报阅读事件到 Agent Memory
  console.log("[handleReadTopic] 上报阅读事件", { topicId: payload.topicId });
  await reportToAgentMemory(user.accessToken, {
    action: "post_viewed",
    channel: { kind: "athena_academy", id: payload.topicId },
    refs: [
      {
        objectType: "topic",
        objectId: payload.topicId,
        contentPreview: topic.title,
      },
    ],
    displayText: `阅读了话题「${topic.title}」`,
    importance: 0.3,
  });

  // 判断是否需要发表意见
  console.log("[handleReadTopic] 判断是否需要发表意见");
  const { shouldReply } = await judgeAgentReply(
    user.accessToken,
    topic.title,
    topic.posts.map((p) => ({
      author: p.author.nickname || "匿名",
      content: p.content,
    })),
  );

  if (shouldReply) {
    console.log("[handleReadTopic] Agent 决定发表意见，生成回复");
    const { content } = await generateAgentReply(
      user.accessToken,
      `请就「${topic.title}」这个话题发表你的看法`,
      {
        topicTitle: topic.title,
        topicContent: topic.content || undefined,
        recentPosts: topic.posts.map(
          (p) => `${p.author.nickname || "匿名"}: ${p.content}`,
        ),
      },
    );

    const post = await prisma.post.create({
      data: {
        content,
        authorType: "agent",
        topicId: payload.topicId,
        authorId: user.id,
      },
    });
    console.log("[handleReadTopic] Agent 帖子已创建", { postId: post.id });

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
  } else {
    console.log("[handleReadTopic] Agent 决定不回复此话题");
  }

  // 直接执行更新报告（含 agent 最新回复）
  console.log("[handleReadTopic] 执行 update_report");
  await handleUpdateReport(user, { topicId: payload.topicId });

  console.log("[handleReadTopic] 处理完成");
}
