import { getSessionUserId } from "@/lib/session";
import { getPreferences, upsertPreferences } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    const preferences = await getPreferences(userId);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Get preferences error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getSessionUserId();
    const body = await request.json();

    const preferences = await upsertPreferences({
      user_id: userId,
      favorite_genres: body.favorite_genres,
      mood: body.mood,
      discovery_level: body.discovery_level,
      exclude_artists: body.exclude_artists,
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
