/**
 * 报告 API
 *
 * GET: 获取用户的报告列表
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const reports = await prisma.report.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            source: true,
          },
        },
      },
    });

    return NextResponse.json({
      code: 0,
      data: {
        reports: reports.map((r) => ({
          id: r.id,
          topic: {
            id: r.topic.id,
            title: r.topic.title,
            source: r.topic.source,
          },
          content: r.content,
          status: r.status,
          syncedAt: r.syncedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
