"use client";

import { useState } from "react";
import Link from "next/link";

interface ReportContent {
  topic: string;
  viewpoints: Array<{ source: string; content: string }>;
  differences: string[];
  takeaways: string[];
}

interface ReportCardProps {
  report: {
    id: string;
    topic: {
      id: string;
      title: string;
      source: string;
    };
    content: ReportContent;
    status: string;
    syncedAt: string | null;
    updatedAt: string;
  };
}

export function ReportCard({ report }: ReportCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [synced, setSynced] = useState(report.status === "synced");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`/api/reports/${report.id}/sync`, {
        method: "POST",
      });
      const result = await response.json();
      if (result.code === 0) {
        setSynced(true);
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E8E6E1] overflow-hidden">
      {/* 头部 */}
      <div className="p-6 border-b border-[#E8E6E1]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  report.topic.source === "zhihu"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {report.topic.source === "zhihu" ? "知乎热议" : "用户话题"}
              </span>
              <span className="text-xs text-[#B2BEC3]">
                更新于 {new Date(report.updatedAt).toLocaleString("zh-CN")}
              </span>
              {synced && (
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                  已同步
                </span>
              )}
            </div>
            <Link
              href={`/topics/${report.topic.id}`}
              className="text-xl font-bold text-[#2D3436] hover:text-[#6C5CE7] transition-colors"
            >
              {report.topic.title}
            </Link>
          </div>

          {!synced && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-[#6C5CE7] text-white rounded-xl text-sm font-medium hover:bg-[#5B4AD6] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isSyncing ? "同步中..." : "整合到 SecondMe"}
            </button>
          )}
        </div>
      </div>

      {/* 内容预览/详情 */}
      <div className="p-6">
        {/* 关键收获 */}
        {report.content.takeaways && report.content.takeaways.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-[#2D3436] mb-3 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[#6C5CE7]"
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
              关键收获
            </h4>
            <ul className="space-y-2">
              {report.content.takeaways
                .slice(0, isExpanded ? undefined : 3)
                .map((takeaway, i) => (
                  <li key={i} className="flex items-start gap-2 text-[#636E72]">
                    <span className="text-[#6C5CE7] mt-1">•</span>
                    <span>{takeaway}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* 观点差异 */}
        {report.content.differences &&
          report.content.differences.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-[#2D3436] mb-3 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-orange-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                观点差异
              </h4>
              <ul className="space-y-2">
                {report.content.differences
                  .slice(0, isExpanded ? undefined : 2)
                  .map((diff, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[#636E72]"
                    >
                      <span className="text-orange-500 mt-1">△</span>
                      <span>{diff}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

        {/* 展开/收起 */}
        {(report.content.takeaways?.length > 3 ||
          report.content.differences?.length > 2 ||
          report.content.viewpoints?.length > 0) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-[#6C5CE7] hover:underline"
          >
            {isExpanded ? "收起详情" : "查看更多详情"}
          </button>
        )}

        {/* 展开后显示观点来源 */}
        {isExpanded &&
          report.content.viewpoints &&
          report.content.viewpoints.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#E8E6E1]">
              <h4 className="text-sm font-semibold text-[#2D3436] mb-3">
                观点来源
              </h4>
              <div className="space-y-3">
                {report.content.viewpoints.map((vp, i) => (
                  <div key={i} className="p-4 bg-[#F8F9FA] rounded-xl">
                    <div className="text-xs text-[#B2BEC3] mb-1">
                      {vp.source}
                    </div>
                    <p className="text-sm text-[#636E72]">{vp.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
