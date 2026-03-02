import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mocks need flexible typing
type AnyWindow = Record<string, any>;

// Track Player constructor calls
const mockDestroy = vi.fn();
let playerConstructorCalls: Array<{ element: unknown; config: Record<string, unknown> }> = [];

class MockPlayer {
  destroy: typeof mockDestroy;
  constructor(element: unknown, config: Record<string, unknown>) {
    playerConstructorCalls.push({ element, config });
    this.destroy = mockDestroy;
  }
}

function setupYTMock() {
  (window as unknown as AnyWindow).YT = {
    Player: MockPlayer,
    PlayerState: {
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    },
  };
}

describe("YouTubePlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    playerConstructorCalls = [];
    document.head.querySelectorAll('script[src*="youtube"]').forEach((s) => s.remove());
    window.onYouTubeIframeAPIReady = undefined;
    delete (window as unknown as AnyWindow).YT;
  });

  afterEach(() => {
    cleanup();
    delete (window as unknown as AnyWindow).YT;
    window.onYouTubeIframeAPIReady = undefined;
  });

  it("renders the container div without crashing", async () => {
    const { YouTubePlayer } = await import("@/components/youtube-player");
    const { container } = render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    const wrapper = container.firstElementChild;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("aspect-video");
    expect(wrapper).toHaveClass("w-full");
  });

  it("appends the YouTube IFrame API script to document.head", async () => {
    const { YouTubePlayer } = await import("@/components/youtube-player");
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);

    const scripts = document.head.querySelectorAll(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    expect(scripts.length).toBe(1);
  });

  it("does not append duplicate script tags for multiple instances", async () => {
    const { YouTubePlayer } = await import("@/components/youtube-player");
    render(<YouTubePlayer videoId="abc123" />);
    render(<YouTubePlayer videoId="def456" />);

    const scripts = document.head.querySelectorAll(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    expect(scripts.length).toBe(1);
  });

  it("creates a YT.Player when the API becomes ready", async () => {
    setupYTMock();
    const { YouTubePlayer } = await import("@/components/youtube-player");

    render(<YouTubePlayer videoId="testVid123" />);

    await act(() => {
      if (window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady();
      }
    });

    expect(playerConstructorCalls).toHaveLength(1);
    expect(playerConstructorCalls[0].config).toMatchObject({
      videoId: "testVid123",
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
      },
    });
  });

  it("calls onEnded when the player state changes to ENDED", async () => {
    setupYTMock();
    const { YouTubePlayer } = await import("@/components/youtube-player");
    const onEnded = vi.fn();

    render(<YouTubePlayer videoId="testVid" onEnded={onEnded} />);

    await act(() => {
      if (window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady();
      }
    });

    const events = playerConstructorCalls[0].config.events as Record<string, (e: { data: number }) => void>;
    const onStateChange = events.onStateChange;

    onStateChange({ data: 0 }); // ENDED
    expect(onEnded).toHaveBeenCalledTimes(1);

    // Non-ENDED state should not call onEnded
    onStateChange({ data: 1 }); // PLAYING
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("destroys the player on unmount", async () => {
    setupYTMock();
    const { YouTubePlayer } = await import("@/components/youtube-player");

    const { unmount } = render(<YouTubePlayer videoId="testVid" />);

    await act(() => {
      if (window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady();
      }
    });

    expect(mockDestroy).not.toHaveBeenCalled();
    unmount();
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
});
