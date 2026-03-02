import { getAuthUser } from "@/lib/auth";
import { getProfile, getPreferences, getSubscription } from "@/lib/store";
import { SettingsClient } from "./client";

export default async function SettingsPage() {
  const user = await getAuthUser();

  const [profile, preferences, subscription] = await Promise.all([
    getProfile(user.id),
    getPreferences(user.id),
    getSubscription(user.id),
  ]);

  return (
    <SettingsClient
      profile={profile!}
      preferences={preferences}
      subscription={subscription}
    />
  );
}
