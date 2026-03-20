/**
 * 标记"关注了我"列表已读
 *
 * POST: 更新 lastViewedFollowersAt = now()，清除新关注者通知
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastViewedFollowersAt: new Date() },
    });

    return NextResponse.json({ code: 0, data: null });
  } catch (error) {
    console.error("[POST /api/followers/viewed] error", error);
    return NextResponse.json(
      { code: 500, message: "服务器错误", data: null },
      { status: 500 },
    );
  }
}
