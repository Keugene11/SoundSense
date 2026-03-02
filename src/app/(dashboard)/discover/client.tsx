"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecommendationCard } from "@/components/recommendation-card";
import { toast } from "sonner";
import type { Recommendation, SeedSong } from "@/types/database";

interface DiscoverClientProps {
  plan: "free" | "pro";
  initialSeeds: SeedSong[];
}

export function DiscoverClient({ plan, initialSeeds }: DiscoverClientProps) {
  const [seeds, setSeeds] = useState<SeedSong[]>(initialSeeds);
  const [input, setInput] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generating, setGenerating] = useState(false);

  // Playlist state
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Get playable recommendations (those with video_id)
  const playableIndices = recommendations
    .map((rec, i) => (rec.video_id ? i : -1))
    .filter((i) => i !== -1);

  const currentRec =
    currentIndex !== null ? recommendations[currentIndex] : null;

  const [adding, setAdding] = useState(false);

  const addSeed = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Remove existing seed first if one exists
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
      if (data.seeds) {
        // Playlist — take only the first song
        setSeeds([data.seeds[0]]);
        toast.success(`Added "${data.seeds[0].title}"`);
      } else {
        setSeeds([data.seed]);
      }
    } catch {
      toast.error("Failed to save seed song");
    } finally {
      setAdding(false);
    }
  };

  const removeSeed = async (id: string) => {
    setSeeds((prev) => prev.filter((s) => s.id !== id));

    try {
      const res = await fetch("/api/seeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to remove seed song");
    }
  };

  const handleGenerate = async () => {
    if (seeds.length === 0) {
      toast.error("Add at least one song");
      return;
    }

    setGenerating(true);
    setCurrentIndex(null);
    setIsPlaying(false);
    try {
      const res = await fetch("/api/recommendations/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seeds: seeds.map((s) => ({ title: s.title, artist: s.artist })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          toast.error(data.error, {
            action: data.upgrade
              ? {
                  label: "Upgrade",
                  onClick: () =>
                    (window.location.href = "/settings?tab=subscription"),
                }
              : undefined,
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setRecommendations(data.recommendations);
      toast.success(
        `Generated ${data.recommendations.length} recommendations`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate"
      );
    } finally {
      setGenerating(false);
    }
  };

  // Playlist controls
  const playIndex = useCallback(
    (index: number) => {
      if (recommendations[index]?.video_id) {
        setCurrentIndex(index);
        setIsPlaying(true);
      }
    },
    [recommendations]
  );

  const playNext = useCallback(() => {
    if (currentIndex === null) return;
    const nextPlayable = playableIndices.find((i) => i > currentIndex);
    if (nextPlayable !== undefined) {
      playIndex(nextPlayable);
    } else {
      setIsPlaying(false);
      setCurrentIndex(null);
    }
  }, [currentIndex, playableIndices, playIndex]);

  const playPrev = useCallback(() => {
    if (currentIndex === null) return;
    const prevPlayable = [...playableIndices]
      .reverse()
      .find((i) => i < currentIndex);
    if (prevPlayable !== undefined) {
      playIndex(prevPlayable);
    }
  }, [currentIndex, playableIndices, playIndex]);

  const togglePlay = () => {
    if (currentIndex === null && playableIndices.length > 0) {
      playIndex(playableIndices[0]);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const hasPlayable = playableIndices.length > 0;
  const currentPlayablePos =
    currentIndex !== null ? playableIndices.indexOf(currentIndex) : -1;
  const hasPrev = currentPlayablePos > 0;
  const hasNext = currentPlayablePos < playableIndices.length - 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Discover</h1>
        <p className="mt-1 text-muted-foreground">
          Enter a song you like and get personalized recommendations.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Song name or YouTube link"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSeed();
              }
            }}
          />
          <Button variant="outline" onClick={addSeed} disabled={!input.trim() || adding}>
            {adding ? "Finding..." : seeds.length > 0 ? "Replace" : "Add"}
          </Button>
        </div>

        {seeds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {seeds.map((seed) => (
              <span
                key={seed.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
              >
                {seed.title}
                {seed.artist && ` - ${seed.artist}`}
                <button
                  onClick={() => removeSeed(seed.id)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={generating || seeds.length === 0}
        >
          {generating ? "Generating..." : "Generate Recommendations"}
        </Button>
      </div>

      {/* Playlist Player */}
      {recommendations.length > 0 && hasPlayable && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={playPrev}
                disabled={!hasPrev}
              >
                &#9664;&#9664; Prev
              </Button>
              <Button size="sm" onClick={togglePlay}>
                {isPlaying && currentIndex !== null ? "Pause" : "Play"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={playNext}
                disabled={!hasNext}
              >
                Next &#9654;&#9654;
              </Button>
            </div>
            {currentRec && (
              <p className="text-sm text-muted-foreground truncate ml-3">
                Now playing: <span className="font-medium text-foreground">{currentRec.title}</span>
                {currentRec.artist && ` - ${currentRec.artist}`}
                {" "}({currentPlayablePos + 1}/{playableIndices.length})
              </p>
            )}
            {!currentRec && (
              <p className="text-sm text-muted-foreground">
                {playableIndices.length} playable tracks
              </p>
            )}
          </div>

        </div>
      )}

      {recommendations.length > 0 && (
        <div className="grid gap-4">
          {recommendations.map((rec, i) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              isActive={currentIndex === i && isPlaying}
              onPlay={
                rec.video_id
                  ? () => {
                      if (currentIndex === i && isPlaying) {
                        setIsPlaying(false);
                      } else {
                        playIndex(i);
                      }
                    }
                  : undefined
              }
              onEnded={playNext}
            />
          ))}
        </div>
      )}

      {plan === "free" && (
        <p className="text-center text-sm text-muted-foreground">
          Free plan: 5 recommendations per day.{" "}
          <a href="/settings?tab=subscription" className="underline">
            Upgrade to Pro
          </a>{" "}
          for unlimited.
        </p>
      )}
    </div>
  );
}
