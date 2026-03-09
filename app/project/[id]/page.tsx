"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import PlanDetail from "@/components/plan-detail";
import FeedbackForm from "@/components/feedback-form";

interface Iteration {
  id: string;
  version: number;
  plan: string;
  feedback: string;
  score: number;
  changes: string;
  createdAt: string;
}

interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: string;
  plan: string;
  score: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  analyses: {
    id: string;
    summary: string;
    bizIdea: string;
    plan: string;
    tools: string;
    score: number;
    weaknesses: string;
    tweet: {
      id: string;
      url: string;
      content: string;
      author: string;
    };
  }[];
  iterations: Iteration[];
}

function ScoreBadgeLarge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s <= 3) return "from-red-500 to-red-600";
    if (s <= 5) return "from-orange-500 to-yellow-500";
    if (s <= 7) return "from-yellow-400 to-green-400";
    return "from-green-400 to-emerald-500";
  };

  return (
    <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${getColor(score)} text-white px-4 py-2 rounded-xl font-bold text-lg`}>
      {score}/10
    </div>
  );
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-700 text-gray-300" },
  approved: { label: "Approved", color: "bg-green-900/50 text-green-300 border border-green-700" },
  active: { label: "Active", color: "bg-blue-900/50 text-blue-300 border border-blue-700" },
};

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        setProject(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleStatusChange = async (status: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchProject();
    } finally {
      setActionLoading(false);
    }
  };

  const handleImprove = async (feedback: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      setShowFeedback(false);
      await fetchProject();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-300">Project not found</h2>
          <a href="/" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
            Back to feed
          </a>
        </div>
      </div>
    );
  }

  let plan: Array<{ step: string; difficulty: "easy" | "medium" | "hard"; cost: string; tool?: string }> = [];
  let tools: Array<{ name: string; url: string; cost: string }> = [];
  try {
    plan = JSON.parse(project.plan);
    if (project.analyses[0]?.tools) tools = JSON.parse(project.analyses[0].tools);
  } catch {
    // ignore
  }

  const statusInfo = statusLabels[project.status] || statusLabels.draft;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </a>
          <span className={`text-xs px-3 py-1 rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Title + Score */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{project.name}</h1>
            <p className="text-gray-400 mt-1">{project.description}</p>
          </div>
          <ScoreBadgeLarge score={project.score} />
        </div>

        {/* Source tweets */}
        {project.analyses.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Source Tweets
            </h3>
            {project.analyses.map((a) => (
              <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-2">
                <span className="text-sm text-blue-400">@{a.tweet.author}</span>
                <p className="text-sm text-gray-300 mt-1">
                  {a.tweet.content.slice(0, 200)}
                  {a.tweet.content.length > 200 ? "..." : ""}
                </p>
                <a
                  href={a.tweet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-blue-400 mt-1 inline-block"
                >
                  View original
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Plan */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <PlanDetail
            plan={plan}
            tools={tools}
            weaknesses={project.analyses[0]?.weaknesses || ""}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mb-8">
          {project.status === "draft" && (
            <button
              onClick={() => handleStatusChange("approved")}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Approve
            </button>
          )}
          {project.status === "approved" && (
            <button
              onClick={() => handleStatusChange("active")}
              disabled={actionLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Mark Active
            </button>
          )}
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            disabled={actionLoading}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 px-4 py-2 rounded-lg transition-colors"
          >
            Improve Plan
          </button>
        </div>

        {showFeedback && (
          <div className="mb-8">
            <FeedbackForm
              onSubmit={handleImprove}
              onCancel={() => setShowFeedback(false)}
              isLoading={actionLoading}
            />
          </div>
        )}

        {/* Iteration history */}
        {project.iterations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Iteration History
            </h3>
            <div className="space-y-3">
              {project.iterations.map((it) => (
                <div key={it.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">
                      Version {it.version}
                    </span>
                    <span className="text-xs text-gray-500">
                      Score: {it.score}/10
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-1">
                    <span className="text-gray-500">Feedback:</span> {it.feedback}
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-gray-500">Changes:</span> {it.changes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
