/**
 * 帖子 API
 *
 * POST: 发布帖子或回复
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { onPostCreated, onPostReplied } from "@/lib/events";

interface RouteParams {
  params: Promise<{ topicId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { topicId } = await params;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const { content, parentId } = await request.json();

    if (!content || content.trim().length < 2) {
      return NextResponse.json(
        { code: 400, message: "内容至少需要 2 个字符", data: null },
        { status: 400 },
      );
    }

    // 验证话题存在
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      return NextResponse.json(
        { code: 404, message: "话题不存在", data: null },
        { status: 404 },
      );
    }

    // 如果是回复，验证父帖子存在
    if (parentId) {
      const parentPost = await prisma.post.findUnique({
        where: { id: parentId },
      });

      if (!parentPost || parentPost.topicId !== topicId) {
        return NextResponse.json(
          { code: 404, message: "被回复的帖子不存在", data: null },
          { status: 404 },
        );
      }
    }

    // 创建帖子
    const post = await prisma.post.create({
      data: {
        content: content.trim(),
        authorType: "user",
        topicId,
        authorId: user.id,
        parentId: parentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    // 触发事件（异步，不阻塞响应）
    if (parentId) {
      // 回复事件
      onPostReplied(topicId, parentId, post.id, user.id).catch(console.error);
    } else {
      // 新帖子事件
      onPostCreated(topicId, post.id, user.id).catch(console.error);
    }

    return NextResponse.json({
      code: 0,
      message: "发布成功",
      data: {
        id: post.id,
        content: post.content,
        authorType: post.authorType,
        author: {
          id: post.author.id,
          nickname: post.author.nickname,
          avatarUrl: post.author.avatarUrl,
        },
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
