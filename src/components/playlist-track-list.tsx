"use client";

import Image from "next/image";
import { Play, Pause, Music, ThumbsUp, ThumbsDown } from "lucide-react";
import type { Recommendation } from "@/types/database";

export type TrackFeedback = "liked" | "disliked" | null;

interface PlaylistTrackListProps {
  tracks: Recommendation[];
  currentIndex: number | null;
  isPlaying: boolean;
  feedback: Record<string, TrackFeedback>;
  onTrackClick: (index: number) => void;
  onFeedback: (trackId: string, feedback: TrackFeedback) => void;
}

export function PlaylistTrackList({
  tracks,
  currentIndex,
  isPlaying,
  feedback,
  onTrackClick,
  onFeedback,
}: PlaylistTrackListProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
        <span className="text-center">#</span>
        <span>Title</span>
        <span className="pr-2" />
      </div>

      {/* Tracks */}
      <div>
        {tracks.map((track, index) => {
          const isActive = currentIndex === index;
          const isCurrentlyPlaying = isActive && isPlaying;
          const hasVideo = !!track.video_id;
          const fb = feedback[track.id] ?? null;

          return (
            <div
              key={track.id}
              className={`
                grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-2.5
                transition-colors group
                ${isActive ? "bg-accent" : "hover:bg-accent/50"}
                ${!hasVideo ? "opacity-40" : ""}
              `}
            >
              {/* Track number / play indicator */}
              <button
                onClick={() => hasVideo && onTrackClick(index)}
                disabled={!hasVideo}
                className="flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                {isCurrentlyPlaying ? (
                  <div className="flex items-end gap-[2px] h-4">
                    <span className="w-[3px] bg-foreground rounded-full animate-equalizer-1" />
                    <span className="w-[3px] bg-foreground rounded-full animate-equalizer-2" />
                    <span className="w-[3px] bg-foreground rounded-full animate-equalizer-3" />
                  </div>
                ) : isActive ? (
                  <Pause size={14} className="text-foreground" />
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground group-hover:hidden">
                      {index + 1}
                    </span>
                    {hasVideo && (
                      <Play size={14} className="text-foreground hidden group-hover:block" />
                    )}
                  </>
                )}
              </button>

              {/* Song info — clicking plays */}
              <button
                onClick={() => hasVideo && onTrackClick(index)}
                disabled={!hasVideo}
                className="flex items-center gap-3 min-w-0 text-left cursor-pointer disabled:cursor-not-allowed"
              >
                {track.thumbnail_url ? (
                  <Image
                    src={track.thumbnail_url}
                    alt={track.title}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded object-cover shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                    <Music size={16} className="text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-medium ${
                      isActive ? "text-foreground" : ""
                    }`}
                  >
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {track.artist}
                    {track.album && ` \u00B7 ${track.album}`}
                  </p>
                </div>
              </button>

              {/* Like / Dislike */}
              <div className="flex items-center gap-1 pr-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFeedback(track.id, fb === "liked" ? null : "liked");
                  }}
                  className={`p-1.5 rounded-full transition-colors ${
                    fb === "liked"
                      ? "text-green-500"
                      : "text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100"
                  } ${fb === "liked" ? "opacity-100" : ""}`}
                  title="Like"
                >
                  <ThumbsUp size={14} fill={fb === "liked" ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFeedback(track.id, fb === "disliked" ? null : "disliked");
                  }}
                  className={`p-1.5 rounded-full transition-colors ${
                    fb === "disliked"
                      ? "text-red-500"
                      : "text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100"
                  } ${fb === "disliked" ? "opacity-100" : ""}`}
                  title="Dislike"
                >
                  <ThumbsDown size={14} fill={fb === "disliked" ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
