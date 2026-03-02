import { getAuthUser } from "@/lib/auth";
import { getSubscription, getSeedSongs } from "@/lib/store";
import { DiscoverClient } from "./client";

export default async function DiscoverPage() {
  const user = await getAuthUser();
  const [subscription, savedSeeds] = await Promise.all([
    getSubscription(user.id),
    getSeedSongs(user.id),
  ]);

  return (
    <DiscoverClient
      plan={subscription?.plan || "free"}
      initialSeeds={savedSeeds}
    />
  );
}
