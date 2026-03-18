import { redirect } from "next/navigation";
import Link from "next/link";
import { ChatRoom } from "@/components/ChatRoom";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getRoom(roomId: string) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
    return room;
  } catch {
    return null;
  }
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const user = await getCurrentUser();
  const room = await getRoom(roomId);

  if (!user) {
    redirect("/?error=not_logged_in");
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#2D3436] mb-4">房间不存在</h1>
          <Link href="/" className="text-[#6C5CE7] hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  // 检查用户是否是房间参与者
  const isParticipant = room.participants.some(
    (p: { user: { id: string } }) => p.user.id === user.id,
  );

  if (!isParticipant) {
    // 自动加入房间
    await prisma.roomParticipant.create({
      data: {
        userId: user.id,
        roomId: room.id,
        role: "participant",
      },
    });

    // 如果房间状态是 waiting，改为 active
    if (room.status === "waiting") {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: "active" },
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-6">
      <div className="max-w-4xl mx-auto">
        <ChatRoom
          room={room}
          initialMessages={room.messages}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
