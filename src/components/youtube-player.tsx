"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  onEnded?: () => void;
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function loadYTApi() {
  if (apiLoaded) return;
  apiLoaded = true;

  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    apiReady = true;
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks.length = 0;
  };

  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(script);
}

function onApiReady(cb: () => void) {
  if (apiReady) {
    cb();
  } else {
    readyCallbacks.push(cb);
    loadYTApi();
  }
}

export function YouTubePlayer({ videoId, onEnded }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const initPlayer = useCallback(() => {
    if (!containerRef.current) return;

    // Destroy existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }

    const div = document.createElement("div");
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(div);

    playerRef.current = new window.YT.Player(div, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onStateChange: (event: YT.OnStateChangeEvent) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            onEndedRef.current?.();
          }
        },
      },
    });
  }, [videoId]);

  useEffect(() => {
    onApiReady(initPlayer);

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [initPlayer]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-md">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
