import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MainHeader } from "@/components/MainHeader";
import { FollowingClient } from "./FollowingClient";

export default async function FollowingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/login");
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

  const serializedFriends = (
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
  }));

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} activeTab="square" />

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#2D3436] mb-2 tracking-tight">
            关注列表
          </h1>
          <p className="text-[#636E72]">
            你关注的 {serializedFriends.length} 位用户
          </p>
        </div>

        <FollowingClient friends={serializedFriends} />
      </main>
    </div>
  );
}
