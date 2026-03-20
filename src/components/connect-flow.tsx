"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type FlowState =
  | { step: "idle" }
  | {
      step: "code";
      userCode: string;
      verificationUrl: string;
      deviceCode: string;
    }
  | { step: "waiting"; userCode: string }
  | { step: "success" };

export function ConnectFlow({ onConnected }: { onConnected?: () => void }) {
  const [state, setState] = useState<FlowState>({ step: "idle" });

  const startFlow = async () => {
    try {
      const res = await fetch("/api/youtube-music/device-code", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start device flow");

      setState({
        step: "code",
        userCode: data.user_code,
        verificationUrl: data.verification_url,
        deviceCode: data.device_code,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start device flow"
      );
    }
  };

  const completeFlow = async (deviceCode: string, userCode: string) => {
    setState({ step: "waiting", userCode });

    try {
      const res = await fetch("/api/youtube-music/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: deviceCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");

      setState({ step: "success" });
      toast.success("YouTube Music connected!");
      onConnected?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connection failed"
      );
      setState({ step: "idle" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect YouTube Music</CardTitle>
        <CardDescription>
          Link your YouTube Music account to get personalized recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.step === "idle" && (
          <Button onClick={startFlow} className="w-full" size="lg">
            Connect YouTube Music
          </Button>
        )}

        {state.step === "code" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Enter this code on Google:
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(state.userCode);
                  toast.success("Code copied!");
                }}
                className="inline-block rounded-md bg-muted px-6 py-3 font-mono text-2xl font-bold tracking-widest transition-colors hover:bg-muted/80"
              >
                {state.userCode}
              </button>
              <p className="text-xs text-muted-foreground">Click to copy</p>
            </div>

            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <a
                  href={state.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Google
                </a>
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  completeFlow(state.deviceCode, state.userCode)
                }
              >
                I&apos;ve entered the code
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setState({ step: "idle" })}
            >
              Cancel
            </Button>
          </div>
        )}

        {state.step === "waiting" && (
          <div className="space-y-4 text-center py-4">
            <div className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 animate-spin text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm text-muted-foreground">
                Waiting for authorization...
              </p>
            </div>
            <p className="font-mono text-lg font-bold tracking-widest">
              {state.userCode}
            </p>
          </div>
        )}

        {state.step === "success" && (
          <div className="text-center py-4">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              YouTube Music connected successfully!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
