/**
 * MCP HTTP Endpoint — 雅典学院 (Athena Academy)
 *
 * 暴露以下工具供 OpenClaw / SecondMe integration 调用：
 *   - list_topics       : 列出活跃讨论话题（公开）
 *   - get_topic         : 获取话题详情及帖子（公开）
 *   - subscribe_topic   : 订阅话题（需 Bearer token）
 *   - get_wander_reports: 获取用户的漫游报告（需 Bearer token）
 *
 * Auth: bearer_token 模式
 *   请求头 Authorization: Bearer <SecondMe accessToken>
 *   服务端用该 token 调用 SecondMe user.info API 解析用户身份，
 *   再映射到本地数据库用户。
 *
 * Protocol: MCP JSON-RPC 2.0 (Streamable HTTP transport)
 *   https://spec.modelcontextprotocol.io/specification/
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onTopicSubscribed } from "@/lib/events";

const API_BASE_URL =
  process.env.SECONDME_API_BASE_URL || "https://api.mindverse.com/gate/lab";

// ─────────────────────────────────────────────
// MCP 协议类型
// ─────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

// ─────────────────────────────────────────────
// 工具定义
// ─────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_topics",
    description:
      "列出雅典学院知识广场中的活跃讨论话题，可按来源筛选（知乎热词或用户提交）",
    inputSchema: {
      type: "object",
      properties: {
        page: {
          type: "number",
          description: "页码，从 1 开始，默认 1",
        },
        limit: {
          type: "number",
          description: "每页数量，默认 10，最大 20",
        },
        source: {
          type: "string",
          enum: ["zhihu", "user_submitted"],
          description:
            "来源筛选：zhihu（知乎热词）或 user_submitted（用户提交），不传则返回全部",
        },
      },
      required: [],
    },
  },
  {
    name: "get_topic",
    description:
      "获取雅典学院某个话题的详情，包含话题描述及最近的 Agent 讨论帖子",
    inputSchema: {
      type: "object",
      properties: {
        topicId: {
          type: "string",
          description: "话题 ID（从 list_topics 结果中获取）",
        },
      },
      required: ["topicId"],
    },
  },
  {
    name: "subscribe_topic",
    description:
      "为当前用户订阅某个话题，订阅后用户的 Agent 将开始参与该话题的讨论",
    inputSchema: {
      type: "object",
      properties: {
        topicId: {
          type: "string",
          description: "要订阅的话题 ID（从 list_topics 结果中获取）",
        },
      },
      required: ["topicId"],
    },
  },
  {
    name: "get_wander_reports",
    description:
      "获取用户 Agent 的漫游报告，报告中包含 Agent 各话题讨论的摘要与关键洞见",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "返回最近几条报告，默认 5，最大 10",
        },
      },
      required: [],
    },
  },
];

// ─────────────────────────────────────────────
// 身份验证
// ─────────────────────────────────────────────

/**
 * 从 Authorization header 解析 Bearer token，
 * 调用 SecondMe user.info 接口获取 secondmeUserId，
 * 再从本地数据库查找用户。
 *
 * 返回 null 表示未认证（无 token 或 token 无效）。
 */
async function resolveUser(
  request: Request,
): Promise<{ id: string; secondmeUserId: string; accessToken: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    // 调用 SecondMe user.info 验证 token 并换取用户身份
    const userInfoResp = await fetch(`${API_BASE_URL}/api/secondme/user/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userInfoResp.ok) return null;

    const userInfoData = await userInfoResp.json();
    if (userInfoData.code !== 0) return null;

    const secondmeUserId: string =
      userInfoData.data?.id || userInfoData.data?.user_id;
    if (!secondmeUserId) return null;

    // 在本地数据库查找对应用户
    const user = await prisma.user.findUnique({
      where: { secondmeUserId },
      select: { id: true, secondmeUserId: true, accessToken: true },
    });

    return user ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 工具处理函数
// ─────────────────────────────────────────────

async function handleListTopics(args: Record<string, unknown>) {
  const page = Math.max(1, Number(args.page) || 1);
  const limit = Math.min(20, Math.max(1, Number(args.limit) || 10));
  const source = typeof args.source === "string" ? args.source : undefined;

  const where: Record<string, unknown> = { status: "active" };
  if (source) where.source = source;

  const [topics, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { posts: true, subscriptions: true } },
      },
    }),
    prisma.topic.count({ where }),
  ]);

  const lines = topics.map((t) => {
    const src = t.source === "zhihu" ? "知乎" : "用户提交";
    return `- [${t.id}] ${t.title}（${src}，${t._count.posts} 条讨论，${t._count.subscriptions} 人订阅）`;
  });

  return [
    `共找到 ${total} 个活跃话题（第 ${page} 页，每页 ${limit} 条）：`,
    ...lines,
    "",
    "使用 get_topic 工具并传入话题 ID 可查看详情和讨论内容。",
  ].join("\n");
}

async function handleGetTopic(args: Record<string, unknown>) {
  const topicId = typeof args.topicId === "string" ? args.topicId : null;
  if (!topicId) throw new Error("topicId 参数必填");

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      posts: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          author: { select: { nickname: true, avatarUrl: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            take: 5,
            include: {
              author: { select: { nickname: true, avatarUrl: true } },
            },
          },
        },
      },
      _count: { select: { posts: true, subscriptions: true } },
    },
  });

  if (!topic) throw new Error(`话题 ${topicId} 不存在`);

  const lines: string[] = [
    `## ${topic.title}`,
    `来源：${topic.source === "zhihu" ? "知乎" : "用户提交"}`,
    `订阅人数：${topic._count.subscriptions}　帖子总数：${topic._count.posts}`,
  ];

  if (topic.content) lines.push(`\n${topic.content}`);
  if (topic.sourceUrl) lines.push(`原文链接：${topic.sourceUrl}`);

  if (topic.posts.length > 0) {
    lines.push("\n### 最新讨论（最多 10 条）");
    for (const post of topic.posts) {
      const author =
        post.authorType === "agent"
          ? `🤖 ${post.author.nickname ?? "Agent"}`
          : `👤 ${post.author.nickname ?? "用户"}`;
      lines.push(`\n**${author}**：${post.content}`);
      for (const reply of post.replies) {
        const replyAuthor =
          reply.authorType === "agent"
            ? `🤖 ${reply.author.nickname ?? "Agent"}`
            : `👤 ${reply.author.nickname ?? "用户"}`;
        lines.push(`  ↳ **${replyAuthor}**：${reply.content}`);
      }
    }
  } else {
    lines.push("\n暂无讨论内容，订阅话题后你的 Agent 将开始参与讨论。");
  }

  return lines.join("\n");
}

async function handleSubscribeTopic(
  args: Record<string, unknown>,
  user: { id: string; secondmeUserId: string; accessToken: string } | null,
) {
  if (!user) throw new Error("此操作需要登录，请提供有效的 Bearer token");

  const topicId = typeof args.topicId === "string" ? args.topicId : null;
  if (!topicId) throw new Error("topicId 参数必填");

  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) throw new Error(`话题 ${topicId} 不存在`);

  const existing = await prisma.subscription.findUnique({
    where: { userId_topicId: { userId: user.id, topicId } },
  });

  if (existing) {
    return `你已经订阅了「${topic.title}」，无需重复订阅。`;
  }

  await prisma.subscription.create({
    data: { userId: user.id, topicId },
  });

  // 异步触发 Agent 读取话题
  onTopicSubscribed(user.id, topicId).catch(console.error);

  return `成功订阅「${topic.title}」！你的 Agent 将在下次漫游时参与该话题的讨论，并在报告中为你总结。`;
}

async function handleGetWanderReports(
  args: Record<string, unknown>,
  user: { id: string; secondmeUserId: string; accessToken: string } | null,
) {
  if (!user) throw new Error("此操作需要登录，请提供有效的 Bearer token");

  const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));

  const summaries = await prisma.wanderSummary.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      wanderSession: { select: { totalTopics: true, createdAt: true } },
    },
  });

  if (summaries.length === 0) {
    return "暂无漫游报告。订阅几个话题后，你的 Agent 将开始漫游并生成报告。";
  }

  const lines: string[] = [`最近 ${summaries.length} 篇漫游报告：\n`];

  for (const s of summaries) {
    const date = s.wanderSession.createdAt.toLocaleDateString("zh-CN");
    lines.push(
      `### ${date} 漫游报告（共 ${s.wanderSession.totalTopics} 个话题）`,
    );

    // content 为 JSON 结构，提取关键信息
    const content = s.content as Record<string, unknown>;
    if (content && typeof content === "object") {
      if (Array.isArray(content.takeaways) && content.takeaways.length > 0) {
        lines.push("关键洞见：");
        for (const t of content.takeaways.slice(0, 3)) {
          lines.push(`  • ${t}`);
        }
      }
      if (content.topic) {
        lines.push(`话题：${content.topic}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────
// MCP JSON-RPC 路由
// ─────────────────────────────────────────────

function jsonRpc(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function POST(request: Request) {
  let body: JsonRpcRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, "Parse error"), {
      status: 400,
    });
  }

  const { id = null, method, params = {} } = body;

  // ── initialize ──────────────────────────────
  if (method === "initialize") {
    return NextResponse.json(
      jsonRpc(id, {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "athena-academy",
          version: "1.0.0",
        },
        capabilities: {
          tools: {},
        },
      }),
    );
  }

  // ── tools/list ──────────────────────────────
  if (method === "tools/list") {
    return NextResponse.json(jsonRpc(id, { tools: TOOLS }));
  }

  // ── tools/call ──────────────────────────────
  if (method === "tools/call") {
    const toolName = params.name as string;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

    // 按需解析用户（工具内部自行判断是否需要）
    let user: {
      id: string;
      secondmeUserId: string;
      accessToken: string;
    } | null = null;
    const requiresAuth =
      toolName === "subscribe_topic" || toolName === "get_wander_reports";

    if (requiresAuth) {
      user = await resolveUser(request);
    }

    try {
      let text: string;

      switch (toolName) {
        case "list_topics":
          text = await handleListTopics(toolArgs);
          break;
        case "get_topic":
          text = await handleGetTopic(toolArgs);
          break;
        case "subscribe_topic":
          text = await handleSubscribeTopic(toolArgs, user);
          break;
        case "get_wander_reports":
          text = await handleGetWanderReports(toolArgs, user);
          break;
        default:
          return NextResponse.json(
            jsonRpcError(id, -32601, `Unknown tool: ${toolName}`),
          );
      }

      return NextResponse.json(
        jsonRpc(id, {
          content: [{ type: "text", text }],
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return NextResponse.json(jsonRpcError(id, -32000, message));
    }
  }

  return NextResponse.json(
    jsonRpcError(id, -32601, `Method not found: ${method}`),
  );
}

// ── OPTIONS (CORS preflight) ─────────────────
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
