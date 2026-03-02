import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
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
        await supabase.from("profiles").insert({
          id: data.user.id,
          email: data.user.email,
          display_name:
            data.user.user_metadata?.full_name || data.user.email?.split("@")[0],
          avatar_url: data.user.user_metadata?.avatar_url,
        });

        await supabase.from("user_preferences").insert({
          user_id: data.user.id,
        });

        await supabase.from("subscriptions").insert({
          user_id: data.user.id,
          plan: "free",
          status: "active",
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
