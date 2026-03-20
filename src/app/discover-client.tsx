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
    <div className="min-h-screen">
      {/* Hero / Input */}
      {!hasResults && !generating && (
        <div className="flex flex-col items-center justify-center min-h-screen px-6">
          <div className="w-full max-w-lg animate-slideInUp">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-center leading-[1.1] mb-4">
              SoundSense
            </h1>
            <p className="text-[15px] text-on-surface/40 text-center mb-14">
              Paste a YouTube link or type a song name.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-3">
                  Seed song
                </label>
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
                  placeholder="e.g. Toxicity by System of a Down"
                  className="w-full bg-transparent border-b border-on-surface/20 pb-3 text-lg text-on-surface placeholder-on-surface/20 focus:outline-none focus:border-on-surface/50 transition-colors"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="w-full py-3.5 bg-on-surface text-surface font-medium rounded-full text-sm hover:opacity-85 transition-all disabled:opacity-15 disabled:cursor-not-allowed"
              >
                Get recommendations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {generating && (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-4">
          <div className="w-6 h-6 border-2 border-on-surface/15 border-t-on-surface/50 rounded-full animate-spin" />
          <p className="text-[14px] text-on-surface/35">
            Finding songs based on <span className="text-on-surface/60">{seedLabel}</span>
          </p>
          <p className="text-[12px] text-on-surface/20">This can take up to 30 seconds</p>
        </div>
      )}

      {/* Results */}
      {hasResults && !generating && (
        <div className="max-w-2xl mx-auto px-4 md:px-8 pt-8 pb-20">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SoundSense</h1>
              <p className="text-[13px] text-on-surface/35 mt-0.5">
                Based on <span className="text-on-surface/60">{seedLabel}</span>
              </p>
            </div>
            <button
              onClick={() => {
                setSeedLabel(null);
                setRecommendations([]);
                setActiveIndex(null);
              }}
              className="px-4 py-1.5 border border-on-surface/15 text-on-surface/50 rounded-full text-[13px] hover:border-on-surface/30 hover:text-on-surface/70 transition-all"
            >
              New search
            </button>
          </div>

          {/* Try another inline */}
          <div className="mb-8">
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
              placeholder="Try another song or paste a link..."
              className="w-full bg-transparent border-b border-on-surface/10 pb-2.5 text-[14px] text-on-surface placeholder-on-surface/20 focus:outline-none focus:border-on-surface/40 transition-colors"
            />
          </div>

          {/* Song cards */}
          <div className="stagger">
            {recommendations.map((rec, i) => {
              const isActive = activeIndex === i;
              return (
                <div
                  key={rec.id}
                  className={`group border border-on-surface/10 rounded-xl p-4 mb-3 transition-all hover:border-on-surface/20 ${
                    isActive ? "border-on-surface/25 bg-on-surface/[0.02]" : ""
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <button
                      onClick={() => {
                        if (!rec.video_id) return;
                        setActiveIndex(isActive ? null : i);
                      }}
                      disabled={!rec.video_id}
                      className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-on-surface/5 disabled:cursor-default"
                    >
                      {rec.thumbnail_url ? (
                        <Image
                          src={rec.thumbnail_url}
                          alt=""
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex items-center justify-center w-full h-full text-on-surface/15 text-xl">
                          &#9835;
                        </span>
                      )}
                      {rec.video_id && (
                        <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                          isActive
                            ? "bg-black/50"
                            : "bg-black/0 group-hover:bg-black/40"
                        }`}>
                          <span className={`text-white text-sm transition-opacity ${
                            isActive
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}>
                            {isActive ? "■" : "▶"}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Song info */}
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-on-surface leading-snug truncate">
                            {rec.title}
                          </p>
                          <p className="text-[13px] text-on-surface/40 mt-0.5">
                            {rec.artist}
                            {rec.album && (
                              <span className="text-on-surface/20"> &middot; {rec.album}</span>
                            )}
                          </p>
                        </div>
                        {rec.confidence_score && rec.confidence_score >= 0.7 && (
                          <span className="shrink-0 text-[11px] text-on-surface/25 border border-on-surface/10 rounded-full px-2 py-0.5">
                            {Math.round(rec.confidence_score * 100)}%
                          </span>
                        )}
                      </div>

                      {rec.reason && (
                        <p className="mt-2 text-[12px] text-on-surface/35 leading-relaxed line-clamp-2">
                          {rec.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Player */}
                  {isActive && rec.video_id && (
                    <div className="mt-4 animate-fadeIn">
                      <div className="aspect-video w-full overflow-hidden rounded-lg">
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
