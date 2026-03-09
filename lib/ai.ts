import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface PlanStep {
  step: string;
  difficulty: "easy" | "medium" | "hard";
  cost: string;
  tool?: string;
}

export interface ToolInfo {
  name: string;
  url: string;
  cost: string;
}

export interface AnalysisResult {
  summary: string;
  bizIdea: string;
  plan: PlanStep[];
  tools: ToolInfo[];
  score: number;
  weaknesses: string;
  matchedProjectId?: string;
}

export interface ExistingProject {
  id: string;
  name: string;
  description: string;
}

const SYSTEM_PROMPT = `You are a business analyst AI. You analyze content from tweets and generate actionable business plans.

You MUST respond with valid JSON only, no markdown, no code fences, no explanation. Just the JSON object.

The JSON schema:
{
  "summary": "2-3 sentence summary of what the tweet is about",
  "bizIdea": "One-line business idea extracted from the content",
  "plan": [
    {
      "step": "Description of the step",
      "difficulty": "easy" | "medium" | "hard",
      "cost": "$0" | "$X/mo" | "$X one-time",
      "tool": "optional tool name"
    }
  ],
  "tools": [
    {
      "name": "Tool name",
      "url": "https://...",
      "cost": "Free | $X/mo"
    }
  ],
  "score": 1-10,
  "weaknesses": "What could make this plan better",
  "matchedProjectId": "id or null"
}

Rules:
- Plan steps MUST be ordered from easiest/cheapest first to hardest/most expensive last
- Score honestly: 1-3 = weak idea, 4-6 = decent with work, 7-8 = strong, 9-10 = exceptional
- Be specific with tools and costs — no vague suggestions
- Weaknesses should be actionable (things iteration can actually fix)
- If existing projects are provided, check if this tweet relates to any of them and set matchedProjectId`;

function buildUserPrompt(
  tweetContent: string,
  existingProjects: ExistingProject[],
  previousWeaknesses?: string
): string {
  let prompt = `Analyze this tweet content and generate a business plan:\n\n---\n${tweetContent}\n---\n`;

  if (existingProjects.length > 0) {
    prompt += `\n\nExisting projects to check for matches:\n`;
    for (const p of existingProjects) {
      prompt += `- ID: ${p.id} | Name: ${p.name} | ${p.description}\n`;
    }
  }

  if (previousWeaknesses) {
    prompt += `\n\nPrevious iteration had these weaknesses. Improve the plan to address them:\n${previousWeaknesses}`;
  }

  return prompt;
}

function parseAIResponse(text: string): AnalysisResult {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    summary: String(parsed.summary || ""),
    bizIdea: String(parsed.bizIdea || ""),
    plan: Array.isArray(parsed.plan) ? parsed.plan : [],
    tools: Array.isArray(parsed.tools) ? parsed.tools : [],
    score: Math.min(10, Math.max(1, Number(parsed.score) || 5)),
    weaknesses: String(parsed.weaknesses || ""),
    matchedProjectId: parsed.matchedProjectId || undefined,
  };
}

export async function processTweet(
  tweetContent: string,
  existingProjects: ExistingProject[] = [],
  maxIterations: number = 3
): Promise<AnalysisResult> {
  let result: AnalysisResult | null = null;
  let weaknesses: string | undefined;

  for (let i = 0; i < maxIterations; i++) {
    const userPrompt = buildUserPrompt(tweetContent, existingProjects, weaknesses);

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 2048,
      messages: [
        { role: "user", content: userPrompt },
      ],
      system: SYSTEM_PROMPT,
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    result = parseAIResponse(responseText);

    // If score >= 8, we're satisfied
    if (result.score >= 8) break;

    // Otherwise use weaknesses for next iteration
    weaknesses = result.weaknesses;
  }

  return result!;
}

export async function iteratePlan(
  currentPlan: string,
  feedback: string,
  tweetContent: string
): Promise<AnalysisResult> {
  const userPrompt = `Here is the current business plan:\n\n${currentPlan}\n\nOriginal tweet content:\n${tweetContent}\n\nUser feedback to improve the plan:\n${feedback}\n\nGenerate an improved version of the plan addressing the feedback.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 2048,
    messages: [
      { role: "user", content: userPrompt },
    ],
    system: SYSTEM_PROMPT,
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  return parseAIResponse(responseText);
}
