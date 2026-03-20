import { getSessionUserId } from "@/lib/session";
import { getRecommendations } from "@/lib/store";
import { RecommendationsClient } from "./client";

export default async function RecommendationsPage() {
  const userId = await getSessionUserId();

  let recommendations: Awaited<ReturnType<typeof getRecommendations>> = [];
  try {
    recommendations = await getRecommendations(userId);
  } catch {
    // DB query failed — continue with empty
  }

  return <RecommendationsClient initialRecs={recommendations} />;
}
