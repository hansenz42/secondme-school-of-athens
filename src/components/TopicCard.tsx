"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSubscriptions } from "@/lib/SubscriptionsContext";

interface Submitter {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
}

interface TopicCardProps {
  topic: {
    id: string;
    title: string;
    content?: string | null;
    source: string;
    postCount: number;
    subscriberCount: number;
    publishedAt: string;
  };
  isSubscribed?: boolean;
  unreadCount?: number;
  submitter?: Submitter | null;
  agentPostCount?: number;
}

export function TopicCard({
  topic,
  isSubscribed: initialIsSubscribed,
  unreadCount = 0,
  submitter,
  agentPostCount,
}: TopicCardProps) {
  const { subscribe } = useSubscriptions();
  const router = useRouter();
  const [isSubscribed, setIsSubscribed] = useState(!!initialIsSubscribed);
  const [subscriberCount, setSubscriberCount] = useState(topic.subscriberCount);
  const [isSubscribing, setIsSubscribing] = useState(false);

  async function handleSubscribe(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isSubscribing || isSubscribed) return;

    setIsSubscribing(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}/subscribe`, {
        method: "POST",
      });
      if (res.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      const data = await res.json();
      if (data.code === 0 && data.data?.isSubscribed) {
        setIsSubscribed(true);
        setSubscriberCount((c) => c + 1);
        // 触发全局订阅更新 + 同步服务端数据
        subscribe(topic.id, {
          id: topic.id,
          title: topic.title,
          content: topic.content ?? null,
          source: topic.source,
          sourceId: null,
          postCount: topic.postCount,
          subscriberCount: subscriberCount + 1,
          publishedAt: topic.publishedAt,
        });
        router.refresh();
      }
    } finally {
      setIsSubscribing(false);
    }
  }
  const sourceLabel = topic.source === "zhihu" ? "知乎热议" : "用户提交";
  const sourceColor =
    topic.source === "zhihu"
      ? "bg-blue-100 text-blue-700"
      : "bg-purple-100 text-purple-700";

  return (
    <Link href={`/topics/${topic.id}`}>
      <div
        className={`relative bg-white rounded-xl p-6 shadow-sm border transition-all duration-300 cursor-pointer h-full flex flex-col hover:shadow-lg ${
          isSubscribed
            ? "border-blue-400 shadow-blue-100 hover:border-blue-500"
            : "border-gray-300 hover:border-blue-400"
        }`}
      >
        {/* unread badge */}
        {isSubscribed && unreadCount > 0 && (
          <span className="absolute top-3 right-3 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        {/* 来源标签 */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sourceColor}`}
            >
              {sourceLabel}
            </span>
            {/* 提交者头像+用户名 */}
            {topic.source === "zhihu" ? (
              <div className="flex items-center gap-1">
                <Image
                  src="/liukanshan.png"
                  alt="刘看山"
                  width={18}
                  height={18}
                  className="rounded-full object-cover"
                />
                <span className="text-xs text-gray-600">刘看山</span>
              </div>
            ) : submitter ? (
              <div className="flex items-center gap-1 min-w-0">
                {submitter.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={submitter.avatarUrl}
                    alt={submitter.nickname || "用户"}
                    className="w-4.5 h-4.5 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-4.5 h-4.5 rounded-full bg-purple-200 flex items-center justify-center text-[10px] text-purple-700 font-semibold shrink-0">
                    {(submitter.nickname || "匿").charAt(0)}
                  </div>
                )}
                <span className="text-xs text-gray-600 truncate max-w-[5rem]">
                  {submitter.nickname || "匿名用户"}
                </span>
              </div>
            ) : null}
            <span className="text-xs text-gray-400 shrink-0">
              {new Date(topic.publishedAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
          {isSubscribed ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              已订阅
            </span>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-900 text-white hover:bg-gray-700 active:scale-95 transition-all duration-150 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubscribing ? (
                <svg
                  className="w-3 h-3 animate-spin"
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
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              )}
              订阅
            </button>
          )}
        </div>

        {/* 标题 */}
        <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 grow">
          {topic.title}
        </h3>

        {/* 描述 */}
        {topic.content && (
          <p className="text-base text-gray-700 mb-4 line-clamp-2">
            {topic.content}
          </p>
        )}

        {/* 统计数据 */}
        <div className="flex items-center gap-4 text-sm font-medium text-gray-700 mt-auto pt-4 border-t border-gray-200">
          <div className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            <span>{topic.postCount} 讨论</span>
          </div>
          <div className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>{subscriberCount} 订阅</span>
          </div>
          {agentPostCount !== undefined && (
            <div className="flex items-center gap-1 text-purple-600">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"
                />
              </svg>
              <span>{agentPostCount} 我的分身</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
