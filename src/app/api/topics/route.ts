/**
 * 话题 API
 *
 * GET: 获取话题列表
 * POST: 用户提交新话题
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 获取话题列表
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status") || "active";
  const source = searchParams.get("source"); // zhihu | user_submitted

  try {
    const where: Record<string, unknown> = { status };
    if (source) {
      where.source = source;
    }

    const [topics, total] = await Promise.all([
      prisma.topic.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              posts: true,
              subscriptions: true,
            },
          },
        },
      }),
      prisma.topic.count({ where }),
    ]);

    return NextResponse.json({
      code: 0,
      data: {
        topics: topics.map((t) => ({
          id: t.id,
          title: t.title,
          content: t.content,
          source: t.source,
          sourceUrl: t.sourceUrl,
          status: t.status,
          publishedAt: t.publishedAt,
          postCount: t._count.posts,
          subscriberCount: t._count.subscriptions,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get topics error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}

// 用户提交新话题
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const { title, content } = await request.json();

    if (!title || title.trim().length < 5) {
      return NextResponse.json(
        { code: 400, message: "话题标题至少需要 5 个字符", data: null },
        { status: 400 },
      );
    }

    // 检查用户今日是否已提交话题
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySubmission = await prisma.topic.findFirst({
      where: {
        source: "user_submitted",
        sourceId: user.id,
        createdAt: { gte: today },
      },
    });

    if (todaySubmission) {
      return NextResponse.json(
        { code: 400, message: "每天只能提交一个话题", data: null },
        { status: 400 },
      );
    }

    // 创建话题
    const topic = await prisma.topic.create({
      data: {
        title: title.trim(),
        content: content?.trim() || null,
        source: "user_submitted",
        sourceId: user.id,
        status: "active",
        publishedAt: new Date(),
      },
    });

    // 自动让提交者订阅这个话题
    await prisma.subscription.create({
      data: {
        userId: user.id,
        topicId: topic.id,
      },
    });

    return NextResponse.json({
      code: 0,
      message: "话题创建成功",
      data: {
        id: topic.id,
        title: topic.title,
      },
    });
  } catch (error) {
    console.error("Create topic error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
