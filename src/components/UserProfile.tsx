"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface User {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  secondmeUserId: string;
}

interface UserProfileProps {
  user: User;
  newFollowerCount?: number;
}

export function UserProfile({ user, newFollowerCount = 0 }: UserProfileProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [shades, setShades] = useState<{ shade: string; score: number }[]>([]);
  const [loadingShades, setLoadingShades] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchShades = async () => {
    if (shades.length > 0) return;
    setLoadingShades(true);
    try {
      const res = await fetch("/api/user/shades");
      const data = await res.json();
      if (data.code === 0) {
        setShades(data.data?.shades || []);
      }
    } catch (error) {
      console.error("Failed to fetch shades:", error);
    } finally {
      setLoadingShades(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (!showDropdown) fetchShades();
        }}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-[#E8E6E1] rounded-xl hover:border-[#6C5CE7] transition-all duration-200"
      >
        {/* 头像 + 通知圆点 */}
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.nickname || "用户"}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.nickname?.charAt(0) || "用"
            )}
          </div>
          {newFollowerCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          )}
        </div>
        <span className="text-[#2D3436] font-medium text-sm">
          {user.nickname || "用户"}
        </span>
        <svg
          className={`w-4 h-4 text-[#636E72] transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-[#E8E6E1] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 用户信息 */}
          <div className="p-5 border-b border-[#E8E6E1]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.nickname || "用户"}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.nickname?.charAt(0) || "用"
                )}
              </div>
              <div>
                <h3 className="font-semibold text-[#2D3436]">
                  {user.nickname || "用户"}
                </h3>
                <p className="text-sm text-[#636E72]">
                  ID: {user.secondmeUserId.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>

          {/* 兴趣标签 */}
          <div className="p-5 border-b border-[#E8E6E1]">
            <h4 className="text-sm font-medium text-[#636E72] mb-3">
              兴趣标签
            </h4>
            {loadingShades ? (
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-[#E8E6E1] rounded-full animate-pulse"></div>
                <div className="h-6 w-20 bg-[#E8E6E1] rounded-full animate-pulse"></div>
                <div className="h-6 w-14 bg-[#E8E6E1] rounded-full animate-pulse"></div>
              </div>
            ) : shades.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {shades.slice(0, 6).map((item, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-[#6C5CE7]/10 text-[#6C5CE7] text-sm rounded-full font-medium"
                  >
                    {item.shade}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#636E72]">暂无兴趣标签</p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="p-3">
            <Link
              href="/following"
              onClick={() => setShowDropdown(false)}
              className="w-full flex items-center gap-3 px-4 py-3 text-[#2D3436] hover:bg-[#F5F3FF] rounded-xl transition-colors"
            >
              <svg
                className="w-5 h-5 text-[#6C5CE7]"
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
              <span className="font-medium flex-1">关注列表</span>
              {newFollowerCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-semibold leading-none">
                  {newFollowerCount}
                </span>
              )}
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-[#E74C3C] hover:bg-[#FEF2F2] rounded-xl transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
