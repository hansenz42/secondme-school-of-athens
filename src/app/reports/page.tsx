import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ReportCard } from "./ReportCard";
import { MainHeader } from "@/components/MainHeader";
import { ReportsCountdown } from "@/components/ReportsCountdown";
import { MarkReportsRead } from "@/components/MarkReportsRead";
import type { WanderSummaryContent } from "@/lib/agent";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/login");
  }

  const [summaries, fullUser, friendRecords] = await Promise.all([
    prisma.wanderSummary.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        wanderSession: {
          select: {
            totalTopics: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { lastReadReportsAt: true },
    }),
    prisma.friend.findMany({
      where: { userId: user.id },
      select: { friendId: true },
    }),
  ]);

  // 未读报告数：lastReadReportsAt 之后生成的报告
  const lastRead =
    (fullUser as { lastReadReportsAt: Date | null } | null)
      ?.lastReadReportsAt ?? null;
  const summaryCount = lastRead
    ? summaries.filter(
        (s) =>
          (s as { createdAt: Date }).createdAt.getTime() > lastRead.getTime(),
      ).length
    : summaries.length;

  // 查询当前用户已接受的启发，按 summaryId 聚合
  const accepted = await prisma.acceptedInsight.findMany({
    where: { userId: user.id },
    select: { summaryId: true, topicId: true, insightIndex: true },
  });
  // key 格式: "${summaryId}:${topicId}_${insightIndex}"
  const acceptedSet = new Set(
    (
      accepted as Array<{
        summaryId: string;
        topicId: string;
        insightIndex: number;
      }>
    ).map((a) => `${a.summaryId}:${a.topicId}_${a.insightIndex}`),
  );

  const friendIds = (friendRecords as Array<{ friendId: string }>).map(
    (f) => f.friendId,
  );

  const serializedSummaries = (
    summaries as Array<{
      id: string;
      sessionId: string;
      content: unknown;
      createdAt: Date;
      wanderSession: { totalTopics: number; createdAt: Date };
    }>
  ).map((s) => ({
    id: s.id,
    sessionId: s.sessionId,
    content: s.content as WanderSummaryContent,
    totalTopics: s.wanderSession.totalTopics,
    wanderedAt: s.wanderSession.createdAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-white">
      <MainHeader user={user} activeTab="reports" reportCount={summaryCount} />
      <MarkReportsRead />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 标题区域 */}
        <section className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-3 tracking-tight">
            启发报告
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl">
            你的 SecondMe
            分身结束漫游后，都会给你提交一份启发报告，如果你感兴趣，你可以加入到
            SecondMe 知识库中。
          </p>
          <ReportsCountdown
            lastWanderedAt={serializedSummaries[0]?.wanderedAt ?? null}
          />
        </section>

        {/* 报告列表 */}
        {serializedSummaries.length === 0 ? (
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">还没有报告</h3>
            <p className="text-gray-700 mb-6">
              订阅话题后，等待下次 SecondMe 漫游完成，即可在此查看认知总结报告
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              去知识广场订阅话题
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {serializedSummaries.map(
              (summary: (typeof serializedSummaries)[number]) => (
                <ReportCard
                  key={summary.id}
                  summary={summary}
                  initialAccepted={
                    new Set(
                      [...acceptedSet]
                        .filter((k) => k.startsWith(`${summary.id}:`))
                        .map((k) => k.slice(summary.id.length + 1)),
                    )
                  }
                  friendIds={friendIds}
                />
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
}
