"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
}

interface YouTubePlayerProps {
  videoId: string;
  hidden?: boolean;
  onEnded?: () => void;
  onReady?: (handle: YouTubePlayerHandle) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
}

let apiLoaded = false;
let apiReady = false;
const readyCallbacks: (() => void)[] = [];

function loadYTApi() {
  if (apiLoaded) return;
  apiLoaded = true;

  if (window.YT?.Player) {
    apiReady = true;
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks.length = 0;
    return;
  }

  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    apiReady = true;
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks.length = 0;
  };

  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  script.onerror = () => {
    apiLoaded = false;
  };
  document.head.appendChild(script);
}

function onApiReady(cb: () => void) {
  if (apiReady && window.YT?.Player) {
    cb();
  } else {
    readyCallbacks.push(cb);
    loadYTApi();
  }
}

function makeHandle(player: YT.Player): YouTubePlayerHandle {
  return {
    play: () => { try { player.playVideo(); } catch {} },
    pause: () => { try { player.pauseVideo(); } catch {} },
    seekTo: (s) => { try { player.seekTo(s, true); } catch {} },
    getDuration: () => { try { return player.getDuration(); } catch { return 0; } },
    getCurrentTime: () => { try { return player.getCurrentTime(); } catch { return 0; } },
    setVolume: (v) => { try { player.setVolume(v); } catch {} },
    mute: () => { try { player.mute(); } catch {} },
    unmute: () => { try { player.unMute(); } catch {} },
  };
}

export function YouTubePlayer({ videoId, hidden, onEnded, onReady, onPlay, onPause, onProgress }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRefs = useRef({ onEnded, onReady, onPlay, onPause, onProgress });

  useEffect(() => {
    callbackRefs.current = { onEnded, onReady, onPlay, onPause, onProgress };
  });

  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      const p = playerRef.current;
      if (p) {
        try {
          const current = p.getCurrentTime();
          const duration = p.getDuration();
          if (duration > 0) {
            callbackRefs.current.onProgress?.(current, duration);
          }
        } catch {}
      }
    }, 500);
  }, []);

  const stopProgressTracking = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  const initPlayer = useCallback(() => {
    if (!containerRef.current) return;

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }
    stopProgressTracking();

    const div = document.createElement("div");
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(div);

    playerRef.current = new window.YT.Player(div, {
      videoId,
      height: hidden ? "1" : "100%",
      width: hidden ? "1" : "100%",
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          if (!hidden && playerRef.current) {
            try {
              const iframe = playerRef.current.getIframe();
              iframe.style.width = "100%";
              iframe.style.height = "100%";
            } catch {}
          }
          if (playerRef.current) {
            callbackRefs.current.onReady?.(makeHandle(playerRef.current));
          }
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            stopProgressTracking();
            callbackRefs.current.onEnded?.();
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            startProgressTracking();
            callbackRefs.current.onPlay?.();
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            stopProgressTracking();
            callbackRefs.current.onPause?.();
          }
        },
      },
    });
  }, [videoId, hidden, startProgressTracking, stopProgressTracking]);

  useEffect(() => {
    onApiReady(initPlayer);

    return () => {
      stopProgressTracking();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [initPlayer, stopProgressTracking]);

  if (hidden) {
    return (
      <div className="fixed -top-[9999px] -left-[9999px] w-px h-px overflow-hidden" aria-hidden>
        <div ref={containerRef} />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full max-w-sm overflow-hidden rounded-md">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
