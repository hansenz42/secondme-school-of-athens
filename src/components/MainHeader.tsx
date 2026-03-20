import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { UserProfile } from "@/components/UserProfile";
import { prisma } from "@/lib/prisma";

const GITHUB_REPO = "hansenz42/secondme-school-of-athens";
const BLOG_URL = "https://www.assen.top";

function formatStarCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(count);
}

interface MainHeaderUser {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  secondmeUserId: string;
  lastViewedFollowersAt?: Date | null;
}

interface MainHeaderProps {
  user: MainHeaderUser | null;
  activeTab: "square" | "reports";
  reportCount?: number;
}

export async function MainHeader({
  user,
  activeTab,
  reportCount = 0,
}: MainHeaderProps) {
  // 查询新关注者数量（关注我且在上次查看之后新增的）
  // 同时获取 GitHub star 数
  let newFollowerCount = 0;
  let starCount: number | null = null;

  const githubFetch = fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: 3600 }, // 1小时缓存
  })
    .then((r) => r.json())
    .then((d) => {
      if (typeof d?.stargazers_count === "number") {
        starCount = d.stargazers_count;
      }
    })
    .catch(() => {}); // 失败静默降级

  if (user) {
    const lastViewedAt = user.lastViewedFollowersAt ?? null;
    const [followerCount] = await Promise.all([
      prisma.friend.count({
        where: {
          friendId: user.id,
          ...(lastViewedAt ? { createdAt: { gt: lastViewedAt } } : {}),
        },
      }),
      githubFetch,
    ]);
    newFollowerCount = followerCount;
  } else {
    await githubFetch;
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-linear-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-md">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 顶部：代表知识殿堂的经典三角屋顶 */}
              <path d="M12 3L3 10h18z" />

              {/* 中部：四根象征学术基石的学院立柱 */}
              <path d="M6 10v8m4-8v8m4-8v8m4-8v8" />

              {/* 底部：两层坚实的学院基座台阶 */}
              <path d="M4 18h16M2 21h20" />
            </svg>
          </div>
          <span className="hidden sm:inline text-lg font-bold text-gray-900 tracking-tight">
            雅典学院
          </span>
        </Link>

        {/* Tab 导航 */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors pb-0.5 ${
              activeTab === "square"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
            }`}
          >
            自由话题广场
          </Link>
          {user && (
            <Link
              href="/reports"
              className={`text-sm font-medium transition-colors pb-0.5 flex items-center gap-2 ${
                activeTab === "reports"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
              }`}
            >
              启发报告
              {reportCount > 0 && (
                <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                  {reportCount}
                </span>
              )}
            </Link>
          )}
        </nav>

        {/* 用户区域 */}
        <div className="flex items-center gap-3">
          {/* 博客链接 */}
          <a
            href={BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
            <span className="inline">开发者博客</span>
          </a>

          {/* GitHub Star 徽章 - 桌面端 */}
          <a
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-stretch rounded-md border border-gray-200 overflow-hidden text-xs font-semibold hover:border-gray-400 transition-colors"
          >
            {/* 左格：GitHub 图标 + Star */}
            <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Star
            </span>
            {/* 右格：star 数量 */}
            <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-700">
              <svg
                className="w-3 h-3 fill-yellow-400 stroke-yellow-500"
                viewBox="0 0 16 16"
                strokeWidth={1}
              >
                <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.873 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
              </svg>
              {starCount !== null ? formatStarCount(starCount) : "—"}
            </span>
          </a>

          {/* GitHub 图标 - 移动端 */}
          <a
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:hidden flex items-center text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>

          {user ? (
            <UserProfile user={user} newFollowerCount={newFollowerCount} />
          ) : (
            <LoginButton />
          )}
        </div>
      </div>

      {/* 移动端 Tab 栏（仅在 md 以下显示） */}
      <div className="flex md:hidden items-center gap-1 px-4 pb-2 border-t border-gray-100">
        <Link
          href="/"
          className={`flex-1 text-center text-sm font-medium rounded-full px-4 py-1.5 transition-colors ${
            activeTab === "square"
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          自由话题广场
        </Link>
        {user && (
          <Link
            href="/reports"
            className={`flex-1 text-center text-sm font-medium rounded-full px-4 py-1.5 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "reports"
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            启发报告
            {reportCount > 0 && (
              <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold leading-none">
                {reportCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
