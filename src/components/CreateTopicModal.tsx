"use client";

import { useState } from "react";

interface CreateTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTopicModal({
  isOpen,
  onClose,
  onCreated,
}: CreateTopicModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      const result = await response.json();

      if (result.code !== 0) {
        setError(result.message);
        return;
      }

      setTitle("");
      setContent("");
      onCreated();
      onClose();
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-xl p-8 w-full max-w-lg shadow-xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">提交新话题</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              话题标题 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入一个有深度的话题..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 transition-colors"
              required
              minLength={5}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              话题描述（可选）
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="详细描述这个话题的背景和讨论方向..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-900 hover:bg-gray-100 font-semibold transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "提交中..." : "提交话题"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-600 text-center">
          每天只能提交一个话题，请谨慎选择
        </p>
      </div>
    </div>
  );
}
