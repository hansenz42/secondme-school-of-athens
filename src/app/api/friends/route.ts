import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reportToAgentMemory } from "@/lib/agent";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const friends = await prisma.friend.findMany({
      where: { userId: user.id },
      include: {
        friend: {
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
        friends: (
          friends as Array<{
            createdAt: Date;
            friend: {
              id: string;
              nickname: string | null;
              avatarUrl: string | null;
              secondmeUserId: string;
            };
          }>
        ).map((f) => ({
          id: f.friend.id,
          nickname: f.friend.nickname,
          avatarUrl: f.friend.avatarUrl,
          secondmeUserId: f.friend.secondmeUserId,
          followedAt: f.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/friends] error", error);
    return NextResponse.json(
      { code: 500, message: "服务器错误", data: null },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const body = (await req.json()) as { friendId?: string };
    const { friendId } = body;

    if (!friendId) {
      return NextResponse.json(
        { code: 400, message: "缺少 friendId", data: null },
        { status: 400 },
      );
    }

    if (friendId === user.id) {
      return NextResponse.json(
        { code: 400, message: "不能关注自己", data: null },
        { status: 400 },
      );
    }

    const friendUser = await prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true, secondmeUserId: true, nickname: true },
    });
    if (!friendUser) {
      return NextResponse.json(
        { code: 404, message: "用户不存在", data: null },
        { status: 404 },
      );
    }

    // 幂等 upsert
    await prisma.friend.upsert({
      where: { userId_friendId: { userId: user.id, friendId } },
      create: { userId: user.id, friendId },
      update: {},
    });

    // 上报 find_people 到 SecondMe Agent Memory（非阻塞，失败不影响主流程）
    try {
      await reportToAgentMemory(user.accessToken, {
        action: "find_people",
        channel: { kind: "athena_academy" },
        refs: [
          {
            objectType: "user",
            objectId: friendUser.secondmeUserId,
            contentPreview: (friendUser.nickname ?? undefined) as
              | string
              | undefined,
          },
        ],
        displayText: `关注了用户 ${friendUser.nickname || "匿名"}`,
        importance: 0.5,
      });
    } catch (e) {
      console.error("[POST /api/friends] Agent Memory 上报失败", e);
    }

    return NextResponse.json({ code: 0, data: { success: true } });
  } catch (error) {
    console.error("[POST /api/friends] error", error);
    return NextResponse.json(
      { code: 500, message: "服务器错误", data: null },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const friendId = searchParams.get("friendId");

    if (!friendId) {
      return NextResponse.json(
        { code: 400, message: "缺少 friendId", data: null },
        { status: 400 },
      );
    }

    await prisma.friend.deleteMany({
      where: { userId: user.id, friendId },
    });

    return NextResponse.json({ code: 0, data: { success: true } });
  } catch (error) {
    console.error("[DELETE /api/friends] error", error);
    return NextResponse.json(
      { code: 500, message: "服务器错误", data: null },
      { status: 500 },
    );
  }
}
