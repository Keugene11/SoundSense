"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaylistPlayer } from "@/components/playlist-player";
import { PlaylistTrackList, type TrackFeedback } from "@/components/playlist-track-list";

import { Loader2, Sparkles, Music } from "lucide-react";
import type { Recommendation } from "@/types/database";

interface DiscoverClientProps {
  isLoggedIn: boolean;
}

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
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries.slice(-100)));
  } catch {}
}

export function DiscoverClient({ isLoggedIn }: DiscoverClientProps) {
  const [input, setInput] = useState("");
  const [currentSeed, setCurrentSeed] = useState("");
  const [resolvedSeed, setResolvedSeed] = useState<{ title: string; artist: string } | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streamingMore, setStreamingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [feedback, setFeedback] = useState<Record<string, TrackFeedback>>({});
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackEntry[]>([]);

  useEffect(() => {
    setFeedbackHistory(loadFeedbackHistory());
  }, []);

  const playableIndices = recommendations
    .map((rec, i) => (rec.video_id ? i : -1))
    .filter((i) => i !== -1);

  const handleFeedback = useCallback(
    (trackId: string, fb: TrackFeedback) => {
      setFeedback((prev) => ({ ...prev, [trackId]: fb }));
      const track = recommendations.find((r) => r.id === trackId);
      if (!track) return;
      setFeedbackHistory((prev) => {
        const filtered = prev.filter(
          (e) =>
            !(
              e.title.toLowerCase() === track.title.toLowerCase() &&
              e.artist.toLowerCase() === track.artist.toLowerCase()
            )
        );
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

  const handleGenerate = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || generating) return;

    setCurrentSeed(trimmed);
    setResolvedSeed(null);
    setInput("");
    setGenerating(true);
    setStreamingMore(false);
    setRecommendations([]);
    setCurrentIndex(null);
    setIsPlaying(false);
    setFeedback({});
    setError(null);

    const liked = feedbackHistory.filter((e) => e.feedback === "liked");
    const disliked = feedbackHistory.filter((e) => e.feedback === "disliked");

    let indexCounter = 0;
    let firstPlayed = false;

    try {
      const res = await fetch("/api/recommendations/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          liked: liked.map((e) => `${e.title} by ${e.artist}`),
          disliked: disliked.map((e) => `${e.title} by ${e.artist}`),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error || "Failed to generate — try again";
        setError(msg);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as Record<string, unknown>;

            // Resolved seed info — update the display name
            if (chunk._type === "seed") {
              setResolvedSeed({ title: chunk.title as string, artist: chunk.artist as string });
              continue;
            }

            const rec = chunk as unknown as Recommendation;
            const myIndex = indexCounter++;
            setRecommendations((prev) => [...prev, rec]);

            if (!firstPlayed && rec.video_id) {
              firstPlayed = true;
              setCurrentIndex(myIndex);
              setIsPlaying(true);
              setGenerating(false);
              setStreamingMore(true);
            }
          } catch {}
        }
      }

      if (indexCounter === 0) {
        setError("Couldn't find playable songs for that track — try a different one");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong — try again");
    } finally {
      setGenerating(false);
      setStreamingMore(false);
    }
  }, [generating, feedbackHistory]);

  const handleSubmit = useCallback(() => {
    if (input.trim()) handleGenerate(input);
  }, [input, handleGenerate]);

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
    const prevPlayable = [...playableIndices].reverse().find((i) => i < currentIndex);
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

  void isLoggedIn;

  return (
    <div className={`space-y-6 ${hasPlaylist && currentIndex !== null ? "pb-24" : ""}`}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-muted-foreground">
          Enter a song you love and we&apos;ll build you a playlist.
        </p>
      </div>

      <div className="space-y-3">
        {currentSeed && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {generating || streamingMore ? "Generating based on" : "Generated from"}
              </p>
              {resolvedSeed ? (
                <p className="truncate text-sm font-semibold mt-0.5">
                  {resolvedSeed.title}
                  {resolvedSeed.artist && (
                    <span className="font-normal text-muted-foreground"> · {resolvedSeed.artist}</span>
                  )}
                </p>
              ) : (
                <p className="truncate text-sm font-semibold mt-0.5">{currentSeed}</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2">
          <Input
            placeholder={currentSeed ? "Try a different song..." : "Song name or YouTube link"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={generating}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || generating}
            className="gap-2 shrink-0"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate
              </>
            )}
          </Button>
        </div>

        {(likedCount > 0 || dislikedCount > 0) && (
          <p className="text-xs text-muted-foreground">
            Taste profile: {likedCount} liked · {dislikedCount} disliked
          </p>
        )}
      </div>

      {hasPlaylist && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Your Playlist
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {playableIndices.length} tracks
            </span>
          </h2>

          <PlaylistTrackList
            tracks={recommendations}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            onTrackClick={playIndex}
          />

          {streamingMore && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Music size={12} className="animate-pulse" />
              Finding more tracks…
            </div>
          )}
        </div>
      )}

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
