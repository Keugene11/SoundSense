"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export function ConnectFlow({ onConnected }: { onConnected?: () => void }) {
  const [headers, setHeaders] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!headers.trim()) {
      toast.error("Please paste your request headers");
      return;
    }

    setConnecting(true);
    try {
      // Parse headers - support both JSON and raw header format
      let authHeaders: Record<string, string>;
      try {
        authHeaders = JSON.parse(headers);
      } catch {
        // Try to parse as raw headers (key: value format)
        authHeaders = {};
        for (const line of headers.split("\n")) {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            if (key && value) authHeaders[key] = value;
          }
        }
      }

      const res = await fetch("/api/youtube-music/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_headers: authHeaders }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("YouTube Music connected!");
      onConnected?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connection failed"
      );
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect YouTube Music</CardTitle>
        <CardDescription>
          Paste your YouTube Music request headers to connect your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-medium">How to get your headers:</h3>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Open YouTube Music in your browser and log in</li>
            <li>
              Open Developer Tools (F12) and go to the Network tab
            </li>
            <li>
              Click on any request to music.youtube.com
            </li>
            <li>
              Copy the request headers (especially Cookie, Authorization, and
              X-Goog-AuthUser)
            </li>
            <li>Paste them below in &quot;key: value&quot; format or as JSON</li>
          </ol>
        </div>

        <Textarea
          placeholder={`cookie: your_cookie_here\nauthorization: SAPISIDHASH ...\nx-goog-authuser: 0`}
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />

        <Button
          onClick={handleConnect}
          disabled={connecting || !headers.trim()}
          className="w-full"
        >
          {connecting ? "Connecting..." : "Connect YouTube Music"}
        </Button>
      </CardContent>
    </Card>
  );
}
