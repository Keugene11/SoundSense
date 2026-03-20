import { cookies } from "next/headers";

const COOKIE_NAME = "soundsense_session";

/** Read the anonymous session user ID from the cookie. */
export async function getSessionUserId(): Promise<string> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (session?.value) {
    return session.value;
  }

  // Fallback: on the very first request the middleware sets the cookie
  // but the server component may not see it yet. Use a stable fallback
  // that will be replaced on the next request once the cookie lands.
  return "anonymous";
}
