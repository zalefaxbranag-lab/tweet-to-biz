export interface ScrapedTweet {
  text: string;
  author: string;
  media: string[];
  links: string[];
  articleContent?: string;
}

function normalizeTwitterUrl(url: string): string {
  // Normalize x.com to twitter.com for oEmbed compatibility
  return url.replace(/https?:\/\/(www\.)?x\.com/, "https://twitter.com");
}

function extractLinks(html: string): string[] {
  const linkRegex = /href="(https?:\/\/[^"]+)"/g;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const link = match[1];
    // Skip twitter internal links
    if (!link.includes("twitter.com") && !link.includes("x.com") && !link.includes("t.co")) {
      links.push(link);
    }
  }
  return [...new Set(links)];
}

function extractMediaUrls(html: string): string[] {
  const imgRegex = /src="(https?:\/\/pbs\.twimg\.com\/[^"]+)"/g;
  const media: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    media.push(match[1]);
  }
  return [...new Set(media)];
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchArticleContent(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TweetToBiz/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    // Extract content from common article selectors via simple regex
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const bodyContent = articleMatch?.[1] || mainMatch?.[1] || "";
    if (!bodyContent) return undefined;
    const text = stripHtml(bodyContent);
    // Limit to ~2000 chars for AI context
    return text.slice(0, 2000) || undefined;
  } catch {
    return undefined;
  }
}

export async function scrapeTweet(url: string): Promise<ScrapedTweet> {
  const normalizedUrl = normalizeTwitterUrl(url);

  // Use Twitter oEmbed API
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}&omit_script=true`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(15000) });

  if (!res.ok) {
    throw new Error(`Failed to fetch tweet: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const html: string = data.html || "";
  const authorName: string = data.author_name || "";

  const text = stripHtml(html);
  const links = extractLinks(html);
  const media = extractMediaUrls(html);

  // Try to fetch article content from linked URLs
  let articleContent: string | undefined;
  if (links.length > 0) {
    articleContent = await fetchArticleContent(links[0]);
  }

  return {
    text,
    author: authorName,
    media,
    links,
    articleContent,
  };
}
