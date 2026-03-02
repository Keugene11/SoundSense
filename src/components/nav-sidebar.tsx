"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/discover", label: "Discover" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/connect", label: "Connect" },
  { href: "/settings", label: "Settings" },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-64 flex-col gap-1 border-r bg-muted/30 p-4">
      <Link href="/dashboard" className="mb-6 text-xl font-bold">
        SoundSense
      </Link>
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
    </nav>
  );
}
