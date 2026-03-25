"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaylistPlayer } from "@/components/playlist-player";
import { PlaylistTrackList, type TrackFeedback } from "@/components/playlist-track-list";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import type { Recommendation, SeedSong } from "@/types/database";

interface DiscoverClientProps {
  initialSeeds: SeedSong[];
  isLoggedIn: boolean;
}

const PENDING_SEED_KEY = "soundsense_pending_seed";

interface FeedbackEntry {
  title: string;
  artist: string;
  feedback: "liked" | "disliked";
}

const FEEDBACK_KEY = "soundsense_feedback";

function loadFeedbackHistory(): FeedbackEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFeedbackHistory(entries: FeedbackEntry[]) {
  try {
    // Keep last 100 entries
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries.slice(-100)));
  } catch {}
}

export function DiscoverClient({ initialSeeds, isLoggedIn }: DiscoverClientProps) {
  const [seeds, setSeeds] = useState<SeedSong[]>(initialSeeds);
  const [input, setInput] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);

  // Playlist state
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Feedback state: trackId -> liked/disliked/null
  const [feedback, setFeedback] = useState<Record<string, TrackFeedback>>({});
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackEntry[]>([]);

  // Load feedback history from localStorage on mount
  useEffect(() => {
    setFeedbackHistory(loadFeedbackHistory());
  }, []);

  // Restore pending seed after login redirect
  const [pendingGenerate, setPendingGenerate] = useState(false);
  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const raw = localStorage.getItem(PENDING_SEED_KEY);
      if (!raw) return;
      localStorage.removeItem(PENDING_SEED_KEY);
      const pending = JSON.parse(raw) as { title: string; artist: string };
      if (pending.title) {
        const seed: SeedSong = {
          id: crypto.randomUUID(),
          user_id: "pending",
          title: pending.title,
          artist: pending.artist || "",
          created_at: new Date().toISOString(),
        };
        setSeeds([seed]);
        setPendingGenerate(true);
      }
    } catch {}
  }, [isLoggedIn]);

  // Auto-generate after restoring pending seed
  useEffect(() => {
    if (pendingGenerate && seeds.length > 0 && !generating) {
      setPendingGenerate(false);
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGenerate, seeds]);

  const playableIndices = recommendations
    .map((rec, i) => (rec.video_id ? i : -1))
    .filter((i) => i !== -1);

  const handleFeedback = useCallback(
    (trackId: string, fb: TrackFeedback) => {
      setFeedback((prev) => ({ ...prev, [trackId]: fb }));

      // Find the track and update persistent history
      const track = recommendations.find((r) => r.id === trackId);
      if (!track) return;

      setFeedbackHistory((prev) => {
        // Remove any existing entry for this song
        const filtered = prev.filter(
          (e) =>
            !(
              e.title.toLowerCase() === track.title.toLowerCase() &&
              e.artist.toLowerCase() === track.artist.toLowerCase()
            )
        );
        // Add new entry if not null
        const updated =
          fb !== null
            ? [...filtered, { title: track.title, artist: track.artist, feedback: fb }]
            : filtered;
        saveFeedbackHistory(updated);
        return updated;
      });
    },
    [recommendations]
  );

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
      toast.success(
        seed.artist
          ? `Found "${seed.title}" by ${seed.artist}`
          : `Found "${seed.title}"`
      );
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

    if (!isLoggedIn) {
      // Save seed so we can restore after login
      try {
        localStorage.setItem(
          PENDING_SEED_KEY,
          JSON.stringify({ title: seeds[0].title, artist: seeds[0].artist })
        );
      } catch {}
      window.location.href = "/login";
      return;
    }

    setGenerating(true);
    setCurrentIndex(null);
    setIsPlaying(false);
    setFeedback({});

    // Build feedback context from history
    const liked = feedbackHistory.filter((e) => e.feedback === "liked");
    const disliked = feedbackHistory.filter((e) => e.feedback === "disliked");

    try {
      const res = await fetch("/api/recommendations/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seeds: seeds.map((s) => ({ title: s.title, artist: s.artist })),
          liked: liked.map((e) => `${e.title} by ${e.artist}`),
          disliked: disliked.map((e) => `${e.title} by ${e.artist}`),
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
  const likedCount = feedbackHistory.filter((e) => e.feedback === "liked").length;
  const dislikedCount = feedbackHistory.filter((e) => e.feedback === "disliked").length;

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
        {seeds.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Generating based on</p>
              <p className="truncate text-sm font-semibold mt-0.5">
                {seeds[0].title}
                {seeds[0].artist && (
                  <span className="font-normal text-muted-foreground"> &middot; {seeds[0].artist}</span>
                )}
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder={seeds.length > 0 ? "Try a different song..." : "Song name or YouTube link"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSeed();
              }
            }}
            disabled={adding}
          />
          <Button
            variant="outline"
            onClick={addSeed}
            disabled={!input.trim() || adding}
          >
            {adding ? "Finding..." : seeds.length > 0 ? "Replace" : "Add"}
          </Button>
        </div>

        <div className="flex items-center gap-3">
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
          {isLoggedIn && (likedCount > 0 || dislikedCount > 0) && (
            <p className="text-xs text-muted-foreground">
              Your taste profile: {likedCount} liked, {dislikedCount} disliked
            </p>
          )}
        </div>
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
          currentFeedback={currentIndex !== null ? (feedback[recommendations[currentIndex]?.id] ?? null) : null}
          onFeedback={(fb) => {
            if (currentIndex !== null) {
              handleFeedback(recommendations[currentIndex].id, fb);
            }
          }}
        />
      )}
    </div>
  );
}
