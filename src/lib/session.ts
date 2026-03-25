import { createClient } from "@/lib/supabase/server";

/** Get the authenticated user's ID. Falls back to "anonymous" if not logged in. */
export async function getSessionUserId(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

/** Get the authenticated user's info. */
export async function getSessionUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
