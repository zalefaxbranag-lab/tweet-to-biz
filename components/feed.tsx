"use client";

import { useState } from "react";
import TweetCard from "./tweet-card";

type Filter = "all" | "processing" | "ready";

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

interface FeedProps {
  tweets: TweetData[];
  onRefresh: () => void;
}

export default function Feed({ tweets, onRefresh }: FeedProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = tweets.filter((t) => {
    if (filter === "processing") return t.status === "processing" || t.status === "pending";
    if (filter === "ready") return t.status === "done";
    return true;
  });

  const processingCount = tweets.filter(
    (t) => t.status === "processing" || t.status === "pending"
  ).length;
  const readyCount = tweets.filter((t) => t.status === "done").length;

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "processing", label: "Processing", count: processingCount },
    { key: "ready", label: "Ready", count: readyCount },
  ];

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              filter === tab.key
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tweet list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {tweets.length === 0
              ? "No tweets yet. Paste a URL above to get started."
              : "No tweets match this filter."}
          </div>
        ) : (
          filtered.map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} onRefresh={onRefresh} />
          ))
        )}
      </div>
    </div>
  );
}
