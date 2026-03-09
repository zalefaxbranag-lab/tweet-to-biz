import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeTweet } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.tweet.findUnique({ where: { url } });
    if (existing) {
      return NextResponse.json(existing);
    }

    // Scrape the tweet
    const scraped = await scrapeTweet(url);

    const tweet = await prisma.tweet.create({
      data: {
        url,
        content: scraped.text + (scraped.articleContent ? `\n\n---\nLinked article:\n${scraped.articleContent}` : ""),
        author: scraped.author,
        media: JSON.stringify(scraped.media),
        links: JSON.stringify(scraped.links),
        status: "pending",
      },
    });

    return NextResponse.json(tweet);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add tweet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tweets = await prisma.tweet.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        analysis: {
          include: { project: true },
        },
      },
    });

    return NextResponse.json(tweets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch tweets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
