import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { UserProfile } from "@/components/UserProfile";

interface MainHeaderUser {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  secondmeUserId: string;
}

interface MainHeaderProps {
  user: MainHeaderUser | null;
  activeTab: "square" | "reports";
  reportCount?: number;
}

export function MainHeader({
  user,
  activeTab,
  reportCount = 0,
}: MainHeaderProps) {
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
          <span className="text-lg font-bold text-gray-900 tracking-tight">
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
            自由讨论广场
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
        <div className="flex items-center gap-4">
          {user ? <UserProfile user={user} /> : <LoginButton />}
        </div>
      </div>
    </header>
  );
}
