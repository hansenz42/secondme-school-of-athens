import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { TopicClient } from "./TopicClient";

interface PageProps {
  params: Promise<{ topicId: string }>;
}

export default async function TopicPage({ params }: PageProps) {
  const { topicId } = await params;
  const user = await getCurrentUser();

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      posts: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  nickname: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      _count: {
        select: {
          posts: true,
          subscriptions: true,
        },
      },
    },
  });

  if (!topic) {
    notFound();
  }

  // 检查用户是否已订阅
  let isSubscribed = false;
  if (user) {
    const subscription = await prisma.subscription.findUnique({
      where: {
        userId_topicId: {
          userId: user.id,
          topicId,
        },
      },
    });
    isSubscribed = !!subscription;
  }

  const serializedTopic = {
    id: topic.id,
    title: topic.title,
    content: topic.content,
    source: topic.source,
    sourceUrl: topic.sourceUrl,
    publishedAt: topic.publishedAt.toISOString(),
    postCount: topic._count.posts,
    subscriberCount: topic._count.subscriptions,
  };

  const serializedPosts = topic.posts.map((post) => ({
    id: post.id,
    content: post.content,
    authorType: post.authorType,
    author: {
      id: post.author.id,
      nickname: post.author.nickname,
      avatarUrl: post.author.avatarUrl,
    },
    createdAt: post.createdAt.toISOString(),
    replies: post.replies.map((reply) => ({
      id: reply.id,
      content: reply.content,
      authorType: reply.authorType,
      author: {
        id: reply.author.id,
        nickname: reply.author.nickname,
        avatarUrl: reply.author.avatarUrl,
      },
      createdAt: reply.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            返回知识广场
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 话题信息 */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#E8E6E1] mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    topic.source === "zhihu"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {topic.source === "zhihu" ? "知乎热议" : "用户提交"}
                </span>
                <span className="text-xs text-[#B2BEC3]">
                  {new Date(topic.publishedAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#2D3436]">
                {topic.title}
              </h1>
            </div>
          </div>

          {topic.content && (
            <p className="text-[#636E72] mb-6">{topic.content}</p>
          )}

          <div className="flex items-center gap-6 text-sm text-[#B2BEC3]">
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              <span>{serializedTopic.postCount} 条讨论</span>
            </div>
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span>{serializedTopic.subscriberCount} 人订阅</span>
            </div>
            {topic.sourceUrl && (
              <a
                href={topic.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6C5CE7] hover:underline"
              >
                查看原文
              </a>
            )}
          </div>
        </div>

        {/* 客户端交互组件 */}
        <TopicClient
          topicId={topicId}
          isLoggedIn={!!user}
          isSubscribed={isSubscribed}
          initialPosts={serializedPosts}
          currentUserId={user?.id}
        />
      </main>
    </div>
  );
}
