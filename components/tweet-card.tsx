"use client";

import { useState } from "react";
import PlanDetail from "./plan-detail";
import FeedbackForm from "./feedback-form";

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

interface TweetCardProps {
  tweet: TweetData;
  onRefresh: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s <= 3) return "from-red-500 to-red-600";
    if (s <= 5) return "from-orange-500 to-yellow-500";
    if (s <= 7) return "from-yellow-400 to-green-400";
    return "from-green-400 to-emerald-500";
  };

  const bars = Array.from({ length: 10 }, (_, i) => i < score);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {bars.map((filled, i) => (
          <div
            key={i}
            className={`w-2 h-4 rounded-sm ${
              filled ? `bg-gradient-to-t ${getColor(score)}` : "bg-gray-700"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-bold text-gray-300">{score}/10</span>
    </div>
  );
}

export default function TweetCard({ tweet, onRefresh }: TweetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isProcessing = tweet.status === "processing";
  const isDone = tweet.status === "done";
  const isFailed = tweet.status === "failed";
  const analysis = tweet.analysis;

  const truncatedContent = tweet.content.length > 140
    ? tweet.content.slice(0, 140) + "..."
    : tweet.content;

  const handleApprove = async () => {
    if (!analysis?.projectId) return;
    setActionLoading(true);
    try {
      await fetch(`/api/projects/${analysis.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!analysis?.projectId) return;
    setActionLoading(true);
    try {
      await fetch(`/api/projects/${analysis.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleImprove = async (feedback: string) => {
    if (!analysis?.projectId) return;
    setActionLoading(true);
    try {
      await fetch(`/api/projects/${analysis.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      setShowFeedback(false);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  let plan: Array<{ step: string; difficulty: "easy" | "medium" | "hard"; cost: string; tool?: string }> = [];
  let tools: Array<{ name: string; url: string; cost: string }> = [];
  try {
    if (analysis?.plan) plan = JSON.parse(analysis.plan);
    if (analysis?.tools) tools = JSON.parse(analysis.tools);
  } catch {
    // ignore parse errors
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all hover:border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {tweet.author && (
              <span className="text-sm font-medium text-blue-400">@{tweet.author}</span>
            )}
            {analysis?.project?.status === "approved" && (
              <span className="text-xs bg-green-900/50 text-green-300 border border-green-700 px-2 py-0.5 rounded-full">
                Approved
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300">&ldquo;{truncatedContent}&rdquo;</p>
        </div>
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div className="mt-3 flex items-center gap-2 text-yellow-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Processing...</span>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="mt-3 text-sm text-red-400">
          Failed: {tweet.error || "Unknown error"}
        </div>
      )}

      {/* Analysis results */}
      {isDone && analysis && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <ScoreBadge score={analysis.score} />
            <span className="text-sm text-gray-400 truncate ml-2">
              {analysis.bizIdea}
            </span>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {expanded ? "Collapse plan" : "Expand plan"}
          </button>

          {/* Expanded plan */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <PlanDetail plan={plan} tools={tools} weaknesses={analysis.weaknesses} />
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2 border-t border-gray-800 pt-3">
            {analysis.project?.status !== "approved" ? (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="text-sm bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  disabled={actionLoading}
                  className="text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Improve
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={actionLoading}
                  className="text-sm text-gray-500 hover:text-red-400 px-3 py-1.5 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Dismiss
                </button>
              </>
            ) : (
              <a
                href={`/project/${analysis.projectId}`}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                View project details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            )}
          </div>

          {/* Feedback form */}
          {showFeedback && (
            <FeedbackForm
              onSubmit={handleImprove}
              onCancel={() => setShowFeedback(false)}
              isLoading={actionLoading}
            />
          )}
        </div>
      )}
    </div>
  );
}
