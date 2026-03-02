"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Recommendation } from "@/types/database";

interface RecommendationCardProps {
  rec: Recommendation;
  onStatusChange: (id: string, status: Recommendation["status"]) => void;
  isActive?: boolean;
  onPlay?: () => void;
}

export function RecommendationCard({
  rec,
  onStatusChange,
  isActive,
  onPlay,
}: RecommendationCardProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <Card className={isActive ? "ring-2 ring-primary" : ""}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-4">
          {rec.thumbnail_url ? (
            <img
              src={rec.thumbnail_url}
              alt={rec.title}
              className="h-16 w-16 rounded object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-lg">
              &#9835;
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{rec.title}</p>
              {rec.status !== "pending" && (
                <Badge
                  variant={
                    rec.status === "liked"
                      ? "default"
                      : rec.status === "saved"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {rec.status}
                </Badge>
              )}
            </div>
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

        {rec.reason && (
          <p className="text-sm italic text-muted-foreground">
            &ldquo;{rec.reason}&rdquo;
          </p>
        )}

        <div className="flex gap-2">
          {rec.video_id && (
            <Button
              variant={playing || isActive ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (onPlay) {
                  onPlay();
                } else {
                  setPlaying(!playing);
                }
              }}
            >
              {playing || isActive ? "Playing" : "Play"}
            </Button>
          )}
          <Button
            variant={rec.status === "liked" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              onStatusChange(rec.id, rec.status === "liked" ? "pending" : "liked")
            }
          >
            &#128077; Like
          </Button>
          <Button
            variant={rec.status === "disliked" ? "destructive" : "outline"}
            size="sm"
            onClick={() =>
              onStatusChange(
                rec.id,
                rec.status === "disliked" ? "pending" : "disliked"
              )
            }
          >
            &#128078; Dislike
          </Button>
          <Button
            variant={rec.status === "saved" ? "secondary" : "outline"}
            size="sm"
            onClick={() =>
              onStatusChange(rec.id, rec.status === "saved" ? "pending" : "saved")
            }
          >
            &#128278; Save
          </Button>
        </div>

        {(playing || isActive) && rec.video_id && (
          <div className="aspect-video w-full overflow-hidden rounded-md">
            <iframe
              src={`https://www.youtube.com/embed/${rec.video_id}?autoplay=1&enablejsapi=1`}
              className="h-full w-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
