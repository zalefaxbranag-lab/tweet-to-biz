"use client";

import { useState, useEffect, useCallback } from "react";
import UrlInput from "@/components/url-input";
import Feed from "@/components/feed";

interface TweetData {
  id: string;
  url: string;
  content: string;
  author: string;
  status: string;
  error?: string | null;
  analysis?: {
    id: string;
    summary: string;
    bizIdea: string;
    plan: string;
    tools: string;
    score: number;
    weaknesses: string;
    projectId?: string | null;
    project?: {
      id: string;
      name: string;
      status: string;
    } | null;
  } | null;
}

export default function Home() {
  const [tweets, setTweets] = useState<TweetData[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const fetchTweets = useCallback(async () => {
    try {
      const res = await fetch("/api/tweets");
      if (res.ok) {
        const data = await res.json();
        setTweets(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchTweets();
  }, [fetchTweets]);

  // Poll for processing tweets
  useEffect(() => {
    const hasProcessing = tweets.some(
      (t) => t.status === "processing" || t.status === "pending"
    );
    if (!hasProcessing) return;

    const interval = setInterval(fetchTweets, 3000);
    return () => clearInterval(interval);
  }, [tweets, fetchTweets]);

  const handleSubmit = async (url: string) => {
    setIsAdding(true);
    try {
      // Add the tweet
      const addRes = await fetch("/api/tweets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!addRes.ok) {
        const error = await addRes.json();
        alert(error.error || "Failed to add tweet");
        return;
      }

      const tweet = await addRes.json();

      // Refresh to show the new tweet
      await fetchTweets();

      // Auto-trigger processing if pending
      if (tweet.status === "pending") {
        fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tweetId: tweet.id }),
        }).then(() => {
          // Will be picked up by polling
          fetchTweets();
        });
      }
    } catch {
      alert("Failed to add tweet. Check the URL and try again.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen">
      <UrlInput onSubmit={handleSubmit} isLoading={isAdding} />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Feed tweets={tweets} onRefresh={fetchTweets} />
      </main>
    </div>
  );
}
