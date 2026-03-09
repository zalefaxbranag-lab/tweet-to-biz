"use client";

import { useState } from "react";

interface FeedbackFormProps {
  onSubmit: (feedback: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export default function FeedbackForm({ onSubmit, onCancel, isLoading }: FeedbackFormProps) {
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || isLoading) return;
    await onSubmit(feedback.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="What should be improved? Be specific..."
        rows={3}
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        disabled={isLoading}
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!feedback.trim() || isLoading}
          className="text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          {isLoading ? "Improving..." : "Submit"}
        </button>
      </div>
    </form>
  );
}
