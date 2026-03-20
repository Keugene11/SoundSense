import { getSessionUserId } from "@/lib/session";
import { getSeedSongs } from "@/lib/store";
import { DiscoverClient } from "./discover-client";

export default async function Home() {
  const userId = await getSessionUserId();

  let savedSeeds: Awaited<ReturnType<typeof getSeedSongs>> = [];
  try {
    savedSeeds = await getSeedSongs(userId);
  } catch {
    // DB unavailable — continue with empty
  }

  return <DiscoverClient initialSeeds={savedSeeds} />;
}
