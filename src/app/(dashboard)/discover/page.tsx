import { getSessionUserId } from "@/lib/session";
import { getSeedSongs } from "@/lib/store";
import { DiscoverClient } from "./client";

export default async function DiscoverPage() {
  const userId = await getSessionUserId();
  const savedSeeds = await getSeedSongs(userId);

  return <DiscoverClient initialSeeds={savedSeeds} />;
}
