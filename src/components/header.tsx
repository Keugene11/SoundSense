"use client";

import { Badge } from "@/components/ui/badge";

export function Header({ connected }: { connected: boolean }) {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <h2 className="text-lg font-semibold">SoundSense</h2>
      <Badge variant={connected ? "default" : "secondary"}>
        {connected ? "YouTube Music Connected" : "Not connected"}
      </Badge>
    </header>
  );
}
