"use client";

import { useEffect, useState } from "react";

const WANDER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 小时（与 wander cron 一致）

interface ReportsCountdownProps {
  /** 上次 wander session 的时间（ISO string），没有报告时为 null */
  lastWanderedAt: string | null;
  /** 用户账号创建时间（ISO string），作为首次倒计时的起点 */
  userCreatedAt: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

function computeNextWanderAt(
  lastWanderedAt: string | null,
  userCreatedAt: string,
): Date {
  const baseTime = lastWanderedAt
    ? new Date(lastWanderedAt).getTime()
    : new Date(userCreatedAt).getTime();
  const candidate = new Date(baseTime + WANDER_INTERVAL_MS);
  // 若预估时间已过且已有过报告，则从现在重新计算 6 小时
  if (candidate.getTime() <= Date.now() && lastWanderedAt) {
    return new Date(Date.now() + WANDER_INTERVAL_MS);
  }
  return candidate;
}

export function ReportsCountdown({
  lastWanderedAt,
  userCreatedAt,
}: ReportsCountdownProps) {
  const [remaining, setRemaining] = useState<number>(() => {
    const nextAt = computeNextWanderAt(lastWanderedAt, userCreatedAt);
    return Math.max(0, nextAt.getTime() - Date.now());
  });

  useEffect(() => {
    const nextAt = computeNextWanderAt(lastWanderedAt, userCreatedAt);

    const tick = () => {
      const diff = nextAt.getTime() - Date.now();
      if (diff <= 0) {
        // 到期后重置为 6 小时重新倒计时
        setRemaining(WANDER_INTERVAL_MS);
      } else {
        setRemaining(diff);
      }
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastWanderedAt, userCreatedAt]);

  const isExpired = remaining >= WANDER_INTERVAL_MS - 1000;

  return (
    <div className="flex items-center gap-3 mt-4 mb-2">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
        <svg
          className="w-4 h-4 text-gray-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 6v6l4 2" />
        </svg>
        <span className="text-sm text-gray-500">下次漫游预计在</span>
        <span className="font-mono text-sm font-semibold text-gray-800 tabular-nums">
          {formatDuration(remaining)}
        </span>
        <span className="text-sm text-gray-500">后</span>
        {isExpired && (
          <span className="text-xs text-orange-500 font-medium ml-1">
            （正在生成报告）
          </span>
        )}
      </div>
    </div>
  );
}
