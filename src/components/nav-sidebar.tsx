"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/discover", label: "Discover" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

interface NavSidebarProps {
  userEmail: string | null;
  userAvatar: string | null;
  userName: string | null;
}

export function NavSidebar({ userEmail, userAvatar, userName }: NavSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="flex w-64 flex-col border-r bg-muted/30 p-4">
      <Link href="/discover" className="mb-6 text-xl font-bold">
        SoundSense
      </Link>
      <div className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
              pathname === item.href
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* User info */}
      {userEmail && (
        <div className="mt-auto border-t border-border pt-4">
          <div className="flex items-center gap-3">
            {userAvatar ? (
              <Image
                src={userAvatar}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full shrink-0"
                unoptimized
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                {(userName || userEmail)[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {userName || userEmail.split("@")[0]}
              </p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
