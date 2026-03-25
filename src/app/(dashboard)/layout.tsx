import { getSessionUser } from "@/lib/session";
import { NavSidebar } from "@/components/nav-sidebar";
import { Header } from "@/components/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="flex h-screen">
      <NavSidebar
        userEmail={user?.email ?? null}
        userAvatar={user?.user_metadata?.avatar_url ?? null}
        userName={user?.user_metadata?.full_name ?? null}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header connected={false} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
