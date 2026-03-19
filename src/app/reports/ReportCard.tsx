"use client";

import { useState } from "react";
import Link from "next/link";

interface WanderTopicSummary {
  topicId: string;
  title: string;
  insights: string[];
  recommended: boolean;
  reason: string;
}

interface RecommendedUser {
  userId: string;
  secondmeUserId: string;
  name: string;
  avatarUrl?: string;
  reason: string;
  topicId: string;
}

interface WanderSummaryContent {
  topics: WanderTopicSummary[];
  overallTakeaways: string[];
  generatedAt: string;
  recommendedUsers?: RecommendedUser[];
}

interface WanderSummaryCardProps {
  summary: {
    id: string;
    sessionId: string;
    content: WanderSummaryContent;
    totalTopics: number;
    wanderedAt: string;
    createdAt: string;
  };
  /** Set of already-accepted insight keys: "${topicId}_${insightIndex}" */
  initialAccepted: Set<string>;
  /** IDs of users already followed by current user */
  friendIds: string[];
}

function insightKey(topicId: string, insightIndex: number) {
  return `${topicId}_${insightIndex}`;
}

export function ReportCard({
  summary,
  initialAccepted,
  friendIds,
}: WanderSummaryCardProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(
    new Set(initialAccepted),
  );
  const [loading, setLoading] = useState<Set<string>>(new Set());
  // Track followed users (start from server-provided friendIds)
  const [followedIds, setFollowedIds] = useState<Set<string>>(
    new Set(friendIds),
  );
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set());

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const acceptInsight = async (
    topicId: string,
    topicTitle: string,
    insight: string,
    insightIndex: number,
  ) => {
    const key = insightKey(topicId, insightIndex);
    if (accepted.has(key) || loading.has(key)) return;

    setLoading((prev) => new Set(prev).add(key));

    try {
      const res = await fetch("/api/reports/accept-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryId: summary.id,
          topicId,
          topicTitle,
          insight,
          insightIndex,
        }),
      });
      const result = await res.json();
      if (result.code === 0) {
        setAccepted((prev) => new Set(prev).add(key));
      }
    } finally {
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const acceptAllInsights = async (topic: WanderTopicSummary) => {
    await Promise.all(
      topic.insights
        .map((insight, i) => ({
          insight,
          i,
          key: insightKey(topic.topicId, i),
        }))
        .filter(({ key }) => !accepted.has(key) && !loading.has(key))
        .map(({ insight, i }) =>
          acceptInsight(topic.topicId, topic.title, insight, i),
        ),
    );
  };

  const wanderedDate = new Date(summary.wanderedAt);
  const recommendedCount =
    summary.content.topics?.filter((t) => t.recommended).length ?? 0;

  const followUser = async (userId: string) => {
    if (followedIds.has(userId) || followLoading.has(userId)) return;
    setFollowLoading((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: userId }),
      });
      const result = await res.json();
      if (result.code === 0) {
        setFollowedIds((prev) => new Set(prev).add(userId));
      }
    } finally {
      setFollowLoading((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const totalInsights =
    summary.content.topics?.reduce(
      (sum, t) => sum + (t.insights?.length ?? 0),
      0,
    ) ?? 0;
  // acceptedCount is derived from reactive `accepted` state so it updates in real-time
  const acceptedInsightsCount =
    summary.content.topics?.reduce(
      (sum, t) =>
        sum +
        (t.insights?.filter((_, i) => accepted.has(insightKey(t.topicId, i)))
          .length ?? 0),
      0,
    ) ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E8E6E1] overflow-hidden">
      {/* 头部：wander 时间 + 概览 */}
      <div className="p-6 border-b border-[#E8E6E1] bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                启发报告
              </span>
              <span className="text-xs text-[#B2BEC3]">
                {wanderedDate.toLocaleString("zh-CN", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#2D3436]">
              本次漫游了 {summary.totalTopics} 个话题
              {recommendedCount > 0 && (
                <span className="ml-2 text-sm font-normal text-indigo-600">
                  · {recommendedCount} 个值得关注
                </span>
              )}
            </h3>
            {totalInsights > 0 && (
              <p className="text-xs text-[#B2BEC3] mt-1.5">
                共 {totalInsights} 条启发
                {acceptedInsightsCount > 0 ? (
                  <span className="text-emerald-500 ml-1">
                    · 已接受 {acceptedInsightsCount} 条
                  </span>
                ) : (
                  <span className="text-indigo-400 ml-1">
                    · 展开话题可逐条接受
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 总体认知建议 */}
        {summary.content.overallTakeaways?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[#2D3436] mb-3 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-indigo-500"
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
              认知升级要点
            </h4>
            <ul className="space-y-2">
              {summary.content.overallTakeaways.map((takeaway, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[#636E72] text-sm"
                >
                  <span className="text-indigo-500 mt-0.5 shrink-0">✦</span>
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 话题列表 */}
        {summary.content.topics?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[#2D3436] mb-3">
              话题启发
            </h4>
            <div className="space-y-3">
              {summary.content.topics.map((topic) => {
                const allAccepted =
                  topic.insights?.length > 0 &&
                  topic.insights.every((_, i) =>
                    accepted.has(insightKey(topic.topicId, i)),
                  );
                const someLoading = topic.insights?.some((_, i) =>
                  loading.has(insightKey(topic.topicId, i)),
                );

                return (
                  <div
                    key={topic.topicId}
                    className={`rounded-xl border p-4 transition-colors ${
                      topic.recommended
                        ? "border-indigo-200 bg-indigo-50/50"
                        : "border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {topic.recommended && (
                          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                            推荐
                          </span>
                        )}
                        <Link
                          href={`/topics/${topic.topicId}`}
                          className="text-sm font-semibold text-[#2D3436] hover:text-indigo-600 transition-colors truncate"
                        >
                          {topic.title}
                        </Link>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {topic.insights?.length > 0 &&
                          (() => {
                            const topicAccepted = topic.insights.filter(
                              (_, i) =>
                                accepted.has(insightKey(topic.topicId, i)),
                            ).length;
                            const topicTotal = topic.insights.length;
                            return (
                              <span className="text-xs text-[#B2BEC3]">
                                {topicAccepted > 0 ? (
                                  <span className="text-emerald-500">
                                    {topicAccepted}
                                  </span>
                                ) : (
                                  <span>0</span>
                                )}
                                /{topicTotal} 条启发
                              </span>
                            );
                          })()}
                        <button
                          onClick={() => toggleTopic(topic.topicId)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                        >
                          {expandedTopics.has(topic.topicId) ? "收起" : "展开"}
                        </button>
                      </div>
                    </div>

                    {expandedTopics.has(topic.topicId) && (
                      <div className="mt-3 space-y-3">
                        {topic.insights?.length > 0 && (
                          <ul className="space-y-2">
                            {topic.insights.map((insight, i) => {
                              const key = insightKey(topic.topicId, i);
                              const isAccepted = accepted.has(key);
                              const isLoading = loading.has(key);

                              return (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-xs text-[#636E72]"
                                >
                                  <span className="text-indigo-400 mt-0.5 shrink-0">
                                    •
                                  </span>
                                  <span className="flex-1">{insight}</span>
                                  {isAccepted ? (
                                    <span className="shrink-0 flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                      <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      已接受
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        acceptInsight(
                                          topic.topicId,
                                          topic.title,
                                          insight,
                                          i,
                                        )
                                      }
                                      disabled={isLoading}
                                      className="shrink-0 flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isLoading ? (
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
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                          />
                                        </svg>
                                      ) : (
                                        <svg
                                          className="w-3 h-3"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={2}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 4v16m8-8H4"
                                          />
                                        </svg>
                                      )}
                                      接受启发
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {/* 全部接受按钮 */}
                        {topic.insights?.length > 1 && !allAccepted && (
                          <div className="pt-2 border-t border-gray-100 flex justify-end">
                            <button
                              onClick={() => acceptAllInsights(topic)}
                              disabled={someLoading}
                              className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {someLoading ? (
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
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                  />
                                </svg>
                              )}
                              全部接受
                            </button>
                          </div>
                        )}

                        {topic.reason && (
                          <p className="text-xs text-[#B2BEC3] italic border-t border-gray-100 pt-2">
                            {topic.reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 本次漫游认识的有趣用户 */}
      {(summary.content.recommendedUsers?.length ?? 0) > 0 && (
        <div className="px-6 pb-6 border-t border-[#E8E6E1] pt-5">
          <h4 className="text-sm font-semibold text-[#2D3436] mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-indigo-500"
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
            本次漫游认识的有趣用户
          </h4>
          <div className="space-y-3">
            {summary.content.recommendedUsers!.map((ru) => {
              const isFollowed = followedIds.has(ru.userId);
              const isLoading = followLoading.has(ru.userId);
              return (
                <div
                  key={ru.userId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  {/* 头像 */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shrink-0 overflow-hidden">
                    {ru.avatarUrl ? (
                      <img
                        src={ru.avatarUrl}
                        alt={ru.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      ru.name.charAt(0)
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2D3436] truncate">
                      {ru.name}
                    </p>
                    {ru.reason && (
                      <p className="text-xs text-[#636E72] truncate">
                        {ru.reason}
                      </p>
                    )}
                  </div>
                  {/* 关注按钮 */}
                  {isFollowed ? (
                    <span className="shrink-0 flex items-center gap-1 text-xs text-emerald-600 font-medium px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      已关注
                    </span>
                  ) : (
                    <button
                      onClick={() => followUser(ru.userId)}
                      disabled={isLoading}
                      className="shrink-0 flex items-center gap-1 text-xs text-indigo-600 font-medium px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
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
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      )}
                      添加好友
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
