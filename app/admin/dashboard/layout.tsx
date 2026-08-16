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
  LucideIcon,
} from "lucide-react";
import { adminGet, adminLogout } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
        const { username } = await adminGet<{ username: string }>("/api/admin/me");
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
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          C+
        </span>
        <span className="font-bold">CTEVT+ Admin</span>
      </div>

      <ScrollArea className="flex-1 px-3 pb-4">
        <nav>
          {NAV.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    isActive(item)
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="size-[18px]" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />
      <div className="p-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-destructive hover:bg-sidebar-accent hover:text-destructive"
        >
          <LogOut className="size-[18px]" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 md:block">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              }
            />
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{username}</span>
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                {(username[0] || "A").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
