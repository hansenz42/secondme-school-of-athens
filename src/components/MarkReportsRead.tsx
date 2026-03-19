"use client";

import { useEffect } from "react";

/**
 * 用户访问 Reports 页面时自动标记报告为已读。
 * 调用 POST /api/reports/mark-read，后台静默执行，不影响 UI。
 */
export function MarkReportsRead() {
  useEffect(() => {
    fetch("/api/reports/mark-read", { method: "POST" }).catch(() => {
      // 静默失败，不影响用户体验
    });
  }, []);

  return null;
}
