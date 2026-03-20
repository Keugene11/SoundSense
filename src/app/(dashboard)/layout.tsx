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
  const profile = await getProfile(userId);

  const safeProfile = profile ?? {
    id: userId,
    email: null,
    display_name: null,
    avatar_url: null,
    youtube_music_connected: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header connected={safeProfile.youtube_music_connected} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
