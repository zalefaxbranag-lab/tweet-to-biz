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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

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

  // Auto-sync likes on first load
  useEffect(() => {
    const autoSync = async () => {
      setIsSyncing(true);
      try {
        const res = await fetch("/api/sync-likes", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data.newTweets > 0) {
            setSyncResult(`Found ${data.newTweets} new liked tweets`);
            fetchTweets();
          } else {
            setSyncResult("Likes up to date");
          }
        }
      } catch {
        // silently fail on auto-sync
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncResult(null), 4000);
      }
    };
    autoSync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSyncLikes = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync-likes", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(
          data.newTweets > 0
            ? `Found ${data.newTweets} new liked tweets!`
            : "No new likes to process"
        );
        fetchTweets();
      } else {
        const err = await res.json();
        setSyncResult(`Error: ${err.error}`);
      }
    } catch {
      setSyncResult("Failed to sync likes");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleSubmit = async (url: string) => {
    setIsAdding(true);
    try {
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
      await fetchTweets();

      if (tweet.status === "pending") {
        fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tweetId: tweet.id }),
        }).then(() => fetchTweets());
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
        {/* Sync bar */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-200">
            Tweet to Biz
          </h1>
          <div className="flex items-center gap-3">
            {syncResult && (
              <span className="text-sm text-gray-400 animate-pulse">
                {syncResult}
              </span>
            )}
            <button
              onClick={handleSyncLikes}
              disabled={isSyncing}
              className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 text-gray-300 px-4 py-2 rounded-lg border border-gray-700 transition-colors"
            >
              <svg
                className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isSyncing ? "Syncing likes..." : "Sync X Likes"}
            </button>
          </div>
        </div>

        <Feed tweets={tweets} onRefresh={fetchTweets} />
      </main>
    </div>
  );
}
