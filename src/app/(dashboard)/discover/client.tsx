"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaylistPlayer } from "@/components/playlist-player";
import { PlaylistTrackList } from "@/components/playlist-track-list";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
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

  // Playlist state
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playableIndices = recommendations
    .map((rec, i) => (rec.video_id ? i : -1))
    .filter((i) => i !== -1);

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
      if (data.seeds) {
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
      await fetch("/api/seeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
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
      if (!res.ok) throw new Error(data.error);

      setRecommendations(data.recommendations);
      toast.success(`Generated ${data.recommendations.length} recommendations`);

      // Auto-play the first playable track
      const firstPlayable = data.recommendations.findIndex(
        (r: Recommendation) => r.video_id
      );
      if (firstPlayable !== -1) {
        setCurrentIndex(firstPlayable);
        setIsPlaying(true);
      }
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
        if (currentIndex === index) {
          setIsPlaying((prev) => !prev);
        } else {
          setCurrentIndex(index);
          setIsPlaying(true);
        }
      }
    },
    [recommendations, currentIndex]
  );

  const playNext = useCallback(() => {
    if (currentIndex === null) return;
    const nextPlayable = playableIndices.find((i) => i > currentIndex);
    if (nextPlayable !== undefined) {
      setCurrentIndex(nextPlayable);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setCurrentIndex(null);
    }
  }, [currentIndex, playableIndices]);

  const playPrev = useCallback(() => {
    if (currentIndex === null) return;
    const prevPlayable = [...playableIndices]
      .reverse()
      .find((i) => i < currentIndex);
    if (prevPlayable !== undefined) {
      setCurrentIndex(prevPlayable);
      setIsPlaying(true);
    }
  }, [currentIndex, playableIndices]);

  const handlePlay = useCallback(() => {
    if (currentIndex === null && playableIndices.length > 0) {
      setCurrentIndex(playableIndices[0]);
    }
    setIsPlaying(true);
  }, [currentIndex, playableIndices]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const hasPlaylist = recommendations.length > 0;

  return (
    <div className={`space-y-6 ${hasPlaylist && currentIndex !== null ? "pb-24" : ""}`}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-muted-foreground">
          Enter a song you like and we&apos;ll create a playlist for you.
        </p>
      </div>

      {/* Seed input */}
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
          <Button
            variant="outline"
            onClick={addSeed}
            disabled={!input.trim() || adding}
          >
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
          className="gap-2"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating playlist...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Playlist
            </>
          )}
        </Button>
      </div>

      {/* Playlist */}
      {hasPlaylist && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Your Playlist
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {playableIndices.length} tracks
              </span>
            </h2>
          </div>

          <PlaylistTrackList
            tracks={recommendations}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            onTrackClick={playIndex}
          />
        </div>
      )}

      {/* Bottom player bar */}
      {hasPlaylist && currentIndex !== null && (
        <PlaylistPlayer
          tracks={recommendations}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onNext={playNext}
          onPrev={playPrev}
          onEnded={playNext}
        />
      )}
    </div>
  );
}
