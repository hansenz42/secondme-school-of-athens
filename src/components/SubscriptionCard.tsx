"use client";

interface SubscriptionCardProps {
  subscription: {
    id: string;
    topic: {
      id: string;
      title: string;
      postCount: number;
    };
    lastVisitAt: string | null;
    hasNewPosts: boolean;
  };
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  return (
    <a
      href={`/topics/${subscription.topic.id}`}
      className="block p-3 rounded-lg hover:bg-gray-100 transition-colors group"
    >
      <div className="flex items-start gap-3">
        {/* 新消息指示 */}
        {subscription.hasNewPosts && (
          <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {subscription.topic.title}
          </h4>
          <p className="text-xs text-gray-700 mt-1">
            {subscription.topic.postCount} 条讨论
          </p>
        </div>
      </div>
    </a>
  );
}
