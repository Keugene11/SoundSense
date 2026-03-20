import { getSessionUserId } from "@/lib/session";
import { getListeningHistory, getTopArtists } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [history, topArtists] = await Promise.all([
      getListeningHistory(userId, limit, offset),
      getTopArtists(userId),
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
