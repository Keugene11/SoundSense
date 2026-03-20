import { getSessionUserId } from "@/lib/session";
import { getRecommendations } from "@/lib/store";
import { NextResponse } from "next/server";
import type { Recommendation } from "@/types/database";

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as
      | Recommendation["status"]
      | null;

    const recommendations = await getRecommendations(
      userId,
      status || undefined
    );

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Get recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
