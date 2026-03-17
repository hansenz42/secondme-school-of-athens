"use client";

import { useState } from "react";
import Link from "next/link";

interface Participant {
  id: string;
  role: string;
  user: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

interface Room {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  participants: Participant[];
  _count: {
    messages: number;
    participants: number;
  };
}

interface RoomListProps {
  initialRooms: Room[];
  isLoggedIn: boolean;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "waiting":
      return (
        <span className="px-2.5 py-1 bg-[#FDCB6E]/10 text-[#F39C12] text-xs font-medium rounded-full">
          等待中
        </span>
      );
    case "active":
      return (
        <span className="px-2.5 py-1 bg-[#00B894]/10 text-[#00B894] text-xs font-medium rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[#00B894] rounded-full animate-pulse"></span>
          进行中
        </span>
      );
    case "finished":
      return (
        <span className="px-2.5 py-1 bg-[#636E72]/10 text-[#636E72] text-xs font-medium rounded-full">
          已结束
        </span>
      );
    default:
      return null;
  }
}

export function RoomList({ initialRooms, isLoggedIn }: RoomListProps) {
  const [rooms] = useState<Room[]>(initialRooms);

  if (rooms.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8E6E1] p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-[#FAF9F6] rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-[#636E72]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[#2D3436] mb-2">暂无讨论房间</h3>
        <p className="text-[#636E72] mb-6">
          {isLoggedIn ? "成为第一个创建房间的人吧！" : "登录后可以创建或加入讨论房间"}
        </p>
        {isLoggedIn ? (
          <Link
            href="/rooms/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#6C5CE7] text-white rounded-xl font-medium hover:bg-[#5B4CD6] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建房间
          </Link>
        ) : (
          <button
            onClick={() => window.location.href = "/api/auth/login"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#2D3436] text-white rounded-xl font-medium hover:bg-[#636E72] transition-colors"
          >
            登录后创建
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => (
        <Link
          key={room.id}
          href={`/rooms/${room.id}`}
          className="group bg-white rounded-2xl border border-[#E8E6E1] p-6 hover:border-[#6C5CE7] hover:shadow-lg transition-all duration-300"
        >
          {/* 房间标题和状态 */}
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#2D3436] group-hover:text-[#6C5CE7] transition-colors line-clamp-2">
              {room.title}
            </h3>
            {getStatusBadge(room.status)}
          </div>

          {/* 房间描述 */}
          {room.description && (
            <p className="text-sm text-[#636E72] mb-4 line-clamp-2">
              {room.description}
            </p>
          )}

          {/* 参与者头像 */}
          <div className="flex items-center mb-4">
            <div className="flex -space-x-2">
              {room.participants.slice(0, 4).map((participant) => (
                <div
                  key={participant.id}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                  title={participant.user.nickname || "用户"}
                >
                  {participant.user.avatarUrl ? (
                    <img
                      src={participant.user.avatarUrl}
                      alt={participant.user.nickname || "用户"}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    participant.user.nickname?.charAt(0) || "?"
                  )}
                </div>
              ))}
              {room._count.participants > 4 && (
                <div className="w-8 h-8 rounded-full bg-[#E8E6E1] border-2 border-white flex items-center justify-center text-[#636E72] text-xs font-medium">
                  +{room._count.participants - 4}
                </div>
              )}
            </div>
            <span className="ml-3 text-sm text-[#636E72]">
              {room._count.participants} 人参与
            </span>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E8E6E1]">
            <span className="text-xs text-[#636E72]">
              {new Date(room.createdAt).toLocaleDateString("zh-CN")}
            </span>
            <span className="text-xs text-[#636E72] flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {room._count.messages} 条消息
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
