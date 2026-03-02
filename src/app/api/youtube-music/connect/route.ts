import { getRouteUser } from "@/lib/auth";
import { validateCredentials } from "@/lib/youtube-music";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  try {
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

    // Store credentials
    const { error: credError } = await supabase
      .from("yt_music_credentials")
      .upsert({ user_id: user.id, auth_headers });
    if (credError) throw credError;

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ youtube_music_connected: true })
      .eq("id", user.id);
    if (profileError) throw profileError;

    return NextResponse.json({ connected: true });
  } catch (error) {
    console.error("Connect error:", error);
    return NextResponse.json(
      { error: "Failed to connect YouTube Music" },
      { status: 500 }
    );
  }
}
