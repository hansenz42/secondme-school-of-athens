"use client";

export function LoginButton() {
  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <button
      onClick={handleLogin}
      className="group relative flex items-center gap-3 px-4 py-2 bg-white border border-[#E8E6E1] rounded-xl font-medium text-[#2D3436] hover:border-[#6C5CE7] hover:shadow-lg transition-all duration-300"
    >
      <span className="relative flex h-6 w-6">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6C5CE7] opacity-20"></span>
        <span className="relative inline-flex rounded-full h-6 w-6 bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE]"></span>
      </span>
      <span>SecondMe 登录</span>
    </button>
  );
}
