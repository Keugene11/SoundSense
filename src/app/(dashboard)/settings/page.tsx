import { Suspense } from "react";
import { getAuthUser } from "@/lib/auth";
import { getProfile, getPreferences, getSubscription } from "@/lib/store";
import { SettingsClient } from "./client";
import { Skeleton } from "@/components/ui/skeleton";

export default async function SettingsPage() {
  const user = await getAuthUser();

  const [profile, preferences, subscription] = await Promise.all([
    getProfile(user.id),
    getPreferences(user.id),
    getSubscription(user.id),
  ]);

  const safeProfile = profile ?? {
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    youtube_music_connected: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <SettingsClient
        profile={safeProfile}
        preferences={preferences}
        subscription={subscription}
      />
    </Suspense>
  );
}
