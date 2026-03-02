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

/**
 * Parse headers from various formats:
 * - cURL command (from "Copy as cURL" in DevTools)
 * - Raw "key: value" lines (from "Copy request headers" in DevTools)
 * - JSON object
 */
function parseHeaders(raw: string): Record<string, string> {
  const trimmed = raw.trim();

  // Try JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON, continue
  }

  // Try cURL format: extract -H 'key: value' or -H "key: value"
  if (trimmed.startsWith("curl ") || trimmed.includes(" -H ")) {
    const headers: Record<string, string> = {};
    // Match -H 'header: value' or -H "header: value" patterns
    const headerPattern = /-H\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = headerPattern.exec(trimmed)) !== null) {
      const colonIndex = match[1].indexOf(":");
      if (colonIndex > 0) {
        const key = match[1].slice(0, colonIndex).trim().toLowerCase();
        const value = match[1].slice(colonIndex + 1).trim();
        if (key && value) headers[key] = value;
      }
    }
    if (Object.keys(headers).length > 0) return headers;
  }

  // Try raw "key: value" format (one per line)
  const headers: Record<string, string> = {};
  for (const line of trimmed.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      if (key && value) headers[key] = value;
    }
  }
  return headers;
}

/** Extract only the auth-relevant headers ytmusicapi needs */
function extractAuthHeaders(
  headers: Record<string, string>
): Record<string, string> | null {
  const authHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const k = key.toLowerCase();
    if (
      k === "cookie" ||
      k === "authorization" ||
      k === "x-goog-authuser" ||
      k === "x-origin" ||
      k === "origin" ||
      k === "user-agent"
    ) {
      authHeaders[k] = value;
    }
  }

  // Cookie is the minimum required header
  if (!authHeaders["cookie"]) return null;
  return authHeaders;
}

export function ConnectFlow({ onConnected }: { onConnected?: () => void }) {
  const [headers, setHeaders] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState(1);

  const handleConnect = async () => {
    if (!headers.trim()) {
      toast.error("Please paste your request headers");
      return;
    }

    const parsed = parseHeaders(headers);
    const authHeaders = extractAuthHeaders(parsed);

    if (!authHeaders) {
      toast.error(
        "Could not find cookie header. Make sure you copied the full request headers or cURL command."
      );
      return;
    }

    setConnecting(true);
    try {
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
          Follow these steps to link your YouTube Music account. It only takes a
          minute.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1 */}
        <button
          type="button"
          onClick={() => setStep(step === 1 ? 0 : 1)}
          className="flex w-full items-start gap-4 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            1
          </span>
          <div className="space-y-1 pt-0.5">
            <p className="font-medium leading-none">
              Open YouTube Music in your browser
            </p>
            {step === 1 && (
              <p className="text-sm text-muted-foreground">
                Go to{" "}
                <a
                  href="https://music.youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  music.youtube.com
                </a>{" "}
                and make sure you&apos;re signed in to your Google account.
              </p>
            )}
          </div>
        </button>

        {/* Step 2 */}
        <button
          type="button"
          onClick={() => setStep(step === 2 ? 0 : 2)}
          className="flex w-full items-start gap-4 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            2
          </span>
          <div className="space-y-1 pt-0.5">
            <p className="font-medium leading-none">
              Open DevTools &rarr; Network tab
            </p>
            {step === 2 && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Press{" "}
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    F12
                  </kbd>{" "}
                  (or{" "}
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    Ctrl+Shift+I
                  </kbd>
                  ) to open Developer Tools, then click the{" "}
                  <span className="font-medium text-foreground">Network</span>{" "}
                  tab at the top.
                </p>
                <p>
                  If the Network tab is empty, refresh the page while it&apos;s
                  open.
                </p>
              </div>
            )}
          </div>
        </button>

        {/* Step 3 */}
        <button
          type="button"
          onClick={() => setStep(step === 3 ? 0 : 3)}
          className="flex w-full items-start gap-4 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            3
          </span>
          <div className="space-y-2 pt-0.5">
            <p className="font-medium leading-none">
              Copy request headers or cURL
            </p>
            {step === 3 && (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  In the Network tab, find any request to{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    music.youtube.com
                  </code>{" "}
                  and right-click it. Then either:
                </p>
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="font-medium text-foreground">
                    Option A &mdash; Copy as cURL (easiest)
                  </p>
                  <p>
                    Right-click the request &rarr;{" "}
                    <span className="font-medium text-foreground">Copy</span>{" "}
                    &rarr;{" "}
                    <span className="font-medium text-foreground">
                      Copy as cURL
                    </span>
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="font-medium text-foreground">
                    Option B &mdash; Copy request headers
                  </p>
                  <p>
                    Click the request &rarr; go to the{" "}
                    <span className="font-medium text-foreground">Headers</span>{" "}
                    tab &rarr; find{" "}
                    <span className="font-medium text-foreground">
                      Request Headers
                    </span>{" "}
                    &rarr; click{" "}
                    <span className="font-medium text-foreground">
                      view source
                    </span>{" "}
                    &rarr; copy all the text
                  </p>
                </div>
              </div>
            )}
          </div>
        </button>

        {/* Step 4 - Paste area */}
        <div className="flex items-start gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            4
          </span>
          <div className="w-full space-y-3 pt-0.5">
            <p className="font-medium leading-none">
              Paste everything below
            </p>
            <Textarea
              placeholder="Paste your copied cURL command or request headers here..."
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
            <Button
              onClick={handleConnect}
              disabled={connecting || !headers.trim()}
              className="w-full"
              size="lg"
            >
              {connecting ? "Validating & connecting..." : "Connect YouTube Music"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
