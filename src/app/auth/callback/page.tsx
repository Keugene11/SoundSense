"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      router.push("/login?error=no_code");
      return;
    }

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error("Auth exchange error:", error.message);
        router.push("/login?error=auth");
      } else {
        router.push("/discover");
        router.refresh();
      }
    });
  }, [router, searchParams]);

  return <p className="text-muted-foreground">Signing you in...</p>;
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<p className="text-muted-foreground">Signing you in...</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
