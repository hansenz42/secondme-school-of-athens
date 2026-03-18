import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ReportCard } from "./ReportCard";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/login");
  }

  const reports = await prisma.report.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      topic: {
        select: {
          id: true,
          title: true,
          source: true,
        },
      },
    },
  });

  const serializedReports = reports.map((r) => ({
    id: r.id,
    topic: r.topic,
    content: r.content as {
      topic: string;
      viewpoints: Array<{ source: string; content: string }>;
      differences: string[];
      takeaways: string[];
    },
    status: r.status,
    syncedAt: r.syncedAt?.toISOString() || null,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
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
            返回知识广场
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2D3436] mb-2">我的报告</h1>
          <p className="text-[#636E72]">
            你的 AI 分身为你整理的知识洞见，帮助你更新认知
          </p>
        </div>

        {/* 报告列表 */}
        {serializedReports.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-[#E8E6E1]">
            <div className="w-16 h-16 rounded-full bg-[#F8F9FA] flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-[#B2BEC3]"
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
            <h3 className="text-lg font-medium text-[#2D3436] mb-2">
              还没有报告
            </h3>
            <p className="text-[#636E72] mb-6">
              订阅知识广场中的话题，你的 AI 分身会为你生成洞察报告
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-[#6C5CE7] text-white rounded-xl font-medium hover:bg-[#5B4AD6] transition-colors"
            >
              浏览知识广场
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {serializedReports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
