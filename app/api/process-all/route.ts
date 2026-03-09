import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processTweet } from "@/lib/ai";

export const maxDuration = 300; // 5 min for Vercel

export async function POST() {
  try {
    const pendingTweets = await prisma.tweet.findMany({
      where: { status: { in: ["pending", "failed"] } },
      orderBy: { createdAt: "asc" },
    });

    if (pendingTweets.length === 0) {
      return NextResponse.json({ message: "No pending tweets", processed: 0 });
    }

    const existingProjects = await prisma.project.findMany({
      select: { id: true, name: true, description: true },
    });

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const tweet of pendingTweets) {
      try {
        await prisma.tweet.update({
          where: { id: tweet.id },
          data: { status: "processing" },
        });

        const result = await processTweet(tweet.content, existingProjects);

        let projectId = result.matchedProjectId || undefined;
        if (projectId) {
          const existing = await prisma.project.findUnique({ where: { id: projectId } });
          if (!existing) projectId = undefined;
        }

        if (!projectId) {
          const project = await prisma.project.create({
            data: {
              name: result.bizIdea,
              description: result.summary,
              plan: JSON.stringify(result.plan),
              score: result.score,
            },
          });
          projectId = project.id;
          // Add to existing projects for future matching
          existingProjects.push({
            id: project.id,
            name: result.bizIdea,
            description: result.summary,
          });
        }

        await prisma.analysis.create({
          data: {
            tweetId: tweet.id,
            summary: result.summary,
            bizIdea: result.bizIdea,
            plan: JSON.stringify(result.plan),
            tools: JSON.stringify(result.tools),
            score: result.score,
            weaknesses: result.weaknesses,
            projectId,
          },
        });

        await prisma.tweet.update({
          where: { id: tweet.id },
          data: { status: "done" },
        });

        processed++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${tweet.author}: ${msg}`);
        await prisma.tweet.update({
          where: { id: tweet.id },
          data: { status: "failed", error: msg },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ processed, failed, total: pendingTweets.length, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
