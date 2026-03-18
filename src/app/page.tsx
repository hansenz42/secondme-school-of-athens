import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopicCard } from "@/components/TopicCard";
import { HomeClient } from "@/components/HomeClient";
import { MainHeader } from "@/components/MainHeader";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 12;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const user = await getCurrentUser();

  // 并行查询总数和分页话题
  const [totalTopics, rawTopics] = await Promise.all([
    prisma.topic.count({ where: { status: "active" } }),
    prisma.topic.findMany({
      where: { status: "active" },
      orderBy: { publishedAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: {
          select: {
            posts: true,
            subscriptions: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalTopics / PAGE_SIZE);

  // 批量查询用户提交话题的提交者信息
  const submitterIds = rawTopics
    .filter((t) => t.source === "user_submitted" && t.sourceId)
    .map((t) => t.sourceId as string);

  const submitters =
    submitterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, nickname: true, avatarUrl: true },
        })
      : [];

  const submitterMap = new Map(submitters.map((u) => [u.id, u]));

  const topics = rawTopics.map((t) => ({
    id: t.id,
    title: t.title,
    content: t.content,
    source: t.source,
    postCount: t._count.posts,
    subscriberCount: t._count.subscriptions,
    publishedAt: t.publishedAt.toISOString(),
    submitter:
      t.source === "user_submitted" && t.sourceId
        ? (submitterMap.get(t.sourceId) ?? null)
        : null,
  }));

  // 如果登录了，获取用户的订阅
  let subscriptions: Array<{
    id: string;
    topic: { id: string; title: string; postCount: number };
    lastVisitAt: string | null;
    hasNewPosts: boolean;
  }> = [];

  // 获取用户的报告数量
  let reportCount = 0;

  interface RawSubscription {
    id: string;
    userId: string;
    topicId: string;
    createdAt: Date;
    lastVisitAt: Date | null;
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

  let rawSubs: RawSubscription[] = [];

  if (user) {
    rawSubs = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            content: true,
            source: true,
            sourceId: true,
            publishedAt: true,
            _count: { select: { posts: true, subscriptions: true } },
          },
        },
      },
    });

    subscriptions = rawSubs.map((s) => ({
      id: s.id,
      topic: {
        id: s.topic.id,
        title: s.topic.title,
        postCount: s.topic._count.posts,
      },
      lastVisitAt: s.lastVisitAt?.toISOString() || null,
      hasNewPosts: false, // TODO: 计算是否有新帖子
    }));

    reportCount = await prisma.report.count({
      where: { userId: user.id },
    });
  }

  const subscribedTopicIds = new Set(subscriptions.map((s) => s.topic.id));

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} activeTab="square" reportCount={reportCount} />

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div>
          {/* 自由讨论广场 */}
          <div>
            {/* 欢迎区域 */}
            <section className="mb-12">
              <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3 tracking-tight">
                自由讨论广场
              </h1>
              <p className="text-lg text-gray-700 max-w-2xl">
                订阅热门话题，让你的 SecondMe 分身参加讨论，洞见真知灼见
              </p>
            </section>

            {/* 操作区 */}
            <HomeClient isLoggedIn={!!user} />

            {/* 我的订阅区域 */}
            {user && subscriptions.length > 0 && (
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
                  {rawSubs.slice(0, 6).map((sub) => {
                    const submitterInfo =
                      sub.topic.source === "user_submitted" &&
                      sub.topic.sourceId
                        ? submitters.find((s) => s.id === sub.topic.sourceId) ||
                          null
                        : null;
                    return (
                      <TopicCard
                        key={sub.topic.id}
                        topic={{
                          id: sub.topic.id,
                          title: sub.topic.title,
                          content: sub.topic.content,
                          source: sub.topic.source,
                          postCount: sub.topic._count.posts,
                          subscriberCount: sub.topic._count.subscriptions,
                          publishedAt: sub.topic.publishedAt.toISOString(),
                        }}
                        isSubscribed={true}
                        submitter={submitterInfo}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* "我的订阅"空状态 */}
            {user && subscriptions.length === 0 && (
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
            )}

            {/* 所有话题区域标题 */}
            <h2 className="text-2xl font-bold text-gray-900 mb-6">所有话题</h2>

            {/* 话题网格 */}
            {topics.length > 0 ? (
              <>
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
                <Pagination currentPage={currentPage} totalPages={totalPages} />
              </>
            ) : (
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
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  还没有话题
                </h3>
                <p className="text-gray-700">成为第一个发起讨论的人吧！</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
