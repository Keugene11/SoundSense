import { getRouteUser } from "@/lib/auth";
import { completeDeviceFlow } from "@/lib/youtube-music";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  try {
    const { device_code } = await request.json();

    if (!device_code || typeof device_code !== "string") {
      return NextResponse.json(
        { error: "Missing device_code" },
        { status: 400 }
      );
    }

    // Exchange device code for OAuth tokens via Python service
    const { oauth_tokens } = await completeDeviceFlow(device_code);

    // Store tokens
    const { error: credError } = await supabase
      .from("yt_music_credentials")
      .upsert({ user_id: user.id, oauth_tokens });
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
