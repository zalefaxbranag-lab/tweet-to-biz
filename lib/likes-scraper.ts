const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const FEATURES = JSON.stringify({
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_featured: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
});

export interface LikedTweet {
  id: string;
  url: string;
  text: string;
  author: string;
  authorHandle: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
}

function extractTweetFromResult(result: Record<string, unknown>): LikedTweet | null {
  try {
    // Handle TweetWithVisibilityResults wrapper
    let tweetResult = result;
    if (result.__typename === "TweetWithVisibilityResults") {
      tweetResult = result.tweet as Record<string, unknown>;
    }
    if (!tweetResult || tweetResult.__typename !== "Tweet") return null;

    const legacy = tweetResult.legacy as Record<string, unknown>;
    const core = tweetResult.core as Record<string, unknown>;
    const userResults = (core?.user_results as Record<string, unknown>)?.result as Record<string, unknown>;
    const userLegacy = userResults?.legacy as Record<string, unknown>;
    const userCore = userResults?.core as Record<string, unknown>;

    // Get full text: prefer note_tweet for long tweets
    const noteTweet = tweetResult.note_tweet as Record<string, unknown> | undefined;
    let text = String(legacy?.full_text || "");
    if (noteTweet) {
      const noteResults = (noteTweet.note_tweet_results as Record<string, unknown>)?.result as Record<string, unknown>;
      if (noteResults?.text) {
        text = String(noteResults.text);
      }
    }

    const screenName = String(userCore?.screen_name || userLegacy?.screen_name || "");
    const tweetId = String(legacy?.id_str || tweetResult.rest_id || "");

    return {
      id: tweetId,
      url: `https://x.com/${screenName}/status/${tweetId}`,
      text,
      author: String(userCore?.name || userLegacy?.name || ""),
      authorHandle: screenName,
      createdAt: String(legacy?.created_at || ""),
      likeCount: Number(legacy?.favorite_count || 0),
      retweetCount: Number(legacy?.retweet_count || 0),
      replyCount: Number(legacy?.reply_count || 0),
    };
  } catch {
    return null;
  }
}

export async function fetchLikes(count: number = 20): Promise<LikedTweet[]> {
  const authToken = process.env.X_AUTH_TOKEN;
  const csrfToken = process.env.X_CSRF_TOKEN;
  const userId = process.env.X_USER_ID;

  if (!authToken || !csrfToken || !userId) {
    throw new Error("X_AUTH_TOKEN, X_CSRF_TOKEN, and X_USER_ID env vars are required");
  }

  const variables = JSON.stringify({
    userId,
    count,
    includePromotedContent: false,
  });

  const url = new URL("https://x.com/i/api/graphql/j-O2fOmYBTqofGfn6LMb8g/Likes");
  url.searchParams.set("variables", variables);
  url.searchParams.set("features", FEATURES);

  const res = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${BEARER_TOKEN}`,
      cookie: `auth_token=${authToken}; ct0=${csrfToken}`,
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Twitter API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  // Navigate the response structure
  const instructions =
    data?.data?.user?.result?.timeline?.timeline?.instructions || [];

  const tweets: LikedTweet[] = [];

  for (const instruction of instructions) {
    const entries = instruction.entries || [];
    for (const entry of entries) {
      // Skip cursor entries
      if (entry.entryId?.startsWith("cursor-")) continue;

      const result =
        entry?.content?.itemContent?.tweet_results?.result;
      if (!result) continue;

      const tweet = extractTweetFromResult(result);
      if (tweet) tweets.push(tweet);
    }
  }

  return tweets;
}
