/**
 * 话题详情 API
 *
 * GET: 获取话题详情及帖子
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ topicId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { topicId } = await params;

  try {
    const user = await getCurrentUser();

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        posts: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    nickname: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          where: { parentId: null }, // 只获取顶层帖子
        },
        _count: {
          select: {
            posts: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!topic) {
      return NextResponse.json(
        { code: 404, message: "话题不存在", data: null },
        { status: 404 },
      );
    }

    // 检查用户是否已订阅
    let isSubscribed = false;
    if (user) {
      const subscription = await prisma.subscription.findUnique({
        where: {
          userId_topicId: {
            userId: user.id,
            topicId,
          },
        },
      });
      isSubscribed = !!subscription;
    }

    return NextResponse.json({
      code: 0,
      data: {
        id: topic.id,
        title: topic.title,
        content: topic.content,
        source: topic.source,
        sourceUrl: topic.sourceUrl,
        status: topic.status,
        publishedAt: topic.publishedAt,
        postCount: topic._count.posts,
        subscriberCount: topic._count.subscriptions,
        isSubscribed,
        posts: topic.posts.map((post) => ({
          id: post.id,
          content: post.content,
          authorType: post.authorType,
          author: {
            id: post.author.id,
            nickname: post.author.nickname,
            avatarUrl: post.author.avatarUrl,
          },
          createdAt: post.createdAt,
          replies: post.replies.map((reply) => ({
            id: reply.id,
            content: reply.content,
            authorType: reply.authorType,
            author: {
              id: reply.author.id,
              nickname: reply.author.nickname,
              avatarUrl: reply.author.avatarUrl,
            },
            createdAt: reply.createdAt,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Get topic error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
