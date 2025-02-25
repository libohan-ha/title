"use client"

import type React from "react"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function TitleGenerator() {
  const [prompt, setPrompt] = useState("")
  const [generatedTitle, setGeneratedTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setGeneratedTitle("")

    if (!prompt.trim()) {
      setError("Please enter your requirements")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setGeneratedTitle(data.answer)
    } catch (error) {
      console.error("Submit error:", error)
      setError(`Failed to generate title: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsLoading(false)
    }
  }

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
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Generating..." : "Generate Title"}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <p>{error}</p>
            </div>
          )}

          {generatedTitle && !error && (
            <div className="mt-8 space-y-2">
              <h2 className="text-lg font-semibold">Generated Title:</h2>
              <div className="p-4 rounded-lg bg-muted">
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

