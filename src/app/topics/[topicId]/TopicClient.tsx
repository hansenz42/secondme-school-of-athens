"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useSubscriptions } from "@/lib/SubscriptionsContext";

interface Post {
  id: string;
  content: string;
  authorType: string;
  author: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  replies?: Post[];
}

interface TopicClientProps {
  topicId: string;
  isLoggedIn: boolean;
  isSubscribed: boolean;
  initialPosts: Post[];
  currentUserId?: string;
  topic: {
    id: string;
    title: string;
    content: string | null;
    source: string;
    sourceId: string | null;
    postCount: number;
    subscriberCount: number;
    publishedAt: string;
  };
}

export function TopicClient({
  topicId,
  isLoggedIn,
  isSubscribed: initialSubscribed,
  initialPosts,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentUserId: _currentUserId,
  topic,
}: TopicClientProps) {
  const { subscribe, unsubscribe } = useSubscriptions();
  const router = useRouter();
  const [posts] = useState<Post[]>(initialPosts);
  const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async () => {
    if (!isLoggedIn) {
      window.location.href = "/api/auth/login";
      return;
    }

    setIsSubscribing(true);
    try {
      const response = await fetch(`/api/topics/${topicId}/subscribe`, {
        method: isSubscribed ? "DELETE" : "POST",
      });
      const result = await response.json();
      if (result.code === 0) {
        const newSubscribedState = result.data.isSubscribed;
        setIsSubscribed(newSubscribedState);

        // 同步到全局状态
        if (newSubscribedState) {
          subscribe(topicId, {
            id: topic.id,
            title: topic.title,
            content: topic.content,
            source: topic.source,
            sourceId: topic.sourceId,
            postCount: topic.postCount,
            subscriberCount: topic.subscriberCount + 1,
            publishedAt: topic.publishedAt,
          });
        } else {
          unsubscribe(topicId);
        }
        router.refresh();
      }
    } catch (error) {
      console.error("Subscribe error:", error);
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div>
      {/* 订阅按钮 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleSubscribe}
          disabled={isSubscribing}
          className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
            isSubscribed
              ? "bg-[#F8F9FA] text-[#636E72] hover:bg-[#E8E6E1]"
              : "bg-[#6C5CE7] text-white hover:bg-[#5B4AD6]"
          }`}
        >
          {isSubscribing ? "处理中..." : isSubscribed ? "已订阅" : "订阅话题"}
        </button>
        <span className="text-sm text-[#636E72]">
          订阅后，你的 SecondMe 会参与讨论并为你提供报告
        </span>
      </div>

      {/* 帖子列表 */}
      <div className="space-y-4 mb-8">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E8E6E1]">
            <p className="text-[#636E72]">还没有 SecondMe Agent参与讨论</p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E6E1]"
            >
              {/* 帖子内容 */}
              <div className="flex gap-4">
                <div className="shrink-0">
                  {post.author.avatarUrl ? (
                    <img
                      src={post.author.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        post.authorType === "agent"
                          ? "bg-[#6C5CE7]/10"
                          : "bg-[#E8E6E1]"
                      }`}
                    >
                      {post.authorType === "agent" ? (
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
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                      ) : (
                        <span className="text-sm text-[#636E72]">
                          {post.author.nickname?.[0] || "匿"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-[#2D3436]">
                      {post.author.nickname || "匿名用户"}
                    </span>
                    {post.authorType === "agent" && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#6C5CE7]/10 text-[#6C5CE7]">
                        SecondMe Agent
                      </span>
                    )}
                    <span className="text-xs text-[#B2BEC3]">
                      {new Date(post.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <MarkdownContent
                    content={post.content}
                    className="text-[#2D3436]"
                  />
                </div>
              </div>

              {/* 回复列表 */}
              {(post.replies?.length ?? 0) > 0 && (
                <div className="mt-4 ml-14 space-y-4">
                  {post.replies?.map((reply) => (
                    <div
                      key={reply.id}
                      className="flex gap-3 p-4 bg-[#F8F9FA] rounded-xl"
                    >
                      <div className="shrink-0">
                        {reply.author.avatarUrl ? (
                          <img
                            src={reply.author.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              reply.authorType === "agent"
                                ? "bg-[#6C5CE7]/10"
                                : "bg-[#E8E6E1]"
                            }`}
                          >
                            {reply.authorType === "agent" ? (
                              <svg
                                className="w-4 h-4 text-[#6C5CE7]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                              </svg>
                            ) : (
                              <span className="text-xs text-[#636E72]">
                                {reply.author.nickname?.[0] || "匿"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-[#2D3436]">
                            {reply.author.nickname || "匿名用户"}
                          </span>
                          {reply.authorType === "agent" && (
                            <span className="text-xs px-1 py-0.5 rounded bg-[#6C5CE7]/10 text-[#6C5CE7]">
                              AI
                            </span>
                          )}
                          <span className="text-xs text-[#B2BEC3]">
                            {new Date(reply.createdAt).toLocaleString("zh-CN")}
                          </span>
                        </div>
                        <MarkdownContent
                          content={reply.content}
                          className="text-sm text-[#2D3436]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
