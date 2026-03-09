import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processTweet } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { tweetId } = await req.json();

    if (!tweetId) {
      return NextResponse.json({ error: "tweetId is required" }, { status: 400 });
    }

    const tweet = await prisma.tweet.findUnique({ where: { id: tweetId } });
    if (!tweet) {
      return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
    }

    // Mark as processing
    await prisma.tweet.update({
      where: { id: tweetId },
      data: { status: "processing" },
    });

    // Get existing projects for matching
    const existingProjects = await prisma.project.findMany({
      select: { id: true, name: true, description: true },
    });

    // Run AI pipeline
    const result = await processTweet(tweet.content, existingProjects);

    // Create or match project
    let projectId = result.matchedProjectId || undefined;

    // Verify matched project exists
    if (projectId) {
      const existing = await prisma.project.findUnique({ where: { id: projectId } });
      if (!existing) projectId = undefined;
    }

    // Create new project if no match
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
    }

    // Save analysis
    const analysis = await prisma.analysis.create({
      data: {
        tweetId,
        summary: result.summary,
        bizIdea: result.bizIdea,
        plan: JSON.stringify(result.plan),
        tools: JSON.stringify(result.tools),
        score: result.score,
        weaknesses: result.weaknesses,
        projectId,
      },
    });

    // Mark tweet as done
    await prisma.tweet.update({
      where: { id: tweetId },
      data: { status: "done" },
    });

    return NextResponse.json({
      analysis,
      projectId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";

    // Try to mark tweet as failed
    try {
      const { tweetId } = await req.json().catch(() => ({ tweetId: null }));
      if (tweetId) {
        await prisma.tweet.update({
          where: { id: tweetId },
          data: { status: "failed", error: message },
        });
      }
    } catch {
      // ignore cleanup errors
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
