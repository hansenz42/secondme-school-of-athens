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
              我的报告
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
