"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  Bell,
  Briefcase,
  GalleryHorizontalEnd,
  Users,
  MessageCircle,
  Megaphone,
  BarChart3,
  MessageSquare,
  MessagesSquare,
  Mic,
  Settings,
  LayoutGrid,
  ListVideo,
  DoorOpen,
  LogOut,
  Menu,
  X,
  LucideIcon,
} from "lucide-react";
import { adminGet, adminLogout } from "@/lib/admin-api";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Manage",
    items: [
      { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/dashboard/documents", label: "Documents", icon: FileText },
      { href: "/admin/dashboard/courses", label: "Courses", icon: ListVideo },
      { href: "/admin/dashboard/carousel", label: "Carousel", icon: GalleryHorizontalEnd },
      { href: "/admin/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/dashboard/loksewa", label: "Loksewa URLs", icon: Briefcase },
      { href: "/admin/dashboard/onboarding", label: "Onboarding", icon: DoorOpen },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/admin/dashboard/users", label: "Users", icon: Users },
      { href: "/admin/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { href: "/admin/dashboard/broadcasts", label: "Broadcasts", icon: Megaphone },
      { href: "/admin/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/admin/dashboard/messages", label: "Messages", icon: MessagesSquare },
      { href: "/admin/dashboard/feedback", label: "Feedback", icon: MessageSquare },
      { href: "/admin/dashboard/voice-messages", label: "Voice messages", icon: Mic },
      { href: "/admin/dashboard/ads-control", label: "Ads Control", icon: Settings },
      { href: "/admin/dashboard/ad-placements", label: "Ad Placements", icon: LayoutGrid },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { username } = await adminGet<{ username: string }>(
          "/api/admin/me"
        );
        if (cancelled) return;
        setUsername(username || "");
        setReady(true);
      } catch {
        // No valid session cookie -> back to login.
        if (!cancelled) router.replace("/admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await adminLogout();
    router.push("/admin");
  };

  if (!ready) return null;

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-4 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">
          C+
        </span>
        <span className="font-bold">CTEVT+ Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-slate-700 font-semibold text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-300 transition hover:bg-slate-800"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 bg-slate-900 md:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-900">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Open menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
            <span className="hidden sm:inline">{username}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {(username[0] || "A").toUpperCase()}
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
