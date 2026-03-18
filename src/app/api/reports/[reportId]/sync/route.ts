/**
 * 同步报告到 SecondMe API
 *
 * POST: 将报告整合到 SecondMe 知识库
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { syncReportToSecondMe, type ReportContent } from "@/lib/agent";

interface RouteParams {
  params: Promise<{ reportId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { reportId } = await params;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        topic: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { code: 404, message: "报告不存在", data: null },
        { status: 404 },
      );
    }

    // 验证报告属于当前用户
    if (report.userId !== user.id) {
      return NextResponse.json(
        { code: 403, message: "无权操作", data: null },
        { status: 403 },
      );
    }

    // 检查是否已同步
    if (report.status === "synced") {
      return NextResponse.json({
        code: 0,
        message: "报告已同步",
        data: { synced: true, syncedAt: report.syncedAt },
      });
    }

    // 同步到 SecondMe
    const reportContent = report.content as ReportContent;
    const result = await syncReportToSecondMe(user.accessToken, reportContent);

    if (!result.success) {
      return NextResponse.json(
        { code: 500, message: "同步失败，请稍后重试", data: null },
        { status: 500 },
      );
    }

    // 更新报告状态
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "synced",
        syncedAt: new Date(),
      },
    });

    return NextResponse.json({
      code: 0,
      message: "报告已整合到 SecondMe 知识库",
      data: {
        synced: true,
        syncedAt: new Date(),
        eventId: result.eventId,
      },
    });
  } catch (error) {
    console.error("Sync report error:", error);
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null },
      { status: 500 },
    );
  }
}
