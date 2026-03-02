import { getRouteUser } from "@/lib/auth";
import { getListeningHistory, getTopArtists } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [history, topArtists] = await Promise.all([
      getListeningHistory(user.id, limit, offset),
      getTopArtists(user.id),
    ]);

    return NextResponse.json({ history, topArtists });
  } catch (error) {
    console.error("History error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
