import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopicCard } from "@/components/TopicCard";
import { MainHeader } from "@/components/MainHeader";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 12;

export default async function MySubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/login");
  }

  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  // 获取用户的报告数量
  const reportCount = await prisma.report.count({
    where: { userId: user.id },
  });

  // 并行查询订阅总数和分页数据
  const [totalSubscriptions, rawSubscriptions] = await Promise.all([
    prisma.subscription.count({ where: { userId: user.id } }),
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        topic: {
          include: {
            _count: {
              select: {
                posts: true,
                subscriptions: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalSubscriptions / PAGE_SIZE);

  // 批量查询用户提交话题的提交者信息
  const submitterIds = rawSubscriptions
    .filter((s) => s.topic.source === "user_submitted" && s.topic.sourceId)
    .map((s) => s.topic.sourceId as string);

  const submitters =
    submitterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, nickname: true, avatarUrl: true },
        })
      : [];

  const submitterMap = new Map(submitters.map((u) => [u.id, u]));

  // 构建话题卡片数据
  const subscriptionTopics = rawSubscriptions.map((sub) => ({
    id: sub.topic.id,
    title: sub.topic.title,
    content: sub.topic.content,
    source: sub.topic.source,
    postCount: sub.topic._count.posts,
    subscriberCount: sub.topic._count.subscriptions,
    publishedAt: sub.topic.publishedAt.toISOString(),
    submitter:
      sub.topic.source === "user_submitted" && sub.topic.sourceId
        ? (submitterMap.get(sub.topic.sourceId) ?? null)
        : null,
  }));

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} activeTab="square" reportCount={reportCount} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 返回按钮 */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-8"
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          返回广场
        </Link>

        {/* 标题区域 */}
        <section className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3 tracking-tight">
            我的订阅
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl">
            {totalSubscriptions > 0
              ? `你已订阅 ${totalSubscriptions} 个话题`
              : "还没有订阅任何话题"}
          </p>
        </section>

        {/* 订阅列表 */}
        {subscriptionTopics.length > 0 ? (
          <>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {subscriptionTopics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  isSubscribed={true}
                  submitter={topic.submitter}
                />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              baseHref="/my-subscriptions"
            />
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
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
            >
              浏览广场
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
