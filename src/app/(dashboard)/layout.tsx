import { getAuthUser } from "@/lib/auth";
import { getProfile } from "@/lib/store";
import { NavSidebar } from "@/components/nav-sidebar";
import { Header } from "@/components/header";
import type { Profile } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const profile = (await getProfile(user.id)) as Profile;

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
