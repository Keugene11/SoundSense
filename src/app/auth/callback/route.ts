import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Use the app URL for redirects (more reliable on Vercel than request origin)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        // Create profile + defaults if they don't exist
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .single();

        if (!existingProfile) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              email: data.user.email,
              display_name:
                data.user.user_metadata?.full_name ||
                data.user.email?.split("@")[0] ||
                "User",
              avatar_url: data.user.user_metadata?.avatar_url,
            });
          if (profileError) {
            console.error("Profile creation failed:", profileError);
          }

          // These depend on profile existing (FK), so only run if profile succeeded
          if (!profileError) {
            const [prefsResult, subResult] = await Promise.all([
              supabase.from("user_preferences").insert({
                user_id: data.user.id,
              }),
              supabase.from("subscriptions").insert({
                user_id: data.user.id,
                plan: "free",
                status: "active",
              }),
            ]);

            if (prefsResult.error)
              console.error("Preferences creation failed:", prefsResult.error);
            if (subResult.error)
              console.error("Subscription creation failed:", subResult.error);
          }
        }

        return NextResponse.redirect(`${appUrl}${next}`);
      }

      console.error("Auth exchange failed:", error);
      return NextResponse.redirect(
        `${appUrl}/login?error=exchange&detail=${encodeURIComponent(error?.message || "unknown")}`
      );
    } catch (err) {
      console.error("Auth callback error:", err);
      return NextResponse.redirect(
        `${appUrl}/login?error=exception&detail=${encodeURIComponent(String(err))}`
      );
    }
  }

  return NextResponse.redirect(`${appUrl}/login?error=no_code`);
}
