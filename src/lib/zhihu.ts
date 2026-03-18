/**
 * 知乎开放 API 集成
 *
 * 使用 HMAC-SHA256 签名方式进行认证
 * 文档参考: zhihu-open skill
 */

import crypto from "crypto";

const ZHIHU_API_BASE = "https://openapi.zhihu.com/openapi";

// 生成签名
function generateSignature(
  appKey: string,
  appSecret: string,
  timestamp: number,
  logId: string,
): string {
  const signString = `app_key:${appKey}|ts:${timestamp}|logid:${logId}|extra_info:`;
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(signString);
  return hmac.digest("base64");
}

// 生成 Log ID
function generateLogId(): string {
  const timestamp = Date.now().toString();
  const hash = crypto
    .createHash("md5")
    .update(timestamp + Math.random().toString())
    .digest("hex");
  return `log_${hash.slice(0, 16)}`;
}

// 构建请求头
function buildHeaders(
  appKey: string,
  appSecret: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const logId = generateLogId();
  const signature = generateSignature(appKey, appSecret, timestamp, logId);

  return {
    "X-App-Key": appKey,
    "X-Timestamp": timestamp.toString(),
    "X-Log-Id": logId,
    "X-Sign": signature,
    "Content-Type": "application/json",
  };
}

export interface ZhihuTopic {
  id: string;
  title: string;
  content?: string;
  url?: string;
}

/**
 * 获取知乎热门话题
 *
 * 注意：知乎开放 API 可能没有直接的热门话题接口
 * 这里预留接口，实际使用时可能需要调整
 */
export async function fetchHotTopics(
  limit: number = 10,
): Promise<ZhihuTopic[]> {
  const appKey = process.env.ZHIHU_APP_KEY;
  const appSecret = process.env.ZHIHU_APP_SECRET;

  if (!appKey || !appSecret) {
    console.warn("知乎 API 凭证未配置，返回模拟数据");
    return getMockTopics(limit);
  }

  try {
    // 注意：这里需要确认知乎是否有热门话题获取接口
    // 如果没有，则使用模拟数据
    const headers = buildHeaders(appKey, appSecret);

    // TODO: 确认实际的热门话题 API 端点
    // const response = await fetch(`${ZHIHU_API_BASE}/hot/topics?limit=${limit}`, {
    //   method: 'GET',
    //   headers,
    // });

    // 暂时返回模拟数据
    return getMockTopics(limit);
  } catch (error) {
    console.error("获取知乎热门话题失败:", error);
    return getMockTopics(limit);
  }
}

// 模拟热门话题数据
function getMockTopics(limit: number): ZhihuTopic[] {
  const mockTopics: ZhihuTopic[] = [
    {
      id: "zhihu_1",
      title: "人工智能会取代人类的哪些工作？",
      content:
        "随着 AI 技术的快速发展，许多人开始担忧自己的职业前景。你认为哪些工作最容易被 AI 取代？",
      url: "https://www.zhihu.com/question/mock1",
    },
    {
      id: "zhihu_2",
      title: "如何评价当前的教育内卷现象？",
      content:
        "从幼儿园到大学，竞争似乎永无止境。这种现象的根源是什么？有解决方案吗？",
      url: "https://www.zhihu.com/question/mock2",
    },
    {
      id: "zhihu_3",
      title: "年轻人应该追求稳定还是追求梦想？",
      content: "在经济不确定的时代，是选择铁饭碗还是冒险创业？",
      url: "https://www.zhihu.com/question/mock3",
    },
    {
      id: "zhihu_4",
      title: "为什么越来越多的人选择独居？",
      content: "独居已成为一种生活方式，这反映了什么社会变化？",
      url: "https://www.zhihu.com/question/mock4",
    },
    {
      id: "zhihu_5",
      title: "如何看待「躺平」文化的兴起？",
      content: "躺平是消极逃避还是一种自我保护？",
      url: "https://www.zhihu.com/question/mock5",
    },
    {
      id: "zhihu_6",
      title: "元宇宙是否只是一个概念泡沫？",
      content: "元宇宙的未来究竟在哪里？是真正的技术革命还是资本炒作？",
      url: "https://www.zhihu.com/question/mock6",
    },
    {
      id: "zhihu_7",
      title: "读书真的能改变命运吗？",
      content: "在学历贬值的今天，读书的意义是什么？",
      url: "https://www.zhihu.com/question/mock7",
    },
    {
      id: "zhihu_8",
      title: "如何建立高质量的人际关系？",
      content: "在快节奏的社会中，真正的友谊变得稀缺。如何找到志同道合的朋友？",
      url: "https://www.zhihu.com/question/mock8",
    },
    {
      id: "zhihu_9",
      title: "远程办公会成为未来的主流吗？",
      content: "疫情改变了我们的工作方式，远程办公的利弊是什么？",
      url: "https://www.zhihu.com/question/mock9",
    },
    {
      id: "zhihu_10",
      title: "如何在信息过载的时代保持专注？",
      content:
        "手机、社交媒体、短视频……我们的注意力正在被碎片化。如何找回专注力？",
      url: "https://www.zhihu.com/question/mock10",
    },
  ];

  // 随机打乱顺序，模拟每天不同的热门话题
  const shuffled = mockTopics.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

/**
 * 在知乎圈子发布内容
 */
export async function publishToZhihu(
  title: string,
  content: string,
  ringId: string,
): Promise<{ success: boolean; contentToken?: string; error?: string }> {
  const appKey = process.env.ZHIHU_APP_KEY;
  const appSecret = process.env.ZHIHU_APP_SECRET;

  if (!appKey || !appSecret) {
    return { success: false, error: "知乎 API 凭证未配置" };
  }

  try {
    const headers = buildHeaders(appKey, appSecret);

    const response = await fetch(`${ZHIHU_API_BASE}/publish/pin`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        content,
        ring_id: ringId,
      }),
    });

    const result = await response.json();

    if (result.status === 0) {
      return { success: true, contentToken: result.data.content_token };
    } else {
      return { success: false, error: result.msg };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * 创建评论
 */
export async function createComment(
  contentToken: string,
  contentType: "pin" | "comment",
  content: string,
): Promise<{ success: boolean; commentToken?: string; error?: string }> {
  const appKey = process.env.ZHIHU_APP_KEY;
  const appSecret = process.env.ZHIHU_APP_SECRET;

  if (!appKey || !appSecret) {
    return { success: false, error: "知乎 API 凭证未配置" };
  }

  try {
    const headers = buildHeaders(appKey, appSecret);

    const response = await fetch(`${ZHIHU_API_BASE}/comment/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content_token: contentToken,
        content_type: contentType,
        content,
      }),
    });

    const result = await response.json();

    if (result.code === 0 || result.status === 0) {
      return { success: true, commentToken: result.data?.comment_token };
    } else {
      return { success: false, error: result.msg };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
