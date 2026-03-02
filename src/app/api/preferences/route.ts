import { getAuthUser } from "@/lib/auth";
import { getPreferences, upsertPreferences } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  const preferences = await getPreferences(user.id);
  return NextResponse.json({ preferences });
}

export async function PUT(request: Request) {
  const user = await getAuthUser();
  const body = await request.json();

  const preferences = await upsertPreferences({
    user_id: user.id,
    favorite_genres: body.favorite_genres,
    mood: body.mood,
    discovery_level: body.discovery_level,
    exclude_artists: body.exclude_artists,
  });

  return NextResponse.json({ preferences });
}
