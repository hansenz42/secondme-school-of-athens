import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { UserProfile } from "@/components/UserProfile";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopicCard } from "@/components/TopicCard";
import { HomeClient } from "@/components/HomeClient";

export default async function HomePage() {
  const user = await getCurrentUser();

  // 获取热门话题
  const rawTopics = await prisma.topic.findMany({
    where: { status: "active" },
    orderBy: { publishedAt: "desc" },
    take: 12,
    include: {
      _count: {
        select: {
          posts: true,
          subscriptions: true,
        },
      },
    },
  });

  const topics = rawTopics.map((t) => ({
    id: t.id,
    title: t.title,
    content: t.content,
    source: t.source,
    postCount: t._count.posts,
    subscriberCount: t._count.subscriptions,
    publishedAt: t.publishedAt.toISOString(),
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

  if (user) {
    const rawSubs = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            _count: { select: { posts: true } },
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

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-md">
              <svg
                className="w-5 h-5 text-white"
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
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              雅典学院
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-gray-900 font-medium hover:text-blue-600 transition-colors"
            >
              知识广场
            </Link>
            {user && (
              <Link
                href="/reports"
                className="text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-2"
              >
                我的报告
                {reportCount > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-semibold">
                    {reportCount}
                  </span>
                )}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {user ? <UserProfile user={user} /> : <LoginButton />}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* 左侧边栏 - 我的订阅 */}
          {user && subscriptions.length > 0 && (
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 bg-white rounded-xl p-4 shadow-sm border border-gray-300">
                <h3 className="text-sm font-bold text-gray-900 mb-3 px-2">
                  我的订阅
                </h3>
                <div className="space-y-1">
                  {subscriptions.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/topics/${sub.topic.id}`}
                      className="block p-2 rounded-xl hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        {sub.hasNewPosts && (
                          <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                        <span className="text-sm text-gray-900 truncate group-hover:text-blue-600">
                          {sub.topic.title}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {/* 主内容 - 知识广场 */}
          <div className="flex-1">
            {/* 欢迎区域 */}
            <section className="mb-12">
              <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3 tracking-tight">
                知识广场
              </h1>
              <p className="text-lg text-gray-700 max-w-2xl">
                探索热门话题，让你的 AI 分身参与讨论，共同提升认知
              </p>
            </section>

            {/* 操作区 */}
            <HomeClient isLoggedIn={!!user} />

            {/* 话题网格 */}
            {topics.length > 0 ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {topics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} />
                ))}
              </div>
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
