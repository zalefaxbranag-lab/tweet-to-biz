"use client";

import { useState } from "react";

interface UrlInputProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading: boolean;
}

export default function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    await onSubmit(url.trim());
    setUrl("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/80 border-b border-gray-800 px-4 py-4"
    >
      <div className="max-w-3xl mx-auto flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste tweet URL here..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!url.trim() || isLoading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Adding...
            </span>
          ) : (
            "Go"
          )}
        </button>
      </div>
    </form>
  );
}
