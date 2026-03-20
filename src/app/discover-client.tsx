"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="min-h-screen bg-background">
      {/* Hero state — centered input */}
      {!hasResults && !generating && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">SoundSense</h1>
              <p className="text-muted-foreground">
                Enter a song or paste a YouTube link. Get 10 recommendations.
              </p>
            </div>

            <div className="space-y-4">
              <Input
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
                className="h-12 text-base"
              />
              <Button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="w-full h-12 text-base"
                size="lg"
              >
                Get recommendations
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {generating && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-4">
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          <p className="text-muted-foreground">
            Finding songs based on <span className="font-medium text-foreground">{seedLabel}</span>
          </p>
          <p className="text-sm text-muted-foreground/60">This can take up to 30 seconds</p>
        </div>
      )}

      {/* Results state */}
      {hasResults && !generating && (
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SoundSense</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Based on <span className="font-medium text-foreground">{seedLabel}</span>
                {" "}&middot; {recommendations.length} songs
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSeedLabel(null);
                setRecommendations([]);
                setActiveIndex(null);
              }}
            >
              New search
            </Button>
          </div>

          {/* Search another */}
          <div className="flex gap-2 mb-8">
            <Input
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
            />
            <Button onClick={handleSubmit} disabled={!input.trim()}>
              Go
            </Button>
          </div>

          {/* Results grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.map((rec, i) => {
              const isActive = activeIndex === i;
              return (
                <Card
                  key={rec.id}
                  className={`transition-all cursor-pointer hover:shadow-md ${
                    isActive ? "ring-2 ring-primary md:col-span-2" : ""
                  }`}
                  onClick={() => {
                    if (!rec.video_id) return;
                    setActiveIndex(isActive ? null : i);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
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
                          <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xl">
                            ♪
                          </div>
                        )}
                        {rec.video_id && (
                          <div className={`absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all ${
                            isActive ? "bg-black/50" : ""
                          }`}>
                            <span className={`text-white text-sm ${isActive ? "opacity-100" : "opacity-0 hover:opacity-100"}`}>
                              {isActive ? "■" : "▶"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{rec.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {rec.artist}
                              {rec.album && (
                                <span className="text-muted-foreground/50"> · {rec.album}</span>
                              )}
                            </p>
                          </div>
                          {rec.confidence_score && rec.confidence_score >= 0.7 && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              {Math.round(rec.confidence_score * 100)}%
                            </Badge>
                          )}
                        </div>
                        {rec.reason && (
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {rec.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* YouTube Player */}
                    {isActive && rec.video_id && (
                      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                        <div className="aspect-video w-full overflow-hidden rounded-lg">
                          <YouTubePlayer videoId={rec.video_id} onEnded={playNext} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
