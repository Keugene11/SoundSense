import { getSessionUserId } from "@/lib/session";
import { getProfile } from "@/lib/store";
import { NavSidebar } from "@/components/nav-sidebar";
import { Header } from "@/components/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();

  let connected = false;
  try {
    const profile = await getProfile(userId);
    connected = profile?.youtube_music_connected ?? false;
  } catch {}

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header connected={connected} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
