"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SyncButton({ onSynced }: { onSynced?: () => void }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/youtube-music/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success(`Synced ${data.synced} tracks`);
      onSynced?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Sync failed"
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button onClick={handleSync} disabled={syncing} variant="outline">
      {syncing ? "Syncing..." : "Sync History"}
    </Button>
  );
}
