"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/recommendation-card";
import { toast } from "sonner";
import type { Recommendation } from "@/types/database";

interface RecommendationsClientProps {
  initialRecs: Recommendation[];
  plan: "free" | "pro";
}

export function RecommendationsClient({
  initialRecs,
  plan,
}: RecommendationsClientProps) {
  const [recommendations, setRecommendations] =
    useState<Recommendation[]>(initialRecs);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          toast.error(data.error, {
            action: data.upgrade
              ? { label: "Upgrade", onClick: () => (window.location.href = "/settings?tab=subscription") }
              : undefined,
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setRecommendations((prev) => [...data.recommendations, ...prev]);
      toast.success(`Generated ${data.recommendations.length} recommendations`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate"
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recommendations</h1>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate Recommendations"}
        </Button>
      </div>

      {recommendations.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No recommendations yet. Click Generate to get started!
        </div>
      ) : (
        <div className="grid gap-4">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
            />
          ))}
        </div>
      )}

      {plan === "free" && (
        <p className="text-center text-sm text-muted-foreground">
          Free plan: 5 recommendations per day.{" "}
          <a href="/settings?tab=subscription" className="underline">
            Upgrade to Pro
          </a>{" "}
          for unlimited.
        </p>
      )}
    </div>
  );
}
