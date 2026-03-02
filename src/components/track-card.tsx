import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { ListeningHistoryEntry } from "@/types/database";

export function TrackCard({ track }: { track: ListeningHistoryEntry }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        {track.thumbnail_url ? (
          <img
            src={track.thumbnail_url}
            alt={track.title}
            className="h-12 w-12 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-xs">
            &#9835;
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{track.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {track.artist}
            {track.album && ` \u2022 ${track.album}`}
          </p>
        </div>
        {track.played_at && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {new Date(track.played_at).toLocaleDateString()}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
