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
          let buffer = ""; // 用于存储不完整的行

          // 处理流数据
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 将buffer转换为文本并添加到之前的buffer
            buffer += new TextDecoder().decode(value);
            
            // 按行分割，保留最后一个可能不完整的行
            const lines = buffer.split('\n');
            buffer = lines.pop() || ""; // 保存最后一行到buffer，如果是空行则使用空字符串
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue; // 跳过空行
              
              if (trimmedLine === 'event: ping') continue; // 忽略ping事件
              
              // 只处理data字段
              if (trimmedLine.startsWith('data: ')) {
                try {
                  // 提取data后面的JSON内容
                  const jsonStr = trimmedLine.slice(6); // 去掉'data: '前缀
                  const data = JSON.parse(jsonStr);
                  
                  // 检查所有可能包含内容的字段
                  let content = null;
                  
                  // 如果是消息事件
                  if (data.event === 'message') {
                    content = data.answer || data.text || data.message || data.content;
                  }
                  // 如果是直接的回答内容
                  else if (data.answer || data.text || data.message || data.content) {
                    content = data.answer || data.text || data.message || data.content;
                  }
                  
                  if (content) {
                    // 存储完整文本以便后续处理
                    combinedText += content;
                    
                    // 发送到客户端的实时更新
                    controller.enqueue(encoder.encode(JSON.stringify({ 
                      type: 'chunk', 
                      content: content 
                    }) + '\n'));
                  }

                  // 检查是否有错误
                  if (data.error) {
                    throw new Error(data.error);
                  }
                } catch (e) {
                  console.error("Error parsing JSON from stream:", e);
                  // 继续处理下一行，不中断流
                }
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

