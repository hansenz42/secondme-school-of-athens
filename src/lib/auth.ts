import { cookies } from "next/headers";
import { prisma } from "./prisma";

// SecondMe OAuth 配置
const SECONDME_CLIENT_ID = process.env.SECONDME_CLIENT_ID!;
const SECONDME_REDIRECT_URI = process.env.SECONDME_REDIRECT_URI!;
const SECONDME_OAUTH_URL = process.env.SECONDME_OAUTH_URL!;

// 生成 OAuth 授权 URL
export function generateAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: SECONDME_CLIENT_ID,
    redirect_uri: SECONDME_REDIRECT_URI,
    response_type: "code",
    scope: "user.info user.info.shades chat",
    state,
  });

  return `${SECONDME_OAUTH_URL}?${params.toString()}`;
}

// 交换 Authorization Code 获取 Token
export async function exchangeCodeForToken(code: string) {
  const response = await fetch(process.env.SECONDME_TOKEN_ENDPOINT!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: SECONDME_CLIENT_ID,
      client_secret: process.env.SECONDME_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: SECONDME_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || "Failed to exchange code for token");
  }

  return {
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    expiresIn: data.data.expiresIn,
  };
}

// 刷新 Access Token
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(process.env.SECONDME_REFRESH_ENDPOINT!, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: SECONDME_CLIENT_ID,
      client_secret: process.env.SECONDME_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || "Failed to refresh token");
  }

  return {
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    expiresIn: data.data.expiresIn,
  };
}

// 获取用户信息
export async function getUserInfo(accessToken: string) {
  const response = await fetch(`${process.env.SECONDME_API_BASE_URL}/api/secondme/user/info`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || "Failed to get user info");
  }

  return data.data;
}

// 获取用户兴趣标签
export async function getUserShades(accessToken: string) {
  const response = await fetch(`${process.env.SECONDME_API_BASE_URL}/api/secondme/user/shades`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || "Failed to get user shades");
  }

  return data.data;
}

// 创建或更新用户
export async function createOrUpdateUser(
  secondmeUserId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  // 先尝试获取用户信息
  const userInfo = await getUserInfo(accessToken);

  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  return prisma.user.upsert({
    where: { secondmeUserId },
    create: {
      secondmeUserId,
      nickname: userInfo.name || userInfo.nickname || null,
      avatarUrl: userInfo.avatar || userInfo.avatar_url || null,
      email: userInfo.email || null,
      accessToken,
      refreshToken,
      tokenExpiresAt,
    },
    update: {
      nickname: userInfo.name || userInfo.nickname || null,
      avatarUrl: userInfo.avatar || userInfo.avatar_url || null,
      email: userInfo.email || null,
      accessToken,
      refreshToken,
      tokenExpiresAt,
    },
  });
}

// 获取当前登录用户
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  // 检查 token 是否过期，如果过期则刷新
  if (user.tokenExpiresAt < new Date()) {
    try {
      const newTokens = await refreshAccessToken(user.refreshToken);
      const tokenExpiresAt = new Date(Date.now() + newTokens.expiresIn * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          tokenExpiresAt,
        },
      });

      return {
        ...user,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenExpiresAt,
      };
    } catch (error) {
      // 刷新失败，返回 null 让用户重新登录
      return null;
    }
  }

  return user;
}

// 生成随机 state
export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
