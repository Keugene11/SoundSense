import { getAuthUser } from "@/lib/auth";
import { getProfile } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectPageClient } from "./client";

export default async function ConnectPage() {
  const user = await getAuthUser();
  const profile = await getProfile(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Connect YouTube Music</h1>
        <Badge variant={profile?.youtube_music_connected ? "default" : "secondary"}>
          {profile?.youtube_music_connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      {profile?.youtube_music_connected ? (
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
