import { getRouteUser } from "@/lib/auth";
import { getRecommendations } from "@/lib/store";
import { NextResponse } from "next/server";
import type { Recommendation } from "@/types/database";

export async function GET(request: Request) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as
      | Recommendation["status"]
      | null;

    const recommendations = await getRecommendations(
      user.id,
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
