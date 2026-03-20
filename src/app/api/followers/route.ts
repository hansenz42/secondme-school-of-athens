/**
 * 关注了我的用户 API
 *
 * GET: 获取关注我的用户列表，含 isNew（是否在上次查看之后新增）标志
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

    const lastViewedAt =
      (user as { lastViewedFollowersAt?: Date | null }).lastViewedFollowersAt ??
      null;

    const followers = await prisma.friend.findMany({
      where: { friendId: user.id },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            secondmeUserId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      code: 0,
      data: {
        followers: (
          followers as Array<{
            createdAt: Date;
            user: {
              id: string;
              nickname: string | null;
              avatarUrl: string | null;
              secondmeUserId: string;
            };
          }>
        ).map((f) => ({
          id: f.user.id,
          nickname: f.user.nickname,
          avatarUrl: f.user.avatarUrl,
          secondmeUserId: f.user.secondmeUserId,
          followedAt: f.createdAt.toISOString(),
          isNew: lastViewedAt === null || f.createdAt > lastViewedAt,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/followers] error", error);
    return NextResponse.json(
      { code: 500, message: "服务器错误", data: null },
      { status: 500 },
    );
  }
}
