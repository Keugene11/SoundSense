"use client";

import Image from "next/image";
import { Play, Pause, Music } from "lucide-react";
import type { Recommendation } from "@/types/database";

export type TrackFeedback = "liked" | "disliked" | null;

interface PlaylistTrackListProps {
  tracks: Recommendation[];
  currentIndex: number | null;
  isPlaying: boolean;
  onTrackClick: (index: number) => void;
}

export function PlaylistTrackList({
  tracks,
  currentIndex,
  isPlaying,
  onTrackClick,
}: PlaylistTrackListProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr] items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
        <span className="text-center">#</span>
        <span>Title</span>
      </div>

      {/* Tracks */}
      <div>
        {tracks.map((track, index) => {
          const isActive = currentIndex === index;
          const isCurrentlyPlaying = isActive && isPlaying;
          const hasVideo = !!track.video_id;

          return (
            <button
              key={track.id}
              onClick={() => hasVideo && onTrackClick(index)}
              disabled={!hasVideo}
              className={`
                w-full grid grid-cols-[40px_1fr] items-center gap-3 px-4 py-2.5
                text-left transition-colors group
                ${isActive ? "bg-accent" : "hover:bg-accent/50"}
                ${!hasVideo ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {/* Track number / play indicator */}
              <div className="flex items-center justify-center">
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
              </div>

              {/* Song info */}
              <div className="flex items-center gap-3 min-w-0">
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
                  </p>
                </div>
              </div>

            </button>
          );
        })}
      </div>
    </div>
  );
}
