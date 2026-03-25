"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
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
  const handleRef = useRef<YouTubePlayerHandle | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const prevVolume = useRef(80);

  const currentTrack =
    currentIndex !== null ? tracks[currentIndex] : null;

  // Reset ready state when track changes
  useEffect(() => {
    setPlayerReady(false);
    handleRef.current = null;
  }, [currentIndex]);

  const onPlayerReady = useCallback((handle: YouTubePlayerHandle) => {
    handleRef.current = handle;
    setPlayerReady(true);
    onTrackReady?.();
  }, [onTrackReady]);

  // Sync play/pause state with player
  useEffect(() => {
    if (!playerReady || !handleRef.current) return;
    if (isPlaying) {
      handleRef.current.play();
    } else {
      handleRef.current.pause();
    }
  }, [isPlaying, playerReady]);

  // Sync volume with player
  useEffect(() => {
    if (!playerReady || !handleRef.current) return;
    if (muted) {
      handleRef.current.mute();
    } else {
      handleRef.current.unmute();
      handleRef.current.setVolume(volume);
    }
  }, [volume, muted, playerReady]);

  const handleProgress = useCallback((time: number, dur: number) => {
    if (!isSeeking) {
      setCurrentTime(time);
    }
    setDuration(dur);
  }, [isSeeking]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !handleRef.current || duration === 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const seekTime = fraction * duration;
      setCurrentTime(seekTime);
      setIsSeeking(true);
      handleRef.current.seekTo(seekTime);
      setTimeout(() => setIsSeeking(false), 600);
    },
    [duration]
  );

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    setMuted(val === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (muted) {
      setMuted(false);
      setVolume(prevVolume.current > 0 ? prevVolume.current : 80);
    } else {
      prevVolume.current = volume;
      setMuted(true);
    }
  }, [muted, volume]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveVolume = muted ? 0 : volume;

  // Check navigation
  const playableIndices = tracks
    .map((t, i) => (t.video_id ? i : -1))
    .filter((i) => i !== -1);
  const currentPlayablePos =
    currentIndex !== null ? playableIndices.indexOf(currentIndex) : -1;
  const hasPrev = currentPlayablePos > 0;
  const hasNext = currentPlayablePos < playableIndices.length - 1;

  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 50 ? Volume1 : Volume2;

  return (
    <>
      {/* Hidden YouTube player */}
      {currentTrack.video_id && (
        <YouTubePlayer
          key={currentTrack.video_id + "-" + currentIndex}
          videoId={currentTrack.video_id}
          hidden
          onEnded={onEnded}
          onReady={onPlayerReady}
          onProgress={handleProgress}
          onPlay={onPlay}
          onPause={onPause}
        />
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="h-1.5 w-full cursor-pointer bg-muted group relative hover:h-2.5 transition-[height]"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-foreground"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2.5">
          {/* Left: Track info */}
          <div className="flex items-center gap-3 min-w-0">
            {currentTrack.thumbnail_url ? (
              <Image
                src={currentTrack.thumbnail_url}
                alt={currentTrack.title}
                width={44}
                height={44}
                className="h-11 w-11 rounded-md object-cover shrink-0"
                unoptimized
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-muted text-lg shrink-0">
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

          {/* Center: Controls + time */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-3">
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="p-1.5 rounded-full hover:bg-accent disabled:opacity-30 transition-colors"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={isPlaying ? onPause : onPlay}
                className="p-2.5 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="p-1.5 rounded-full hover:bg-accent disabled:opacity-30 transition-colors"
              >
                <SkipForward size={18} />
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right: Volume */}
          <div className="hidden sm:flex items-center gap-2 justify-end">
            <button onClick={toggleMute} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
              <VolumeIcon size={16} />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={effectiveVolume}
              onChange={handleVolumeChange}
              className="w-24 h-1 accent-foreground cursor-pointer"
            />
          </div>
        </div>
      </div>
    </>
  );
}
