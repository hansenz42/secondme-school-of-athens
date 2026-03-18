/**
 * Cron: 处理 Agent 任务队列
 *
 * 批量处理待执行的 Agent 任务
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPendingTasks,
  updateTaskStatus,
  updateLastVisit,
  type TaskPayload,
} from "@/lib/events";
import {
  generateAgentReply,
  generateReportContent,
  reportToAgentMemory,
} from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby plan 最大 60 秒

export async function GET(request: Request) {
  // 验证 Cron 密钥
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ taskId: string; status: string; error?: string }> = [];

  try {
    // 获取待处理任务（限制数量避免超时）
    const tasks = await getPendingTasks(5);

    for (const task of tasks) {
      try {
        await updateTaskStatus(task.id, "processing");

        // 获取用户信息（含 accessToken）
        const user = await prisma.user.findUnique({
          where: { id: task.userId },
          select: { id: true, accessToken: true, nickname: true },
        });

        if (!user) {
          await updateTaskStatus(task.id, "failed", "User not found");
          results.push({
            taskId: task.id,
            status: "failed",
            error: "User not found",
          });
          continue;
        }

        const payload = task.payload as TaskPayload;

        switch (task.type) {
          case "read_topic":
            await handleReadTopic(user, payload);
            break;
          case "generate_post":
            await handleGeneratePost(user, payload);
            break;
          case "update_report":
            await handleUpdateReport(user, payload);
            break;
        }

        await updateTaskStatus(task.id, "done");
        results.push({ taskId: task.id, status: "done" });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await updateTaskStatus(task.id, "failed", errorMsg);
        results.push({ taskId: task.id, status: "failed", error: errorMsg });
      }
    }

    return NextResponse.json({
      code: 0,
      message: "Tasks processed",
      data: {
        processed: results.length,
        results,
      },
    });
  } catch (error) {
    console.error("Cron process-tasks error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}

// 处理阅读话题任务
async function handleReadTopic(
  user: { id: string; accessToken: string; nickname: string | null },
  payload: TaskPayload,
): Promise<void> {
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

  if (!topic) return;

  // 更新最后访问时间
  await updateLastVisit(user.id, payload.topicId);

  // 上报阅读事件到 Agent Memory
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

  // 创建更新报告任务
  await prisma.agentTask.create({
    data: {
      userId: user.id,
      type: "update_report",
      payload: { topicId: payload.topicId },
      status: "pending",
      scheduledAt: new Date(),
    },
  });
}

// 处理生成帖子任务
async function handleGeneratePost(
  user: { id: string; accessToken: string; nickname: string | null },
  payload: TaskPayload,
): Promise<void> {
  // 获取话题和上下文
  const topic = await prisma.topic.findUnique({
    where: { id: payload.topicId },
  });

  if (!topic) return;

  // 获取最近帖子作为上下文
  const recentPosts = await prisma.post.findMany({
    where: { topicId: payload.topicId },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { author: { select: { nickname: true } } },
  });

  // 生成 Agent 回复
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
  const post = await prisma.post.create({
    data: {
      content,
      authorType: "agent",
      topicId: payload.topicId,
      authorId: user.id,
      parentId: payload.postId,
    },
  });

  // 更新最后访问时间
  await updateLastVisit(user.id, payload.topicId);

  // 上报到 Agent Memory
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
}

// 处理更新报告任务
async function handleUpdateReport(
  user: { id: string; accessToken: string; nickname: string | null },
  payload: TaskPayload,
): Promise<void> {
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

  if (!topic) return;

  // 生成报告内容
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
}
