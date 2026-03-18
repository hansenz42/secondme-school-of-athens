/**
 * Cron: 处理 Agent 任务队列
 *
 * 批量处理待执行的 Agent 任务
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPendingTasks, updateTaskStatus, type TaskPayload } from "@/tasks";
import { handleReadTopic } from "@/tasks/read-topic";
import { handleGeneratePost } from "@/tasks/generate-post";
import { handleUpdateReport } from "@/tasks/update-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby plan 最大 60 秒

export async function GET(request: Request) {
  console.log("[process-tasks] Cron 任务处理开始", {
    timestamp: new Date().toISOString(),
  });

  // 验证 Cron 密钥
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.error("[process-tasks] 认证失败：无效的 token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ taskId: string; status: string; error?: string }> = [];

  try {
    // 获取待处理任务（限制数量避免超时）
    const tasks = await getPendingTasks(5);
    console.log("[process-tasks] 获取待处理任务", { taskCount: tasks.length });

    for (const task of tasks) {
      try {
        console.log("[process-tasks] 处理任务", {
          taskId: task.id,
          taskType: task.type,
          userId: task.userId,
        });

        await updateTaskStatus(task.id, "processing");

        // 获取用户信息（含 accessToken）
        const user = await prisma.user.findUnique({
          where: { id: task.userId },
          select: { id: true, accessToken: true, nickname: true },
        });

        if (!user) {
          console.error("[process-tasks] 用户不存在", {
            taskId: task.id,
            userId: task.userId,
          });
          await updateTaskStatus(task.id, "failed", "User not found");
          results.push({
            taskId: task.id,
            status: "failed",
            error: "User not found",
          });
          continue;
        }

        console.log("[process-tasks] 用户已找到", {
          taskId: task.id,
          nickname: user.nickname,
        });

        const payload = task.payload as TaskPayload;

        switch (task.type) {
          case "read_topic":
            console.log("[process-tasks] 执行 read_topic 任务", {
              taskId: task.id,
            });
            await handleReadTopic(user, payload);
            break;
          case "generate_post":
            console.log("[process-tasks] 执行 generate_post 任务", {
              taskId: task.id,
            });
            await handleGeneratePost(user, payload);
            break;
          case "update_report":
            console.log("[process-tasks] 执行 update_report 任务", {
              taskId: task.id,
            });
            await handleUpdateReport(user, payload);
            break;
        }

        await updateTaskStatus(task.id, "done");
        console.log("[process-tasks] 任务完成", {
          taskId: task.id,
          taskType: task.type,
        });
        results.push({ taskId: task.id, status: "done" });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[process-tasks] 任务执行失败", {
          taskId: task.id,
          taskType: task.type,
          error: errorMsg,
        });
        await updateTaskStatus(task.id, "failed", errorMsg);
        results.push({ taskId: task.id, status: "failed", error: errorMsg });
      }
    }

    console.log("[process-tasks] 所有任务处理完毕", {
      processedCount: results.length,
      successCount: results.filter((r) => r.status === "done").length,
      failedCount: results.filter((r) => r.status === "failed").length,
    });

    return NextResponse.json({
      code: 0,
      message: "Tasks processed",
      data: {
        processed: results.length,
        results,
      },
    });
  } catch (error) {
    console.error("[process-tasks] Cron 处理过程中出现致命错误", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}

// handler 函数已迁移至 src/tasks/ 目录
