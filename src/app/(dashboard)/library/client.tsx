"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedbackEntry {
  title: string;
  artist: string;
  feedback: "liked" | "disliked";
}

const FEEDBACK_KEY = "soundsense_feedback";

function loadFeedback(): FeedbackEntry[] {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFeedback(entries: FeedbackEntry[]) {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries));
  } catch {}
}

export function LibraryClient() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "liked" | "disliked">("all");

  useEffect(() => {
    setEntries(loadFeedback());
  }, []);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.feedback === filter);
  const likedCount = entries.filter((e) => e.feedback === "liked").length;
  const dislikedCount = entries.filter((e) => e.feedback === "disliked").length;

  const removeEntry = (title: string, artist: string) => {
    const updated = entries.filter(
      (e) => !(e.title === title && e.artist === artist)
    );
    setEntries(updated);
    saveFeedback(updated);
  };

  const clearAll = () => {
    setEntries([]);
    saveFeedback([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <p className="mt-1 text-muted-foreground">
          Songs you&apos;ve liked and disliked. This shapes your future recommendations.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({entries.length})
        </button>
        <button
          onClick={() => setFilter("liked")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === "liked" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Liked ({likedCount})
        </button>
        <button
          onClick={() => setFilter("disliked")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === "disliked" ? "bg-red-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Disliked ({dislikedCount})
        </button>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="ml-auto text-muted-foreground">
            <Trash2 size={14} className="mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* Song list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {entries.length === 0
            ? "No feedback yet. Like or dislike songs while listening to build your taste profile."
            : "No songs match this filter."}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((entry, i) => (
            <div
              key={`${entry.title}-${entry.artist}-${i}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors group"
            >
              <div className="shrink-0">
                {entry.feedback === "liked" ? (
                  <ThumbsUp size={16} className="text-green-500" fill="currentColor" />
                ) : (
                  <ThumbsDown size={16} className="text-red-500" fill="currentColor" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.title}</p>
                <p className="truncate text-xs text-muted-foreground">{entry.artist}</p>
              </div>
              <button
                onClick={() => removeEntry(entry.title, entry.artist)}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
