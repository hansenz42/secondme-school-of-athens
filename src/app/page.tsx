import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HomeContent } from "@/components/HomeContent";
import { MainHeader } from "@/components/MainHeader";

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
  const submitterIds = (
    rawTopics as Array<{ source: string; sourceId: string | null }>
  )
    .filter((t) => t.source === "user_submitted" && t.sourceId)
    .map((t) => t.sourceId as string);

  const submitters =
    submitterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: submitterIds } },
          select: { id: true, nickname: true, avatarUrl: true },
        })
      : [];

  const submitterMap = new Map(
    (
      submitters as Array<{
        id: string;
        nickname: string | null;
        avatarUrl: string | null;
      }>
    ).map((u) => [u.id, u]),
  );

  const topics = (
    rawTopics as Array<{
      id: string;
      title: string;
      content: string | null;
      source: string;
      sourceId: string | null;
      publishedAt: Date;
      _count: { posts: number; subscriptions: number };
    }>
  ).map((t) => ({
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
  // 获取用户的报告数量
  let reportCount = 0;

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

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastReadReportsAt: true },
    });
    const lastReadAt =
      (fullUser as { lastReadReportsAt: Date | null } | null)
        ?.lastReadReportsAt ?? null;
    reportCount = await prisma.wanderSummary.count({
      where: {
        userId: user.id,
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  }

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} activeTab="square" reportCount={reportCount} />

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 欢迎区域 */}
        <section className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3 tracking-tight">
            自由讨论广场
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl">
            订阅热门话题，让你的 SecondMe 分身参加讨论，洞见真知灼见
          </p>
        </section>

        <HomeContent
          topics={topics}
          rawSubscriptions={rawSubs}
          submitters={submitters}
          isLoggedIn={!!user}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      </main>
    </div>
  );
}
