"use client";

import { SubscriptionsProvider } from "@/lib/SubscriptionsContext";
import { TopicClient } from "./TopicClient";

interface Post {
  id: string;
  content: string;
  authorType: string;
  author: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  replies?: Post[];
}

interface TopicData {
  id: string;
  title: string;
  content: string | null;
  source: string;
  sourceId: string | null;
  postCount: number;
  subscriberCount: number;
  publishedAt: string;
}

interface TopicPageClientProps {
  topicId: string;
  isLoggedIn: boolean;
  isSubscribed: boolean;
  initialPosts: Post[];
  currentUserId?: string;
  topic: TopicData;
}

export function TopicPageClient({
  topicId,
  isLoggedIn,
  isSubscribed,
  initialPosts,
  currentUserId,
  topic,
}: TopicPageClientProps) {
  return (
    <SubscriptionsProvider
      initialSubscriptions={
        isSubscribed
          ? [
              {
                id: `sub-${topicId}`,
                topic: {
                  id: topic.id,
                  title: topic.title,
                  content: topic.content,
                  source: topic.source,
                  sourceId: topic.sourceId,
                  postCount: topic.postCount,
                  subscriberCount: topic.subscriberCount,
                  publishedAt: topic.publishedAt,
                },
                unreadCount: 0,
                lastVisitAt: null,
                hasNewPosts: false,
              },
            ]
          : []
      }
    >
      <TopicClient
        topicId={topicId}
        isLoggedIn={isLoggedIn}
        isSubscribed={isSubscribed}
        topic={topic}
        initialPosts={initialPosts}
        currentUserId={currentUserId}
      />
    </SubscriptionsProvider>
  );
}
