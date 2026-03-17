"use client";

import Link from "next/link";

export function LoginButton() {
  return (
    <Link
      href="/api/auth/login"
      className="group relative flex items-center gap-3 px-6 py-3 bg-white border border-[#E8E6E1] rounded-xl font-medium text-[#2D3436] hover:border-[#6C5CE7] hover:shadow-lg transition-all duration-300"
    >
      <span className="relative flex h-6 w-6">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6C5CE7] opacity-20"></span>
        <span className="relative inline-flex rounded-full h-6 w-6 bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE]"></span>
      </span>
      <span>SecondMe 登录</span>
      <svg
        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </Link>
  );
}
