"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bot, Calendar, TrendingUp, ListOrdered, BookOpen, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Today", icon: Home },
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/plan", label: "Plan", icon: Calendar },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/splits", label: "Splits", icon: ListOrdered },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="max-w-md mx-auto flex">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-0.5 text-[10px] transition-colors ${
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
