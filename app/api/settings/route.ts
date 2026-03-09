import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const apiKey = await prisma.setting.findUnique({
      where: { key: "ANTHROPIC_API_KEY" },
    });

    return NextResponse.json({
      hasApiKey: !!(apiKey?.value || process.env.ANTHROPIC_API_KEY),
      source: apiKey?.value ? "db" : process.env.ANTHROPIC_API_KEY ? "env" : "none",
    });
  } catch {
    return NextResponse.json({ hasApiKey: false, source: "none" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey || !apiKey.startsWith("sk-ant-")) {
      return NextResponse.json(
        { error: "Invalid API key format. Must start with sk-ant-" },
        { status: 400 }
      );
    }

    // Quick validation - try a minimal API call
    const testRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 5,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (!testRes.ok) {
      const err = await testRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `API key validation failed: ${err.error?.message || testRes.statusText}` },
        { status: 400 }
      );
    }

    // Save to DB
    await prisma.setting.upsert({
      where: { key: "ANTHROPIC_API_KEY" },
      update: { value: apiKey },
      create: { key: "ANTHROPIC_API_KEY", value: apiKey },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
