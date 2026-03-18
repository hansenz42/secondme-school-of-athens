/**
 * Cron: 每日获取知乎热门话题
 *
 * Vercel Cron 每日触发一次（北京时间 8:00）
 * 获取 10 条热门话题，去重后存入数据库
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchHotTopics } from "@/lib/zhihu";

// Vercel Cron 配置
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 验证 Cron 密钥（生产环境安全检查）
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. 获取知乎热门话题
    const hotTopics = await fetchHotTopics(10);

    // 2. 去重检查并插入
    const inserted: string[] = [];
    const skipped: string[] = [];

    for (const topic of hotTopics) {
      // 检查是否已存在
      const existing = await prisma.topic.findUnique({
        where: {
          source_sourceId: {
            source: "zhihu",
            sourceId: topic.id,
          },
        },
      });

      if (existing) {
        skipped.push(topic.title);
        continue;
      }

      // 插入新话题
      const newTopic = await prisma.topic.create({
        data: {
          title: topic.title,
          content: topic.content,
          source: "zhihu",
          sourceId: topic.id,
          sourceUrl: topic.url,
          status: "active",
          publishedAt: new Date(),
        },
      });

      inserted.push(topic.title);

      // 3. 为启用自动订阅的用户创建订阅
      const autoSubscribeUsers = await prisma.user.findMany({
        where: { autoSubscribeNewTopics: true },
        select: { id: true },
      });

      if (autoSubscribeUsers.length > 0) {
        await prisma.subscription.createMany({
          data: autoSubscribeUsers.map((user) => ({
            userId: user.id,
            topicId: newTopic.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({
      code: 0,
      message: "Topics fetched successfully",
      data: {
        inserted: inserted.length,
        skipped: skipped.length,
        topics: inserted,
      },
    });
  } catch (error) {
    console.error("Cron fetch-topics error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
