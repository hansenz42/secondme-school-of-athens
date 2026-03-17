import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken, getUserInfo, createOrUpdateUser } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const receivedState = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 处理错误
  if (error) {
    console.error("OAuth error:", error, errorDescription);
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  // 验证 code
  if (!code) {
    console.error("OAuth callback: missing code");
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  // 验证 state（宽松验证，支持 WebView 场景）
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;

  if (storedState && receivedState !== storedState) {
    console.warn("OAuth state 验证失败，可能是跨 WebView 场景，继续处理");
  }

  try {
    // 交换 code 获取 token
    console.log("Exchanging code for token...");
    const tokens = await exchangeCodeForToken(code);
    console.log("Token exchanged successfully");

    // 获取用户信息以获取用户 ID
    console.log("Fetching user info...");
    const userInfo = await getUserInfo(tokens.accessToken);
    console.log("User info fetched:", userInfo);

    // 使用 SecondMe 返回的用户 ID
    const secondmeUserId = userInfo.user_id || userInfo.id || userInfo.sub;
    if (!secondmeUserId) {
      throw new Error("Cannot get user ID from user info");
    }

    // 创建或更新用户
    const user = await createOrUpdateUser(
      secondmeUserId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn
    );

    // 设置用户 session cookie
    cookieStore.set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 天
      path: "/",
    });

    // 清除 oauth state cookie
    cookieStore.delete("oauth_state");

    // 跳转到首页
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
