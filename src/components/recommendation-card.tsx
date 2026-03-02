"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { YouTubePlayer } from "@/components/youtube-player";
import type { Recommendation } from "@/types/database";

interface RecommendationCardProps {
  rec: Recommendation;
  isActive?: boolean;
  onPlay?: () => void;
  onEnded?: () => void;
}

export function RecommendationCard({
  rec,
  isActive,
  onPlay,
  onEnded,
}: RecommendationCardProps) {
  const [playing, setPlaying] = useState(false);
  const showPlayer = (playing || isActive) && rec.video_id;

  return (
    <Card className={isActive ? "ring-2 ring-primary" : ""}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-4">
          {rec.thumbnail_url ? (
            <Image
              src={rec.thumbnail_url}
              alt={rec.title}
              width={64}
              height={64}
              className="h-16 w-16 rounded object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-lg">
              &#9835;
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{rec.title}</p>
            <p className="text-sm text-muted-foreground">{rec.artist}</p>
            {rec.album && (
              <p className="text-xs text-muted-foreground">{rec.album}</p>
            )}
          </div>
          {rec.confidence_score && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.round(rec.confidence_score * 100)}% match
            </span>
          )}
        </div>

        {rec.video_id && (
          <div className="flex gap-2">
            <Button
              variant={showPlayer ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (onPlay) {
                  onPlay();
                } else {
                  setPlaying(!playing);
                }
              }}
            >
              {showPlayer ? "Stop" : "Play"}
            </Button>
          </div>
        )}

        {showPlayer && (
          <YouTubePlayer
            videoId={rec.video_id!}
            onEnded={onEnded}
          />
        )}
      </CardContent>
    </Card>
  );
}
