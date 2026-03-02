import { getAuthUser } from "@/lib/auth";
import { getRecommendations, getSubscription } from "@/lib/store";
import { RecommendationsClient } from "./client";

export default async function RecommendationsPage() {
  const user = await getAuthUser();

  const [recommendations, subscription] = await Promise.all([
    getRecommendations(user.id),
    getSubscription(user.id),
  ]);

  return (
    <RecommendationsClient
      initialRecs={recommendations}
      plan={subscription?.plan || "free"}
    />
  );
}
