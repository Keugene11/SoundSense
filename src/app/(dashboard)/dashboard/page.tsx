import { getSessionUserId } from "@/lib/session";
import {
  getProfile,
  getListeningHistory,
  getTopArtists,
  getRecommendations,
  getLatestSync,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrackCard } from "@/components/track-card";
import { DashboardClient } from "./client";

export default async function DashboardPage() {
  const userId = await getSessionUserId();

  let profile = null;
  let history: Awaited<ReturnType<typeof getListeningHistory>> = [];
  let topArtists: Awaited<ReturnType<typeof getTopArtists>> = [];
  let recentRecs: Awaited<ReturnType<typeof getRecommendations>> = [];
  let latestSync: Awaited<ReturnType<typeof getLatestSync>> = null;

  try {
    [profile, history, topArtists, recentRecs, latestSync] = await Promise.all([
      getProfile(userId),
      getListeningHistory(userId, 10),
      getTopArtists(userId, 8),
      getRecommendations(userId),
      getLatestSync(userId),
    ]);
  } catch {}

  const connected = profile?.youtube_music_connected ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {connected && <DashboardClient />}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tracks Synced</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{history.length}+</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recommendations</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{recentRecs.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {latestSync?.completed_at ? new Date(latestSync.completed_at).toLocaleString() : "Never"}
            </p>
          </CardContent>
        </Card>
      </div>

      {topArtists.length > 0 && <DashboardClient topArtists={topArtists} />}

      {history.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Recently Played</h2>
          <div className="grid gap-2">
            {history.slice(0, 10).map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        </div>
      )}

      {!connected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-lg font-medium">Get started by connecting YouTube Music</p>
            <p className="text-muted-foreground">Connect your account to start getting AI-powered recommendations</p>
            <a href="/connect">
              <Badge variant="default" className="cursor-pointer px-4 py-2 text-sm">Connect Now</Badge>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
