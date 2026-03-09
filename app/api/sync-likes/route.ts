import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchLikes } from "@/lib/likes-scraper";

export async function POST() {
  try {
    const likes = await fetchLikes(20);

    const results = {
      fetched: likes.length,
      newTweets: 0,
      skipped: 0,
      processing: [] as string[],
    };

    for (const like of likes) {
      // Skip if already in DB
      const existing = await prisma.tweet.findUnique({
        where: { url: like.url },
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      // Create tweet record
      const tweet = await prisma.tweet.create({
        data: {
          url: like.url,
          content: like.text,
          author: like.authorHandle,
          media: "[]",
          links: "[]",
          status: "pending",
        },
      });

      results.newTweets++;
      results.processing.push(tweet.id);

      // Auto-trigger processing (fire and forget)
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetId: tweet.id }),
      }).catch(() => {
        // ignore - will be picked up on retry
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync likes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
