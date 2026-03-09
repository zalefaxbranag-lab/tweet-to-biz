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
  const [isProcessing, setIsProcessing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keySource, setKeySource] = useState("none");
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

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

  const checkApiKey = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(data.hasApiKey);
        setKeySource(data.source);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTweets();
    checkApiKey();
  }, [fetchTweets, checkApiKey]);

  // Poll for processing tweets
  useEffect(() => {
    const hasProcessing = tweets.some(
      (t) => t.status === "processing"
    );
    if (!hasProcessing) return;

    const interval = setInterval(fetchTweets, 3000);
    return () => clearInterval(interval);
  }, [tweets, fetchTweets]);

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
            : "No new likes to sync"
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

  const handleProcessAll = async () => {
    if (!hasApiKey) {
      setShowSettings(true);
      return;
    }
    setIsProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch("/api/process-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setProcessResult(
          data.processed > 0
            ? `Processed ${data.processed} tweets! ${data.failed > 0 ? `(${data.failed} failed)` : ""}`
            : data.message || "Nothing to process"
        );
        fetchTweets();
      } else {
        setProcessResult(`Error: ${data.error}`);
      }
    } catch {
      setProcessResult("Processing failed");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessResult(null), 8000);
    }
  };

  const handleSaveKey = async () => {
    setSavingKey(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setHasApiKey(true);
        setKeySource("db");
        setApiKey("");
        setShowSettings(false);
      } else {
        setKeyError(data.error);
      }
    } catch {
      setKeyError("Failed to save key");
    } finally {
      setSavingKey(false);
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

      if (tweet.status === "pending" && hasApiKey) {
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

  const pendingCount = tweets.filter(
    (t) => t.status === "pending" || t.status === "failed"
  ).length;

  return (
    <div className="min-h-screen">
      <UrlInput onSubmit={handleSubmit} isLoading={isAdding} />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-200">
            Tweet to Biz
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg border transition-colors ${
                hasApiKey
                  ? "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                  : "bg-amber-900/30 border-amber-700 text-amber-400 hover:bg-amber-900/50 animate-pulse"
              }`}
              title={hasApiKey ? `API key set (${keySource})` : "Set API key"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mb-4 p-4 bg-gray-900 rounded-xl border border-gray-800">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Groq API Key (free)</h2>
            {hasApiKey ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-green-400">Key configured ({keySource})</span>
                <button
                  onClick={() => setHasApiKey(false)}
                  className="text-gray-500 hover:text-gray-300 ml-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  100% free — get a key from{" "}
                  <a href="https://console.groq.com/keys" target="_blank" className="text-blue-400 hover:underline">
                    console.groq.com/keys
                  </a>
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSaveKey}
                    disabled={savingKey || !apiKey}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
                  >
                    {savingKey ? "Validating..." : "Save"}
                  </button>
                </div>
                {keyError && <p className="text-xs text-red-400">{keyError}</p>}
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 mb-4">
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
            {isSyncing ? "Syncing..." : "Sync Likes"}
          </button>

          {pendingCount > 0 && (
            <button
              onClick={handleProcessAll}
              disabled={isProcessing}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors ${
                isProcessing
                  ? "bg-gray-900 text-gray-600 border-gray-800"
                  : "bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border-emerald-700"
              }`}
            >
              <svg className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isProcessing ? "Processing..." : `Process All (${pendingCount})`}
            </button>
          )}

          {(syncResult || processResult) && (
            <span className="text-sm text-gray-400 animate-pulse ml-2">
              {processResult || syncResult}
            </span>
          )}
        </div>

        {/* No API key banner */}
        {!hasApiKey && tweets.length > 0 && (
          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-800 rounded-lg flex items-center gap-3">
            <span className="text-amber-400 text-sm">
              Add your free Groq API key to process {pendingCount} pending tweets
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm bg-amber-700 hover:bg-amber-600 text-white px-3 py-1 rounded-lg transition-colors"
            >
              Add Key
            </button>
          </div>
        )}

        <Feed tweets={tweets} onRefresh={fetchTweets} />
      </main>
    </div>
  );
}
