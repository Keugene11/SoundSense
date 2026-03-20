import { getSessionUserId } from "@/lib/session";
import { getSeedSongs } from "@/lib/store";
import { DiscoverClient } from "./client";

export default async function DiscoverPage() {
  const userId = await getSessionUserId();

  let savedSeeds: Awaited<ReturnType<typeof getSeedSongs>> = [];
  try {
    savedSeeds = await getSeedSongs(userId);
  } catch {
    // DB query failed — continue with empty seeds
  }

  return <DiscoverClient initialSeeds={savedSeeds} />;
}
