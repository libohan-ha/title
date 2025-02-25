import { NextResponse } from "next/server";

// 添加超时控制帮助函数
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
  const controller = new AbortController();
  const { signal } = controller;
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()

    console.log("Sending request to Dify API with prompt:", prompt)

    // 使用添加了超时控制的fetch
    const response = await fetchWithTimeout(
      "https://api.dify.ai/v1/chat-messages", 
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {},
          query: prompt,
          response_mode: "blocking", // Changed to blocking mode for simplicity
          conversation_id: "",
          user: "user-" + Math.random().toString(36).substr(2, 9),
        }),
      },
      290000 // 290秒超时，略小于Vercel的函数超时设置(300秒)
    )

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("Dify API error response:", errorBody)
      throw new Error(`Dify API error: ${response.status} ${response.statusText}. ${errorBody}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("API route error:", error)
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: "请求超时，请稍后再试" }, { status: 504 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

