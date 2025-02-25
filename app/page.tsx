"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AlertCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"

export default function TitleGenerator() {
  const [prompt, setPrompt] = useState("")
  const [generatedTitle, setGeneratedTitle] = useState("")
  const [streamingTitle, setStreamingTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  
  // 用于保存响应控制器的引用，以便在需要时中止请求
  const abortControllerRef = useRef<AbortController | null>(null);

  // 如果组件卸载时正在进行API请求，中止请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setGeneratedTitle("")
    setStreamingTitle("")

    if (!prompt.trim()) {
      setError("请输入您的需求")
      return
    }

    setIsLoading(true)
    setIsStreaming(true)
    
    // 如果有正在进行的请求，先中止它
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedTitle = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 将读取的字节解码为文本
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'chunk') {
              // 接收到一部分内容
              accumulatedTitle += data.content;
              setStreamingTitle(accumulatedTitle);
            } else if (data.type === 'done') {
              // 流结束，处理完整内容
              setGeneratedTitle(data.content);
              setIsStreaming(false);
            } else if (data.type === 'error') {
              // 处理错误
              throw new Error(data.error);
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("Request was aborted");
        setError("请求已取消");
      } else {
        console.error("Submit error:", error);
        setError(`生成标题失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }

  // 取消正在进行的请求
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsStreaming(false);
      setError("生成已取消");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>AI Title Generator</CardTitle>
          <CardDescription>Enter your requirements and let AI generate a title for you</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your title requirements..."
                disabled={isLoading}
                required
              />
            </div>
            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "生成中..." : "生成标题"}
              </Button>
              {isStreaming && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleCancel}
                >
                  取消
                </Button>
              )}
            </div>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <p>{error}</p>
            </div>
          )}

          {(streamingTitle || generatedTitle) && !error && (
            <div className="mt-8 space-y-2">
              <h2 className="text-lg font-semibold">生成的标题:</h2>
              <div className="p-4 rounded-lg bg-muted">
                {isStreaming && (
                  <div className="relative">
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-2" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mb-2" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-lg font-medium mb-2" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
                        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                      }}
                    >
                      {streamingTitle}
                    </ReactMarkdown>
                    <div className="absolute bottom-0 right-0 p-1 bg-muted">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                    </div>
                  </div>
                )}
                
                {!isStreaming && generatedTitle && (
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-2" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mb-2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-lg font-medium mb-2" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-2" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
                      li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    }}
                  >
                    {generatedTitle}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

