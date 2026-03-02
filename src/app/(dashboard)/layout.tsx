import { getAuthUser } from "@/lib/auth";
import { getProfile } from "@/lib/store";
import { NavSidebar } from "@/components/nav-sidebar";
import { Header } from "@/components/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const profile = await getProfile(user.id);

  const safeProfile = profile ?? {
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    youtube_music_connected: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header profile={safeProfile} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
