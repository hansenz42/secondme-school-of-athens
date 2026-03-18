/**
 * Cron: wander — 定期漫游话题广场
 *
 * 触发频率：每 2 小时（由外部 cron 手动触发）
 * 逻辑：
 *   1. 获取所有活跃用户
 *   2. 对每个用户执行 runWander：
 *      - 已订阅话题 → 必须进入 read_topic（受 2 小时冷却期约束）
 *      - 未订阅话题 → 由 Agent 从最新话题中筛选 3~5 个感兴趣的
 *   3. 返回每个用户的任务创建结果
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runWander } from "@/tasks/wander";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby plan 最大 60 秒

export async function GET(request: Request) {
  console.log("[wander] Cron wander 开始", {
    timestamp: new Date().toISOString(),
  });

  // 验证 Cron 密钥
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.error("[wander] 认证失败：无效的 token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 获取所有活跃用户（有 accessToken 的用户）
    const users = await prisma.user.findMany({
      select: { id: true, accessToken: true, nickname: true },
    });

    console.log("[wander] 获取到活跃用户", { userCount: users.length });

    const results = [];

    for (const user of users) {
      try {
        const result = await runWander(user);
        results.push({ ...result, status: "ok" });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[wander] 用户 wander 失败", {
          userId: user.id,
          error: errorMsg,
        });
        results.push({ userId: user.id, status: "failed", error: errorMsg });
      }
    }

    const successCount = results.filter((r) => r.status === "ok").length;
    const totalQueued = results
      .filter(
        (
          r,
        ): r is {
          userId: string;
          status: string;
          subscribedQueued: number;
          wanderQueued: number;
          skippedCooldown: number;
        } => r.status === "ok",
      )
      .reduce((sum, r) => sum + r.subscribedQueued + r.wanderQueued, 0);

    console.log("[wander] Cron wander 完成", {
      totalUsers: users.length,
      successCount,
      totalQueued,
    });

    return NextResponse.json({
      code: 0,
      message: "Wander completed",
      data: {
        totalUsers: users.length,
        successCount,
        totalQueued,
        results,
      },
    });
  } catch (error) {
    console.error("[wander] Cron 处理过程中出现致命错误", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
