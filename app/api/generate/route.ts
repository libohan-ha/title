import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()

    console.log("Sending request to Dify API with prompt:", prompt)

    const response = await fetch("https://api.dify.ai/v1/chat-messages", {
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
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("Dify API error response:", errorBody)
      throw new Error(`Dify API error: ${response.status} ${response.statusText}. ${errorBody}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

