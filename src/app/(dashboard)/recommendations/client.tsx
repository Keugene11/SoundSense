"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [filter, setFilter] = useState<string>("all");

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

  const handleStatusChange = async (
    id: string,
    status: Recommendation["status"]
  ) => {
    try {
      const res = await fetch("/api/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed to update");

      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } catch {
      toast.error("Failed to update recommendation");
    }
  };

  const filtered =
    filter === "all"
      ? recommendations
      : recommendations.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recommendations</h1>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate Recommendations"}
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({recommendations.length})</TabsTrigger>
          <TabsTrigger value="pending">
            New ({recommendations.filter((r) => r.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="liked">
            Liked ({recommendations.filter((r) => r.status === "liked").length})
          </TabsTrigger>
          <TabsTrigger value="saved">
            Saved ({recommendations.filter((r) => r.status === "saved").length})
          </TabsTrigger>
          <TabsTrigger value="disliked">
            Disliked (
            {recommendations.filter((r) => r.status === "disliked").length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="mt-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {recommendations.length === 0
                ? "No recommendations yet. Click Generate to get started!"
                : "No recommendations in this category."}
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
