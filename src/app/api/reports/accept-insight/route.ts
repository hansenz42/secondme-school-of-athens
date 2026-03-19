/**
 * POST /api/reports/accept-insight
 *
 * 用户接受单条话题启发，上报到 SecondMe Agent Memory 并持久化到 DB
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { acceptInsightToSecondMe } from "@/lib/agent";

interface AcceptInsightBody {
  summaryId: string;
  topicId: string;
  topicTitle: string;
  insight: string;
  insightIndex: number;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const body: AcceptInsightBody = await request.json();
    const { summaryId, topicId, topicTitle, insight, insightIndex } = body;

    if (
      !summaryId ||
      !topicId ||
      !topicTitle ||
      !insight ||
      insightIndex === undefined
    ) {
      return NextResponse.json(
        { code: 400, message: "缺少必要参数", data: null },
        { status: 400 },
      );
    }

    // 幂等检查：是否已经接受过这条启发
    const existing = await prisma.acceptedInsight.findUnique({
      where: {
        summaryId_topicId_insightIndex: {
          summaryId,
          topicId,
          insightIndex,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        code: 0,
        data: { alreadyAccepted: true, eventId: existing.eventId },
      });
    }

    // 上报到 SecondMe Agent Memory
    const { eventId, isDuplicate } = await acceptInsightToSecondMe(
      user.accessToken,
      {
        summaryId,
        topicId,
        topicTitle,
        insightText: insight,
        insightIndex,
      },
    );

    // 持久化到 DB
    await prisma.acceptedInsight.create({
      data: {
        userId: user.id,
        summaryId,
        topicId,
        insightIndex,
        insightText: insight,
        eventId: isDuplicate ? null : eventId,
      },
    });

    return NextResponse.json({
      code: 0,
      data: { alreadyAccepted: false, eventId },
    });
  } catch (error) {
    console.error("[accept-insight] 接受启发失败", error);
    return NextResponse.json(
      {
        code: 500,
        message: error instanceof Error ? error.message : "内部错误",
        data: null,
      },
      { status: 500 },
    );
  }
}
