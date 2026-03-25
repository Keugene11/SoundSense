import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  let isLoggedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;
  } catch {}

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">SoundSense</h1>
          <p className="text-lg text-muted-foreground">
            Enter a song you love. Get a playlist of songs you&apos;ll actually want to listen to.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            AI-powered music discovery that learns your taste.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {isLoggedIn ? (
              <Link
                href="/discover"
                className="inline-flex items-center justify-center rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80"
              >
                Go to Discover
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
