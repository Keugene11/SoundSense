"use client";

import { SyncButton } from "@/components/sync-button";
import { ArtistChart } from "@/components/artist-chart";
import { useRouter } from "next/navigation";

interface DashboardClientProps {
  connected: boolean;
  topArtists?: { artist: string; count: number }[];
}

export function DashboardClient({ connected, topArtists }: DashboardClientProps) {
  const router = useRouter();

  if (topArtists) {
    return <ArtistChart data={topArtists} />;
  }

  if (!connected) return null;

  return <SyncButton onSynced={() => router.refresh()} />;
}
