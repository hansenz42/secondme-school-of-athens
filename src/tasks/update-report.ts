/**
 * Task: update_report
 *
 * 基于话题的所有帖子生成/更新报告
 */

import { prisma } from "@/lib/prisma";
import { generateReportContent } from "@/lib/agent";
import type { TaskPayload } from "@/tasks";

type TaskUser = { id: string; accessToken: string; nickname: string | null };

export async function handleUpdateReport(
  user: TaskUser,
  payload: TaskPayload,
): Promise<void> {
  console.log("[handleUpdateReport] 开始处理", {
    userId: user.id,
    topicId: payload.topicId,
  });

  // 获取话题和所有帖子
  const topic = await prisma.topic.findUnique({
    where: { id: payload.topicId },
    include: {
      posts: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { nickname: true } } },
      },
    },
  });

  if (!topic) {
    console.warn("[handleUpdateReport] 话题不存在", {
      topicId: payload.topicId,
    });
    return;
  }

  console.log("[handleUpdateReport] 话题已加载", {
    topicId: topic.id,
    postsCount: topic.posts.length,
  });

  // 生成报告内容
  console.log("[handleUpdateReport] 生成报告内容");
  const reportContent = await generateReportContent(
    user.accessToken,
    topic.title,
    topic.content,
    topic.posts.map((p) => ({
      authorName: p.author.nickname || "匿名",
      authorType: p.authorType,
      content: p.content,
    })),
  );

  reportContent.topicId = payload.topicId;

  // 转换为 Prisma JSON 格式
  const contentJson = JSON.parse(JSON.stringify(reportContent));

  // 更新或创建报告
  console.log("[handleUpdateReport] 保存报告到数据库");
  await prisma.report.upsert({
    where: {
      userId_topicId: {
        userId: user.id,
        topicId: payload.topicId,
      },
    },
    update: {
      content: contentJson,
      status: "draft",
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      topicId: payload.topicId,
      content: contentJson,
      status: "draft",
    },
  });

  console.log("[handleUpdateReport] 报告保存完成", {
    topicId: payload.topicId,
  });
}
