/**
 * 订阅 API
 *
 * POST: 订阅话题
 * DELETE: 取消订阅
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { onTopicSubscribed } from "@/lib/events";

interface RouteParams {
  params: Promise<{ topicId: string }>;
}

// 订阅话题
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

    // 检查是否已订阅
    const existing = await prisma.subscription.findUnique({
      where: {
        userId_topicId: {
          userId: user.id,
          topicId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        code: 0,
        message: "已订阅",
        data: { isSubscribed: true },
      });
    }

    // 创建订阅
    await prisma.subscription.create({
      data: {
        userId: user.id,
        topicId,
      },
    });

    // 触发订阅事件（让 Agent 阅读话题）
    onTopicSubscribed(user.id, topicId).catch(console.error);

    return NextResponse.json({
      code: 0,
      message: "订阅成功",
      data: { isSubscribed: true },
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}

// 取消订阅
export async function DELETE(request: Request, { params }: RouteParams) {
  const { topicId } = await params;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    await prisma.subscription
      .delete({
        where: {
          userId_topicId: {
            userId: user.id,
            topicId,
          },
        },
      })
      .catch(() => {
        // 忽略不存在的订阅
      });

    return NextResponse.json({
      code: 0,
      message: "已取消订阅",
      data: { isSubscribed: false },
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
