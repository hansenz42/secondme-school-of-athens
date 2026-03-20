"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Friend {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  secondmeUserId: string;
  followedAt: string;
}

interface Follower {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  secondmeUserId: string;
  followedAt: string;
  isNew: boolean;
}

interface FollowingClientProps {
  friends: Friend[];
  followers: Follower[];
  newFollowerCount: number;
}

export function FollowingClient({
  friends: initialFriends,
  followers,
  newFollowerCount: initialNewFollowerCount,
}: FollowingClientProps) {
  const [friends, setFriends] = useState<Friend[]>(initialFriends);
  const [unfollowLoading, setUnfollowLoading] = useState<Set<string>>(
    new Set(),
  );
  const [newFollowerCount, setNewFollowerCount] = useState(
    initialNewFollowerCount,
  );
  const router = useRouter();

  // 进入页面时标记"关注了我"列表已读，清除通知圆点
  useEffect(() => {
    fetch("/api/followers/viewed", { method: "POST" })
      .then(() => {
        setNewFollowerCount(0);
        router.refresh();
      })
      .catch(() => {});
  }, [router]);

  const unfollow = async (friendId: string) => {
    if (unfollowLoading.has(friendId)) return;
    setUnfollowLoading((prev) => new Set(prev).add(friendId));
    try {
      const res = await fetch(
        `/api/friends?friendId=${encodeURIComponent(friendId)}`,
        {
          method: "DELETE",
        },
      );
      const result = await res.json();
      if (result.code === 0) {
        // Optimistic remove
        setFriends((prev) => prev.filter((f) => f.id !== friendId));
      }
    } finally {
      setUnfollowLoading((prev) => {
        const next = new Set(prev);
        next.delete(friendId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-10">
      {/* ===== 我的关注 ===== */}
      <section>
        <h2 className="text-lg font-bold text-[#2D3436] mb-4">
          我的关注
          <span className="ml-2 text-sm font-normal text-[#B2BEC3]">
            {friends.length} 人
          </span>
        </h2>
        {friends.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-[#E8E6E1]">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#2D3436] mb-2">
              还没有关注任何人
            </h3>
            <p className="text-[#636E72] text-sm max-w-xs mx-auto">
              在话题详情页订阅者列表中，点击头像上的 + 号即可关注
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => {
              const isLoading = unfollowLoading.has(friend.id);
              const followedDate = new Date(friend.followedAt);
              return (
                <div
                  key={friend.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E8E6E1] shadow-sm hover:border-[#6C5CE7]/30 transition-colors"
                >
                  {/* 头像 */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base shrink-0 overflow-hidden">
                    {friend.avatarUrl ? (
                      <img
                        src={friend.avatarUrl}
                        alt={friend.nickname || "用户"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (friend.nickname?.charAt(0) ?? "用")
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#2D3436] truncate">
                      {friend.nickname || "匿名用户"}
                    </p>
                    <p className="text-xs text-[#B2BEC3] mt-0.5">
                      ID: {friend.secondmeUserId.slice(0, 12)}...
                    </p>
                    <p className="text-xs text-[#B2BEC3]">
                      关注于{" "}
                      {followedDate.toLocaleDateString("zh-CN", {
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  {/* 取关按钮 */}
                  <button
                    onClick={() => unfollow(friend.id)}
                    disabled={isLoading}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm text-[#636E72] border border-[#E8E6E1] rounded-xl hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
                        />
                      </svg>
                    )}
                    取关
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== 关注了我 ===== */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#2D3436]">
            关注了我
            <span className="ml-2 text-sm font-normal text-[#B2BEC3]">
              {followers.length} 人
            </span>
          </h2>
          {newFollowerCount > 0 && (
            <p className="mt-1 text-sm font-medium text-amber-600">
              有 {newFollowerCount} 个新的关注
            </p>
          )}
        </div>

        {followers.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-[#E8E6E1]">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#2D3436] mb-2">
              还没有人关注你
            </h3>
            <p className="text-[#636E72] text-sm max-w-xs mx-auto">
              多参与话题讨论，让更多人认识你的 SecondMe 分身吧
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followers.map((follower) => {
              const followedDate = new Date(follower.followedAt);
              return (
                <div
                  key={follower.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E8E6E1] shadow-sm hover:border-[#6C5CE7]/30 transition-colors"
                >
                  {/* 头像 + 新关注圆点 */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-base overflow-hidden">
                      {follower.avatarUrl ? (
                        <img
                          src={follower.avatarUrl}
                          alt={follower.nickname || "用户"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (follower.nickname?.charAt(0) ?? "用")
                      )}
                    </div>
                    {/* 新关注圆点 */}
                    {follower.isNew && (
                      <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#2D3436] truncate">
                        {follower.nickname || "匿名用户"}
                      </p>
                      {follower.isNew && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium border border-red-100">
                          新
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#B2BEC3] mt-0.5">
                      ID: {follower.secondmeUserId.slice(0, 12)}...
                    </p>
                    <p className="text-xs text-[#B2BEC3]">
                      关注于{" "}
                      {followedDate.toLocaleDateString("zh-CN", {
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
