import { getAuthUser } from "@/lib/auth";
import { validateCredentials } from "@/lib/youtube-music";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getAuthUser();
  const { auth_headers } = await request.json();

  if (!auth_headers || typeof auth_headers !== "object") {
    return NextResponse.json(
      { error: "Invalid auth headers" },
      { status: 400 }
    );
  }

  // Validate credentials via Python service
  const validation = await validateCredentials(auth_headers);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid YouTube Music credentials" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Store credentials
  await supabase.from("yt_music_credentials").upsert({
    user_id: user.id,
    auth_headers,
  });

  // Update profile
  await supabase
    .from("profiles")
    .update({ youtube_music_connected: true })
    .eq("id", user.id);

  return NextResponse.json({ connected: true });
}
