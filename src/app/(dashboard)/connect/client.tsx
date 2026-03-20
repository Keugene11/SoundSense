"use client";

import { useRouter } from "next/navigation";
import { ConnectFlow } from "@/components/connect-flow";

export function ConnectPageClient() {
  const router = useRouter();
  return <ConnectFlow onConnected={() => router.refresh()} />;
}
