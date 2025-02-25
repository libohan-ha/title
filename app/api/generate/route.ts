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
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()

    console.log("Sending request to Dify API with prompt:", prompt)

    // 创建流式响应
    const encoder = new TextEncoder();

    // 创建流式响应对象
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 调用Dify API，使用流式模式
          const response = await fetch("https://api.dify.ai/v1/chat-messages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: {},
              query: prompt,
              response_mode: "streaming", // 使用streaming模式
              conversation_id: "",
              user: "user-" + Math.random().toString(36).substr(2, 9),
            }),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Dify API error: ${response.status} ${response.statusText}. ${errorBody}`);
          }

          // 检查我们是否收到了流
          if (!response.body) {
            throw new Error("No response body from Dify API");
          }

          const reader = response.body.getReader();
          let combinedText = "";

          // 处理流数据
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 将buffer转换为文本
            const chunk = new TextDecoder().decode(value);
            
            // Dify API返回的是NDJSON，每行是一个JSON对象
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                
                // 检查是否有文本内容或错误
                if (data.event === 'message') {
                  // 存储完整文本以便后续处理
                  combinedText += data.answer || data.text || "";
                  
                  // 发送到客户端的实时更新
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    type: 'chunk', 
                    content: data.answer || data.text || "" 
                  }) + '\n'));
                } else if (data.event === 'error') {
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    type: 'error', 
                    error: data.error || "Unknown error" 
                  }) + '\n'));
                }
              } catch (e) {
                console.error("Error parsing JSON from stream:", e, line);
              }
            }
          }

          // 发送完成事件和最终文本
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'done', 
            content: combinedText 
          }) + '\n'));
        } catch (error: any) {
          console.error("Streaming error:", error);
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'error', 
            error: error.message || "Unknown error" 
          }) + '\n'));
        } finally {
          // 关闭流
          controller.close();
        }
      }
    });

    // 返回流式响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error: any) {
    console.error("API route error:", error);
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}

