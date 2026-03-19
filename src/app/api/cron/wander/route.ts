/**
 * Cron: wander — 定期漫游话题广场
 *
 * 触发频率：每小时（由 GitHub Actions 触发）
 * 逻辑：
 *   - 带 ?userId=xxx：直接为该用户执行 wander（规划阶段，仅入队任务）
 *   - 不带 userId：从所有用户中选出「最久未 wander 且超过 6 小时」的用户执行
 *     若所有用户均在冷却期内，返回 No eligible users
 *   每次只处理 1 个用户，配合 process-tasks 消费队列完成实际执行
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runWander } from "@/tasks/wander";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby plan 最大 60 秒

const WANDER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 小时

export async function GET(request: NextRequest) {
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
    const { searchParams } = request.nextUrl;
    const targetUserId = searchParams.get("userId");

    let user: {
      id: string;
      accessToken: string;
      nickname: string | null;
    } | null = null;

    if (targetUserId) {
      // 指定 userId 时，直接查询该用户
      user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, accessToken: true, nickname: true },
      });

      if (!user) {
        return NextResponse.json(
          { code: 404, message: "User not found", data: null },
          { status: 404 },
        );
      }

      console.log("[wander] 使用指定用户", { userId: user.id });
    } else {
      // 无 userId 时：选出最久未 wander 且超过 6 小时冷却期的用户
      const now = new Date();
      const cooldownThreshold = new Date(now.getTime() - WANDER_COOLDOWN_MS);

      // 获取所有用户及其最近一次 WanderSession 的时间
      const users = await prisma.user.findMany({
        select: {
          id: true,
          accessToken: true,
          nickname: true,
          wanderSessions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      console.log("[wander] 共有用户", { userCount: users.length });

      // 筛选出符合条件的用户：从未 wander 过，或上次 wander 超过 6 小时
      const eligibleUsers = (
        users as Array<{
          id: string;
          accessToken: string;
          nickname: string | null;
          wanderSessions: Array<{ createdAt: Date }>;
        }>
      )
        .map((u) => ({
          id: u.id,
          accessToken: u.accessToken,
          nickname: u.nickname,
          lastWanderedAt: u.wanderSessions[0]?.createdAt ?? null,
        }))
        .filter(
          (u) =>
            u.lastWanderedAt === null || u.lastWanderedAt < cooldownThreshold,
        )
        // 最久未 wander 的排在前面（null 视为最早）
        .sort((a, b) => {
          if (a.lastWanderedAt === null) return -1;
          if (b.lastWanderedAt === null) return 1;
          return a.lastWanderedAt.getTime() - b.lastWanderedAt.getTime();
        });

      if (eligibleUsers.length === 0) {
        console.log("[wander] 所有用户均在 6 小时冷却期内，跳过");
        return NextResponse.json({
          code: 0,
          message: "No eligible users",
          data: { skipped: true },
        });
      }

      user = eligibleUsers[0];
      console.log("[wander] 自动选择用户（最久未漫游）", {
        userId: user.id,
        lastWanderedAt: (eligibleUsers[0] as (typeof eligibleUsers)[0])
          .lastWanderedAt,
      });
    }

    // 执行 wander（仅规划：创建 AgentTask，不执行）
    const result = await runWander(user);

    console.log("[wander] Cron wander 完成", result);

    return NextResponse.json({
      code: 0,
      message: "Wander queued",
      data: result,
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
