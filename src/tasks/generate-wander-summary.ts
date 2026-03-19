/**
 * Task: generate_wander_summary
 *
 * 在 wander 的所有 read_topic 任务完成后，生成一份跨话题的认知总结
 * 由 read-topic.ts 在最后一个任务完成时 inline 调用，不创建独立任务队列条目
 */

import { prisma } from "@/lib/prisma";
import { generateWanderSummaryContent } from "@/lib/agent";

type TaskUser = { id: string; accessToken: string; nickname: string | null };

export async function handleGenerateWanderSummary(
  user: TaskUser,
  sessionId: string,
): Promise<void> {
  console.log("[handleGenerateWanderSummary] 开始生成 wander 总结", {
    userId: user.id,
    sessionId,
  });

  // 防止重复生成
  const existingSummary = await prisma.wanderSummary.findUnique({
    where: { sessionId },
  });
  if (existingSummary) {
    console.log("[handleGenerateWanderSummary] 总结已存在，跳过", {
      sessionId,
    });
    return;
  }

  // 获取本次 session 的所有话题 ID（通过 agentTasks 的 payload）
  const tasks = await prisma.agentTask.findMany({
    where: {
      wanderSessionId: sessionId,
      type: "read_topic",
    },
    select: { payload: true },
  });

  const topicIds = (tasks as Array<{ payload: unknown }>)
    .map((t) => (t.payload as { topicId?: string }).topicId)
    .filter((id): id is string => !!id);

  if (topicIds.length === 0) {
    console.warn("[handleGenerateWanderSummary] 没有找到话题，跳过", {
      sessionId,
    });
    return;
  }

  console.log("[handleGenerateWanderSummary] 加载话题数据", {
    topicIds,
  });

  // 批量加载话题及其帖子（每个话题最多取 8 条帖子）
  const topics = await prisma.topic.findMany({
    where: { id: { in: topicIds } },
    select: {
      id: true,
      title: true,
      content: true,
      posts: {
        take: 8,
        orderBy: { createdAt: "asc" },
        select: {
          content: true,
          authorType: true,
          author: {
            select: {
              id: true,
              nickname: true,
              secondmeUserId: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  type PostAuthor = {
    id: string;
    nickname: string | null;
    secondmeUserId: string;
    avatarUrl: string | null;
  };
  type TopicPost = {
    content: string;
    authorType: string;
    author: PostAuthor;
  };
  type TopicWithPosts = {
    id: string;
    title: string;
    content: string | null;
    posts: TopicPost[];
  };

  const typedTopics = topics as TopicWithPosts[];

  const topicsForSummary = typedTopics.map((t) => ({
    topicId: t.id,
    title: t.title,
    content: t.content,
    posts: t.posts.map((p) => ({
      authorName: p.author.nickname || "匿名",
      authorType: p.authorType,
      content: p.content,
    })),
  }));

  // 从话题帖子中提取候选用户（真实用户，排除自己，按出现顺序去重）
  const seenUserIds = new Set<string>();
  const candidateUsers: Array<{
    userId: string;
    secondmeUserId: string;
    name: string;
    avatarUrl?: string;
    topicId: string;
    sampleContent: string;
  }> = [];

  for (const t of typedTopics) {
    for (const p of t.posts) {
      if (
        p.authorType === "user" &&
        p.author.id !== user.id &&
        !seenUserIds.has(p.author.id)
      ) {
        seenUserIds.add(p.author.id);
        candidateUsers.push({
          userId: p.author.id,
          secondmeUserId: p.author.secondmeUserId,
          name: p.author.nickname || "匿名",
          avatarUrl: p.author.avatarUrl ?? undefined,
          topicId: t.id,
          sampleContent: p.content.slice(0, 150),
        });
      }
    }
  }

  // 调用 Agent 生成总结
  console.log("[handleGenerateWanderSummary] 调用 Agent 生成总结");
  const summaryContent = await generateWanderSummaryContent(
    user.accessToken,
    topicsForSummary,
    candidateUsers,
  );

  // 保存总结到数据库
  await prisma.wanderSummary.create({
    data: {
      userId: user.id,
      sessionId,
      content: JSON.parse(JSON.stringify(summaryContent)),
    },
  });

  // 标记 WanderSession 为 completed
  await prisma.wanderSession.update({
    where: { id: sessionId },
    data: { status: "completed" },
  });

  console.log("[handleGenerateWanderSummary] wander 总结生成完成", {
    sessionId,
    topicsCount: summaryContent.topics.length,
    overallTakeawaysCount: summaryContent.overallTakeaways.length,
  });
}
