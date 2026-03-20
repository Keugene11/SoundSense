import { getSessionUserId } from "@/lib/session";
import { getRecommendations } from "@/lib/store";
import { RecommendationsClient } from "./client";

export default async function RecommendationsPage() {
  const userId = await getSessionUserId();
  const recommendations = await getRecommendations(userId);

  return <RecommendationsClient initialRecs={recommendations} />;
}
