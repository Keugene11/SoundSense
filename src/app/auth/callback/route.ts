import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host")}`;

  if (code) {
    try {
      const cookieStore = await cookies();

      // Collect cookies that the SDK wants to set so we can apply them to the redirect
      const cookiesToReturn: { name: string; value: string; options: Record<string, unknown> }[] = [];

      const supabase = createServerClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
                cookiesToReturn.push({ name, value, options: options as Record<string, unknown> });
              });
            },
          },
        }
      );

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

        // Build redirect and explicitly copy session cookies onto it
        const response = NextResponse.redirect(`${appUrl}${next}`);
        for (const { name, value, options } of cookiesToReturn) {
          response.cookies.set(name, value, options);
        }
        return response;
      }

      console.error("Auth exchange failed:", error);
    } catch (err) {
      console.error("Auth callback error:", err);
    }
  }

  return NextResponse.redirect(`${appUrl}/login?error=auth`);
}
