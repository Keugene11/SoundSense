"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { YouTubePlayer } from "@/components/youtube-player";
import type { Recommendation, SeedSong } from "@/types/database";

interface DiscoverClientProps {
  initialSeeds: SeedSong[];
}

export function DiscoverClient({ initialSeeds }: DiscoverClientProps) {
  const [seeds, setSeeds] = useState<SeedSong[]>(initialSeeds);
  const [input, setInput] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);

  // Player state
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const playableRecs = recommendations.filter((r) => r.video_id);

  const addSeed = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (seeds.length > 0) {
      for (const s of seeds) {
        try {
          await fetch("/api/seeds", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: s.id }),
          });
        } catch {}
      }
      setSeeds([]);
    }

    setInput("");
    setAdding(true);

    try {
      const res = await fetch("/api/seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const seed = data.seeds ? data.seeds[0] : data.seed;
      setSeeds([seed]);
    } catch {
      toast.error("Couldn't find that song");
    } finally {
      setAdding(false);
    }
  };

  const removeSeed = async (id: string) => {
    setSeeds((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch("/api/seeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  };

  const handleGenerate = async () => {
    if (seeds.length === 0) return;

    setGenerating(true);
    setActiveIndex(null);
    try {
      const res = await fetch("/api/recommendations/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seeds: seeds.map((s) => ({ title: s.title, artist: s.artist })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecommendations(data.recommendations);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate"
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
    if (nextIdx !== -1) {
      setActiveIndex(nextIdx);
    } else {
      setActiveIndex(null);
    }
  }, [activeIndex, recommendations]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className={`flex flex-col items-center justify-center px-6 ${recommendations.length > 0 ? "pt-16 pb-10" : "pt-32 pb-20"} transition-all duration-500`}>
        <div className="w-full max-w-lg animate-slideInUp">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-center leading-[1.1] mb-3">
            SoundSense
          </h1>
          <p className="text-sm text-on-surface/40 text-center mb-10">
            Enter a song you love. Get 10 you&apos;ll love more.
          </p>

          {/* Input */}
          <div className="mb-6">
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
                  addSeed();
                }
              }}
              placeholder={adding ? "Finding..." : "Song name or YouTube link"}
              disabled={adding}
              className="w-full bg-transparent border-b border-on-surface/20 pb-3 text-lg text-on-surface placeholder-on-surface/20 focus:outline-none focus:border-on-surface/50 transition-colors disabled:opacity-40"
            />
          </div>

          {/* Seed pill */}
          {seeds.length > 0 && (
            <div className="mb-6 animate-fadeIn">
              {seeds.map((seed) => (
                <span
                  key={seed.id}
                  className="inline-flex items-center gap-2 border border-on-surface/15 rounded-full px-4 py-1.5 text-sm text-on-surface/70"
                >
                  {seed.title}
                  {seed.artist && (
                    <span className="text-on-surface/30">{seed.artist}</span>
                  )}
                  <button
                    onClick={() => removeSeed(seed.id)}
                    className="text-on-surface/30 hover:text-on-surface/70 transition-colors ml-1"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || seeds.length === 0}
            className="w-full py-3.5 bg-accent text-on-accent font-medium rounded-full text-sm hover:bg-on-surface/80 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-on-accent/30 border-t-on-accent rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              "Generate recommendations"
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {recommendations.length > 0 && (
        <div className="max-w-lg mx-auto px-6 pb-20">
          <p className="text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-6">
            {recommendations.length} recommendations
          </p>

          <div className="space-y-0 stagger">
            {recommendations.map((rec, i) => {
              const isActive = activeIndex === i;
              return (
                <div
                  key={rec.id}
                  className={`border-b border-on-surface/10 py-4 transition-all ${
                    isActive ? "bg-on-surface/[0.03] -mx-4 px-4 rounded-xl border-transparent" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail / play button */}
                    <button
                      onClick={() => {
                        if (!rec.video_id) return;
                        setActiveIndex(isActive ? null : i);
                      }}
                      disabled={!rec.video_id}
                      className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-on-surface/5 group disabled:cursor-default"
                    >
                      {rec.thumbnail_url ? (
                        <Image
                          src={rec.thumbnail_url}
                          alt={rec.title}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex items-center justify-center w-full h-full text-on-surface/20 text-lg">
                          &#9835;
                        </span>
                      )}
                      {rec.video_id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                            {isActive ? "Stop" : "Play"}
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-on-surface truncate">
                        {rec.title}
                      </p>
                      <p className="text-[13px] text-on-surface/40 truncate">
                        {rec.artist}
                      </p>
                    </div>

                    {/* Match score */}
                    {rec.confidence_score && (
                      <span className="shrink-0 text-[11px] text-on-surface/30 tabular-nums">
                        {Math.round(rec.confidence_score * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Reason */}
                  {rec.reason && (
                    <p className="mt-2 text-[13px] text-on-surface/40 leading-relaxed pl-16">
                      {rec.reason}
                    </p>
                  )}

                  {/* Player */}
                  {isActive && rec.video_id && (
                    <div className="mt-3 pl-16 animate-fadeIn">
                      <div className="aspect-video w-full max-w-sm overflow-hidden rounded-lg">
                        <YouTubePlayer
                          videoId={rec.video_id}
                          onEnded={playNext}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {playableRecs.length > 0 && activeIndex === null && (
            <button
              onClick={() => {
                const first = recommendations.findIndex((r) => r.video_id);
                if (first !== -1) setActiveIndex(first);
              }}
              className="mt-8 w-full py-3 border border-on-surface/15 text-on-surface/50 font-medium rounded-full text-sm hover:border-on-surface/40 hover:text-on-surface/70 transition-all"
            >
              Play all ({playableRecs.length} tracks)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
