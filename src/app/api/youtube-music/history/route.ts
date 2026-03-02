import { getAuthUser } from "@/lib/auth";
import { getListeningHistory, getTopArtists } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const user = await getAuthUser();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const [history, topArtists] = await Promise.all([
    getListeningHistory(user.id, limit, offset),
    getTopArtists(user.id),
  ]);

  return NextResponse.json({ history, topArtists });
}
