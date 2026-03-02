import { getAuthUser } from "@/lib/auth";
import { getSubscription, getSeedSongs, getRecommendations } from "@/lib/store";
import { DiscoverClient } from "./client";

export default async function DiscoverPage() {
  const user = await getAuthUser();
  const [subscription, savedSeeds, likedSongs] = await Promise.all([
    getSubscription(user.id),
    getSeedSongs(user.id),
    getRecommendations(user.id, "liked"),
  ]);

  return (
    <DiscoverClient
      plan={subscription?.plan || "free"}
      initialSeeds={savedSeeds}
      likedSongs={likedSongs}
    />
  );
}
