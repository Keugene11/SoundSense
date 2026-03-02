import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/** For Server Components / layouts — redirects to /login if unauthenticated */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

/** For Route Handlers — returns { user, supabase } or a 401 Response */
export async function getRouteUser(): Promise<
  | { user: User; supabase: Awaited<ReturnType<typeof createClient>>; error?: never }
  | { user?: never; supabase?: never; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, supabase };
}
