"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // The browser client automatically picks up the auth code from the URL
    // and exchanges it using the PKCE code_verifier it stored earlier
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.push("/discover");
        router.refresh();
      }
    });

    // Also handle the case where the session is already set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/discover");
        router.refresh();
      }
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
