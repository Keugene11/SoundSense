import { getSessionUserId } from "@/lib/session";
import { getProfile } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectPageClient } from "./client";

export default async function ConnectPage() {
  const userId = await getSessionUserId();

  let connected = false;
  try {
    const profile = await getProfile(userId);
    connected = profile?.youtube_music_connected ?? false;
  } catch {
    // DB query failed — continue with defaults
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Connect YouTube Music</h1>
        <Badge variant={connected ? "default" : "secondary"}>
          {connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      {connected ? (
        <Card>
          <CardHeader>
            <CardTitle>YouTube Music is connected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your account is linked. You can sync your listening history from
              the dashboard or reconnect with new credentials below.
            </p>
            <ConnectPageClient />
          </CardContent>
        </Card>
      ) : (
        <ConnectPageClient />
      )}
    </div>
  );
}
