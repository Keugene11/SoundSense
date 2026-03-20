import { getSessionUserId } from "@/lib/session";
import { completeDeviceFlow } from "@/lib/youtube-music";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    const { device_code } = await request.json();

    if (!device_code || typeof device_code !== "string") {
      return NextResponse.json(
        { error: "Missing device_code" },
        { status: 400 }
      );
    }

    // Exchange device code for OAuth tokens via Python service
    const { oauth_tokens } = await completeDeviceFlow(device_code);

    const supabase = createAdminClient();

    // Store tokens
    const { error: credError } = await supabase
      .from("yt_music_credentials")
      .upsert({ user_id: userId, oauth_tokens });
    if (credError) throw credError;

    // Upsert profile with youtube_music_connected = true
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        { id: userId, youtube_music_connected: true },
        { onConflict: "id" }
      );
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
