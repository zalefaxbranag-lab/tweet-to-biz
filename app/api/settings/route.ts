import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const apiKey = await prisma.setting.findUnique({
      where: { key: "GROQ_API_KEY" },
    });

    return NextResponse.json({
      hasApiKey: !!(apiKey?.value || process.env.GROQ_API_KEY),
      source: apiKey?.value ? "db" : process.env.GROQ_API_KEY ? "env" : "none",
    });
  } catch {
    return NextResponse.json({ hasApiKey: false, source: "none" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey || !apiKey.startsWith("gsk_")) {
      return NextResponse.json(
        { error: "Invalid key format. Groq keys start with gsk_" },
        { status: 400 }
      );
    }

    // Quick validation — try a minimal API call
    const testRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (!testRes.ok) {
      const err = await testRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Key validation failed: ${err.error?.message || testRes.statusText}` },
        { status: 400 }
      );
    }

    // Save to DB
    await prisma.setting.upsert({
      where: { key: "GROQ_API_KEY" },
      update: { value: apiKey },
      create: { key: "GROQ_API_KEY", value: apiKey },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
