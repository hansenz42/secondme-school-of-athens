"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

interface Subscription {
  id: string;
  topic: {
    id: string;
    title: string;
    content: string | null;
    source: string;
    sourceId: string | null;
    postCount: number;
    subscriberCount: number;
    publishedAt: string;
  };
  unreadCount: number;
  lastVisitAt: string | null;
  hasNewPosts: boolean;
}

interface SubscriptionsContextType {
  subscriptions: Subscription[];
  subscribe: (
    topicId: string,
    topic: {
      id: string;
      title: string;
      content: string | null;
      source: string;
      sourceId: string | null;
      postCount: number;
      subscriberCount: number;
      publishedAt: string;
    },
  ) => void;
  unsubscribe: (topicId: string) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  isSubscribed: (topicId: string) => boolean;
}

const SubscriptionsContext = createContext<
  SubscriptionsContextType | undefined
>(undefined);

const SUBSCRIPTIONS_KEY = "secondme_subscriptions_sync";

export function SubscriptionsProvider({
  children,
  initialSubscriptions = [],
}: {
  children: React.ReactNode;
  initialSubscriptions?: Subscription[];
}) {
  const [subscriptions, setSubscriptions] =
    useState<Subscription[]>(initialSubscriptions);

  // 监听跨标签页的订阅更新
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SUBSCRIPTIONS_KEY && event.newValue) {
        try {
          const newSubscriptions = JSON.parse(event.newValue);
          setSubscriptions(newSubscriptions);
        } catch (error) {
          console.error("Failed to parse subscriptions from storage:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const subscribe = useCallback(
    (
      topicId: string,
      topic: {
        id: string;
        title: string;
        content: string | null;
        source: string;
        sourceId: string | null;
        postCount: number;
        subscriberCount: number;
        publishedAt: string;
      },
    ) => {
      setSubscriptions((prev) => {
        // 避免重复订阅
        if (prev.some((s) => s.topic.id === topicId)) {
          return prev;
        }
        const newSubscriptions = [
          {
            id: `sub-${topicId}`,
            topic,
            unreadCount: 0,
            lastVisitAt: null,
            hasNewPosts: false,
          },
          ...prev,
        ];

        // 同步到 localStorage，用于跨标签页通信
        try {
          localStorage.setItem(
            SUBSCRIPTIONS_KEY,
            JSON.stringify(newSubscriptions),
          );
        } catch (error) {
          console.error("Failed to save subscriptions to storage:", error);
        }

        return newSubscriptions;
      });
    },
    [],
  );

  const unsubscribe = useCallback((topicId: string) => {
    setSubscriptions((prev) => {
      const newSubscriptions = prev.filter((s) => s.topic.id !== topicId);

      // 同步到 localStorage
      try {
        localStorage.setItem(
          SUBSCRIPTIONS_KEY,
          JSON.stringify(newSubscriptions),
        );
      } catch (error) {
        console.error("Failed to save subscriptions to storage:", error);
      }

      return newSubscriptions;
    });
  }, []);

  const isSubscribed = useCallback(
    (topicId: string) => subscriptions.some((s) => s.topic.id === topicId),
    [subscriptions],
  );

  return (
    <SubscriptionsContext.Provider
      value={{
        subscriptions,
        subscribe,
        unsubscribe,
        setSubscriptions,
        isSubscribed,
      }}
    >
      {children}
    </SubscriptionsContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext);
  if (context === undefined) {
    throw new Error(
      "useSubscriptions must be used within a SubscriptionsProvider",
    );
  }
  return context;
}

export function useSubscribedTopicIds() {
  const { subscriptions } = useSubscriptions();
  return new Set(subscriptions.map((s) => s.topic.id));
}
