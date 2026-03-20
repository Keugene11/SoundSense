import { cookies } from "next/headers";

const COOKIE_NAME = "soundsense_session";

/** Read the anonymous session user ID from the cookie. */
export async function getSessionUserId(): Promise<string> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session?.value) {
    throw new Error("No session cookie — middleware should have set it");
  }
  return session.value;
}
