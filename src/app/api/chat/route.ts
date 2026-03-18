import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 发送消息到聊天室
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 }
      );
    }

    const { roomId, content } = await request.json();

    if (!roomId || !content) {
      return NextResponse.json(
        { code: 400, message: "缺少必要参数", data: null },
        { status: 400 }
      );
    }

    // 检查用户是否是房间参与者
    const participant = await prisma.roomParticipant.findUnique({
      where: {
        userId_roomId: {
          userId: user.id,
          roomId,
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { code: 403, message: "不是房间成员", data: null },
        { status: 403 }
      );
    }

    // 创建用户消息
    const message = await prisma.message.create({
      data: {
        content,
        sender: "user",
        userId: user.id,
        roomId,
      },
    });

    // 调用 SecondMe Chat API 让 Agent 回复（SSE 流式接口）
    const chatResponse = await fetch(
      `${process.env.SECONDME_API_BASE_URL}/api/secondme/chat/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.accessToken}`,
          "X-App-Id": process.env.SECONDME_CLIENT_ID || "general",
        },
        body: JSON.stringify({
          message: content,
          sessionId: roomId,
        }),
      }
    );

    let agentReply = "";
    if (chatResponse.ok) {
      const responseText = await chatResponse.text();
      for (const line of responseText.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) agentReply += delta;
        } catch {
          // ignore non-JSON lines (e.g. session event)
        }
      }
    }

    if (!agentReply) {
      agentReply = "抱歉，我现在无法回复你。";
    }

    // 保存 Agent 回复
    const agentMessage = await prisma.message.create({
      data: {
        content: agentReply,
        sender: "agent",
        roomId,
      },
    });

    return NextResponse.json({
      code: 0,
      data: {
        userMessage: message,
        agentMessage,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { code: 500, message: "服务器错误", data: null },
      { status: 500 }
    );
  }
}

// 获取聊天室消息历史
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { code: 401, message: "未登录", data: null },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json(
        { code: 400, message: "缺少 roomId 参数", data: null },
        { status: 400 }
      );
    }

    // 检查用户是否是房间参与者
    const participant = await prisma.roomParticipant.findUnique({
      where: {
        userId_roomId: {
          userId: user.id,
          roomId,
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { code: 403, message: "不是房间成员", data: null },
        { status: 403 }
      );
    }

    // 获取消息历史
    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      code: 0,
      data: messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { code: 500, message: "服务器错误", data: null },
      { status: 500 }
    );
  }
}
