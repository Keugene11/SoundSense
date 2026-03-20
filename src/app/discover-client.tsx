"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { YouTubePlayer } from "@/components/youtube-player";
import type { Recommendation } from "@/types/database";

export function DiscoverClient() {
  const [input, setInput] = useState("");
  const [seedLabel, setSeedLabel] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || generating) return;

    setSeedLabel(trimmed);
    setInput("");
    setGenerating(true);
    setActiveIndex(null);
    setRecommendations([]);

    try {
      const res = await fetch("/api/recommendations/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecommendations(data.recommendations);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setGenerating(false);
    }
  };

  const playNext = useCallback(() => {
    if (activeIndex === null) return;
    const nextIdx = recommendations.findIndex(
      (r, i) => i > activeIndex && r.video_id
    );
    setActiveIndex(nextIdx !== -1 ? nextIdx : null);
  }, [activeIndex, recommendations]);

  const hasResults = recommendations.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header area */}
      <div className={`flex flex-col items-center px-6 transition-all duration-500 ${hasResults ? "pt-12 pb-8" : "pt-32 pb-20 flex-1 justify-center"}`}>
        <div className="w-full max-w-md">
          {/* Title */}
          <h1 className={`font-bold tracking-tight text-center leading-[1.1] mb-2 transition-all duration-500 ${hasResults ? "text-2xl" : "text-5xl"}`}>
            SoundSense
          </h1>
          {!hasResults && (
            <p className="text-[14px] text-on-surface/40 text-center mb-12">
              Paste a YouTube link or type a song name
            </p>
          )}

          {/* Input */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              {!hasResults && (
                <label className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-2">
                  Song
                </label>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Paste YouTube URL or type a song..."
                disabled={generating}
                className="w-full bg-transparent border-b border-on-surface/20 pb-2.5 text-[15px] text-on-surface placeholder-on-surface/25 focus:outline-none focus:border-on-surface/50 transition-colors disabled:opacity-30"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || generating}
              className="shrink-0 px-5 py-2 bg-on-surface text-surface font-medium rounded-full text-[13px] hover:opacity-80 transition-all disabled:opacity-15 disabled:cursor-not-allowed"
            >
              {generating ? "..." : "Go"}
            </button>
          </div>

          {/* Current seed label */}
          {seedLabel && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[12px] text-on-surface/30">Seed:</span>
              <span className="text-[13px] text-on-surface/60 truncate">{seedLabel}</span>
              {!generating && (
                <button
                  onClick={() => { setSeedLabel(null); setRecommendations([]); }}
                  className="text-on-surface/25 hover:text-on-surface/60 transition-colors text-sm ml-auto"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {generating && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-20">
          <div className="w-5 h-5 border-2 border-on-surface/15 border-t-on-surface/50 rounded-full animate-spin" />
          <p className="text-[13px] text-on-surface/30">Finding songs you&apos;ll love...</p>
        </div>
      )}

      {/* Results */}
      {hasResults && !generating && (
        <div className="max-w-md mx-auto w-full px-6 pb-16">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-on-surface/35">
              {recommendations.length} results
            </p>
            {recommendations.some((r) => r.video_id) && activeIndex === null && (
              <button
                onClick={() => {
                  const first = recommendations.findIndex((r) => r.video_id);
                  if (first !== -1) setActiveIndex(first);
                }}
                className="text-[12px] text-on-surface/40 hover:text-on-surface/70 transition-colors"
              >
                Play all
              </button>
            )}
          </div>

          <div className="stagger">
            {recommendations.map((rec, i) => {
              const isActive = activeIndex === i;
              return (
                <div
                  key={rec.id}
                  className={`py-3.5 transition-all ${
                    i < recommendations.length - 1 ? "border-b border-on-surface/8" : ""
                  } ${isActive ? "bg-on-surface/[0.02] -mx-3 px-3 rounded-lg border-transparent" : ""}`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Thumbnail */}
                    <button
                      onClick={() => {
                        if (!rec.video_id) return;
                        setActiveIndex(isActive ? null : i);
                      }}
                      disabled={!rec.video_id}
                      className="relative shrink-0 w-10 h-10 rounded-md overflow-hidden bg-on-surface/5 group disabled:cursor-default"
                    >
                      {rec.thumbnail_url ? (
                        <Image
                          src={rec.thumbnail_url}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex items-center justify-center w-full h-full text-on-surface/15 text-sm">
                          &#9835;
                        </span>
                      )}
                      {rec.video_id && !isActive && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                          <span className="text-white text-[10px]">&#9654;</span>
                        </div>
                      )}
                    </button>

                    {/* Song info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-on-surface leading-tight truncate">
                        {rec.title}
                      </p>
                      <p className="text-[12px] text-on-surface/35 truncate">
                        {rec.artist}
                      </p>
                    </div>

                    <span className="shrink-0 text-[11px] text-on-surface/20 tabular-nums">
                      {rec.confidence_score ? `${Math.round(rec.confidence_score * 100)}%` : ""}
                    </span>
                  </div>

                  {rec.reason && (
                    <p className="mt-1.5 text-[12px] text-on-surface/30 leading-relaxed pl-[54px]">
                      {rec.reason}
                    </p>
                  )}

                  {isActive && rec.video_id && (
                    <div className="mt-3 pl-[54px] animate-fadeIn">
                      <div className="aspect-video w-full max-w-xs overflow-hidden rounded-md">
                        <YouTubePlayer videoId={rec.video_id} onEnded={playNext} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
