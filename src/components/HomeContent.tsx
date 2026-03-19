"use client";

import { TopicCard } from "@/components/TopicCard";
import { CreateTopicButton } from "@/components/CreateTopicButton";
import { Pagination } from "@/components/Pagination";
import {
  SubscriptionsProvider,
  useSubscriptions,
  useSubscribedTopicIds,
} from "@/lib/SubscriptionsContext";

interface RawSubscription {
  id: string;
  userId: string;
  topicId: string;
  createdAt: Date;
  lastVisitAt: Date | null;
  unreadCount: number;
  topic: {
    id: string;
    title: string;
    content: string | null;
    source: string;
    sourceId: string | null;
    publishedAt: Date;
    _count: {
      posts: number;
      subscriptions: number;
    };
  };
}

interface Topic {
  id: string;
  title: string;
  content: string | null;
  source: string;
  postCount: number;
  subscriberCount: number;
  publishedAt: string;
  submitter: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  } | null;
}

interface Submitter {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
}

interface HomeContentProps {
  topics: Topic[];
  rawSubscriptions: RawSubscription[];
  submitters: Submitter[];
  isLoggedIn: boolean;
  currentPage?: number;
  totalPages?: number;
}

interface HomeContentInnerProps {
  topics: Topic[];
  submitters: Submitter[];
  isLoggedIn: boolean;
  currentPage?: number;
  totalPages?: number;
}

function SubscriptionsList({
  submitters,
  isLoggedIn,
}: {
  submitters: Submitter[];
  isLoggedIn: boolean;
}) {
  const { subscriptions } = useSubscriptions();

  if (!isLoggedIn) return null;

  if (subscriptions.length === 0) {
    return (
      <section className="mb-12">
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-300">
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            还没有订阅话题
          </h3>
          <p className="text-gray-700 mb-6">
            开始浏览广场中的热门话题，订阅你感兴趣的内容吧！
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">我的订阅</h2>
        {subscriptions.length > 6 && (
          <a
            href="/my-subscriptions"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            查看全部 →
          </a>
        )}
      </div>

      {/* 订阅话题卡片 */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {subscriptions.slice(0, 6).map((sub) => {
          const submitterInfo =
            submitters.find((s) => s.id === sub.topic.sourceId) || null;
          return (
            <TopicCard
              key={sub.topic.id}
              topic={{
                id: sub.topic.id,
                title: sub.topic.title,
                content: sub.topic.content,
                source: sub.topic.source,
                postCount: sub.topic.postCount,
                subscriberCount: sub.topic.subscriberCount,
                publishedAt: sub.topic.publishedAt,
              }}
              isSubscribed={true}
              unreadCount={sub.unreadCount}
              submitter={submitterInfo}
            />
          );
        })}
      </div>
    </section>
  );
}

function TopicsGrid({ topics }: { topics: Topic[]; submitters?: Submitter[] }) {
  const subscribedTopicIds = useSubscribedTopicIds();

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
      {topics.map((topic) => (
        <TopicCard
          key={topic.id}
          topic={topic}
          isSubscribed={subscribedTopicIds.has(topic.id)}
          submitter={topic.submitter}
        />
      ))}
    </div>
  );
}

function HomeContentInner({
  topics,
  submitters,
  isLoggedIn,
  currentPage = 1,
  totalPages = 1,
}: HomeContentInnerProps) {
  return (
    <>
      {/* 我的订阅区域 - Context 驱动，即时响应 */}
      <SubscriptionsList submitters={submitters} isLoggedIn={isLoggedIn} />

      {/* 所有话题区域标题 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">所有话题</h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-[#B2BEC3] hidden sm:block">
            你可提交新话题，另外，每日还会同步自知乎热榜
          </p>
          <CreateTopicButton isLoggedIn={isLoggedIn} />
        </div>
      </div>

      {/* 话题网格 */}
      {topics.length > 0 && (
        <>
          <TopicsGrid topics={topics} />
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </>
      )}

      {topics.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-300">
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">还没有话题</h3>
          <p className="text-gray-700">成为第一个发起讨论的人吧！</p>
        </div>
      )}
    </>
  );
}

export function HomeContent({
  topics,
  rawSubscriptions,
  submitters,
  isLoggedIn,
  currentPage,
  totalPages,
}: HomeContentProps) {
  return (
    <SubscriptionsProvider
      initialSubscriptions={rawSubscriptions.map((sub) => ({
        id: sub.id,
        topic: {
          id: sub.topic.id,
          title: sub.topic.title,
          content: sub.topic.content,
          source: sub.topic.source,
          sourceId: sub.topic.sourceId,
          postCount: sub.topic._count.posts,
          subscriberCount: sub.topic._count.subscriptions,
          publishedAt: sub.topic.publishedAt.toISOString(),
        },
        unreadCount: sub.unreadCount,
        lastVisitAt: sub.lastVisitAt?.toISOString() || null,
        hasNewPosts: sub.unreadCount > 0,
      }))}
    >
      <HomeContentInner
        topics={topics}
        submitters={submitters}
        isLoggedIn={isLoggedIn}
        currentPage={currentPage}
        totalPages={totalPages}
      />
    </SubscriptionsProvider>
  );
}
