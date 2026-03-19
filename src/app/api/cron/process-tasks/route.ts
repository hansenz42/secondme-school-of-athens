/**
 * Cron: 处理 Agent 任务队列
 *
 * 每次并行处理 2 个任务，由 GitHub Actions 每 10 分钟触发
 * 支持任务类型：read_topic, generate_post, generate_wander_summary
 * fan-in 检查：read_topic 完成后，若同 session 无剩余任务，自动入队 generate_wander_summary
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPendingTasks,
  updateTaskStatus,
  createAgentTask,
  type TaskPayload,
} from "@/tasks";
import { handleGeneratePost } from "@/tasks/generate-post";
import { handleReadTopic } from "@/tasks/read-topic";
import { handleGenerateWanderSummary } from "@/tasks/generate-wander-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby plan 最大 60 秒

/**
 * fan-in 检查：read_topic 完成后，若同 session 无剩余 pending/processing 任务，
 * 且尚未生成 generate_wander_summary 任务，则自动入队
 */
async function checkAndQueueWanderSummary(
  userId: string,
  wanderSessionId: string,
): Promise<void> {
  const remainingCount = await prisma.agentTask.count({
    where: {
      wanderSessionId,
      type: "read_topic",
      status: { in: ["pending", "processing"] },
    },
  });

  if (remainingCount > 0) {
    console.log("[process-tasks] fan-in: 同 session 仍有剩余任务", {
      wanderSessionId,
      remainingCount,
    });
    return;
  }

  // 检查是否已有 generate_wander_summary 任务
  const existingSummaryTask = await prisma.agentTask.findFirst({
    where: {
      wanderSessionId,
      type: "generate_wander_summary",
    },
  });

  if (existingSummaryTask) {
    console.log("[process-tasks] fan-in: generate_wander_summary 已存在", {
      wanderSessionId,
      taskId: existingSummaryTask.id,
    });
    return;
  }

  // 所有 read_topic 已完成，且无总结任务 → 入队
  await createAgentTask(userId, "generate_wander_summary", {
    wanderSessionId,
  });
  console.log("[process-tasks] fan-in: 已入队 generate_wander_summary", {
    wanderSessionId,
  });
}

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
    // 每次取 2 个任务并行处理（约 20-25s，在 60s 限制内安全完成）
    const tasks = await getPendingTasks(2);
    console.log("[process-tasks] 获取待处理任务", { taskCount: tasks.length });

    if (tasks.length === 0) {
      return NextResponse.json({
        code: 0,
        message: "No pending tasks",
        data: { processed: 0, results: [] },
      });
    }

    // 并行处理所有取到的任务
    await Promise.all(
      tasks.map(async (task) => {
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
            return;
          }

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

            case "generate_wander_summary":
              console.log("[process-tasks] 执行 generate_wander_summary 任务", {
                taskId: task.id,
                wanderSessionId: task.wanderSessionId,
              });
              if (!task.wanderSessionId) {
                throw new Error(
                  "generate_wander_summary 任务缺少 wanderSessionId",
                );
              }
              await handleGenerateWanderSummary(user, task.wanderSessionId);
              break;

            default:
              console.warn("[process-tasks] 未知任务类型，跳过", {
                taskId: task.id,
                taskType: task.type,
              });
          }

          await updateTaskStatus(task.id, "done");
          console.log("[process-tasks] 任务完成", {
            taskId: task.id,
            taskType: task.type,
          });
          results.push({ taskId: task.id, status: "done" });

          // fan-in 检查：read_topic 完成后检查是否需要入队总结
          if (task.type === "read_topic" && task.wanderSessionId) {
            await checkAndQueueWanderSummary(task.userId, task.wanderSessionId);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error("[process-tasks] 任务执行失败", {
            taskId: task.id,
            taskType: task.type,
            error: errorMsg,
          });
          await updateTaskStatus(task.id, "failed", errorMsg);
          results.push({ taskId: task.id, status: "failed", error: errorMsg });
        }
      }),
    );

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
