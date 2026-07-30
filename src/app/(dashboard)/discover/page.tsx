import { getSessionUser } from "@/lib/session";
import { DiscoverClient } from "./client";

export default async function DiscoverPage() {
  const user = await getSessionUser();
  return <DiscoverClient isLoggedIn={!!user} />;
}
