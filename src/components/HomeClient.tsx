"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateTopicModal } from "./CreateTopicModal";

interface HomeClientProps {
  isLoggedIn: boolean;
}

export function HomeClient({ isLoggedIn }: HomeClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const handleCreated = () => {
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-8">
        {isLoggedIn ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 shadow-sm"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            提交话题
          </button>
        ) : (
          <a
            href="/api/auth/login"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 shadow-sm"
          >
            登录后提交话题
          </a>
        )}

        <div className="flex-1" />

        <div className="text-sm text-[#B2BEC3]">
          话题更新自用户提交，与知乎每日热议同步
        </div>
      </div>

      <CreateTopicModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
