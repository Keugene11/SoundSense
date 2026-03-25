import { getSessionUser } from "@/lib/session";
import { getSeedSongs } from "@/lib/store";
import { DiscoverClient } from "./client";

export default async function DiscoverPage() {
  const user = await getSessionUser();
  const userId = user?.id ?? "anonymous";

  let savedSeeds: Awaited<ReturnType<typeof getSeedSongs>> = [];
  try {
    savedSeeds = await getSeedSongs(userId);
  } catch {}

  return <DiscoverClient initialSeeds={savedSeeds} isLoggedIn={!!user} />;
}
