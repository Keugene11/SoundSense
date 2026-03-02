import { getRouteUser } from "@/lib/auth";
import { startDeviceFlow } from "@/lib/youtube-music";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;

  try {
    const data = await startDeviceFlow();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Device code error:", error);
    return NextResponse.json(
      { error: "Failed to start device flow" },
      { status: 500 }
    );
  }
}
