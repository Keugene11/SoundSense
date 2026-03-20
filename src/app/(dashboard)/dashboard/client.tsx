"use client";

import { SyncButton } from "@/components/sync-button";
import { ArtistChart } from "@/components/artist-chart";
import { useRouter } from "next/navigation";

interface DashboardClientProps {
  topArtists?: { artist: string; count: number }[];
}

export function DashboardClient({ topArtists }: DashboardClientProps) {
  const router = useRouter();

  if (topArtists) {
    return <ArtistChart data={topArtists} />;
  }

  return <SyncButton onSynced={() => router.refresh()} />;
}
