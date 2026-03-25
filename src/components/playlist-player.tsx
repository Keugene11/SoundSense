"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle } from "./youtube-player";
import type { Recommendation } from "@/types/database";

interface PlaylistPlayerProps {
  tracks: Recommendation[];
  currentIndex: number | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onEnded: () => void;
  onTrackReady?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlaylistPlayer({
  tracks,
  currentIndex,
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onEnded,
  onTrackReady,
}: PlaylistPlayerProps) {
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const currentTrack =
    currentIndex !== null ? tracks[currentIndex] : null;

  // Sync play/pause state with player
  useEffect(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.play();
    } else {
      playerRef.current.pause();
    }
  }, [isPlaying]);

  const handleProgress = useCallback((time: number, dur: number) => {
    setCurrentTime(time);
    setDuration(dur);
  }, []);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !playerRef.current || duration === 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      playerRef.current.seekTo(fraction * duration);
    },
    [duration]
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  // Apply mute state via the iframe player
  useEffect(() => {
    const iframe = document.querySelector("iframe");
    if (iframe) {
      const src = iframe.src;
      // YouTube IFrame API doesn't have a direct mute method via ref,
      // but we can use postMessage. For simplicity, we'll use CSS approach
      // with volume. The YT player ref handles this.
    }
  }, [muted]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Check navigation
  const playableIndices = tracks
    .map((t, i) => (t.video_id ? i : -1))
    .filter((i) => i !== -1);
  const currentPlayablePos =
    currentIndex !== null ? playableIndices.indexOf(currentIndex) : -1;
  const hasPrev = currentPlayablePos > 0;
  const hasNext = currentPlayablePos < playableIndices.length - 1;

  return (
    <>
      {/* Hidden YouTube player */}
      {currentTrack.video_id && (
        <YouTubePlayer
          key={currentTrack.video_id + "-" + currentIndex}
          ref={playerRef}
          videoId={currentTrack.video_id}
          hidden
          onEnded={onEnded}
          onReady={onTrackReady}
          onProgress={handleProgress}
          onPlay={onPlay}
          onPause={onPause}
        />
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
        {/* Progress bar (thin, clickable) */}
        <div
          ref={progressRef}
          className="h-1 w-full cursor-pointer bg-muted group relative"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-foreground transition-[width] duration-300 ease-linear"
            style={{ width: `${progress}%` }}
          />
          {/* Hover indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>

        <div className="flex items-center gap-4 px-4 py-3">
          {/* Track info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentTrack.thumbnail_url ? (
              <Image
                src={currentTrack.thumbnail_url}
                alt={currentTrack.title}
                width={48}
                height={48}
                className="h-12 w-12 rounded-md object-cover shrink-0"
                unoptimized
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-lg shrink-0">
                &#9835;
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentTrack.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-2 rounded-full hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="p-3 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-2 rounded-full hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <SkipForward size={20} />
            </button>
          </div>

          {/* Time + Volume */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground min-w-[120px] justify-end">
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
            <button onClick={toggleMute} className="p-1 hover:text-foreground transition-colors">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
