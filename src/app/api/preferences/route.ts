import { getRouteUser } from "@/lib/auth";
import { getPreferences, upsertPreferences } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const preferences = await getPreferences(user.id);
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
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const body = await request.json();

    const preferences = await upsertPreferences({
      user_id: user.id,
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
