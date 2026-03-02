import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/auth";
import { insertSeedSong, deleteSeedSong } from "@/lib/store";

export async function POST(request: Request) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { title, artist } = await request.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const seed = await insertSeedSong(user.id, title.trim(), (artist ?? "").trim());
  return NextResponse.json({ seed });
}

export async function DELETE(request: Request) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await request.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Seed ID is required" }, { status: 400 });
  }

  await deleteSeedSong(id, user.id);
  return NextResponse.json({ deleted: true });
}
