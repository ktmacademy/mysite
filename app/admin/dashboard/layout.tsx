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
import { ModeToggle } from "@/components/mode-toggle";

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
  // Overview is the landing page, not one item among many — it sits alone.
  {
    label: "",
    items: [
      { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    ],
  },
  // Everything a student sees in the app.
  {
    label: "Content",
    items: [
      { href: "/admin/dashboard/documents", label: "Documents", icon: FileText },
      { href: "/admin/dashboard/courses", label: "Courses", icon: ListVideo },
      { href: "/admin/dashboard/carousel", label: "Carousel", icon: GalleryHorizontalEnd },
      { href: "/admin/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/dashboard/loksewa", label: "Loksewa URLs", icon: Briefcase },
      { href: "/admin/dashboard/onboarding", label: "Onboarding", icon: DoorOpen },
    ],
  },
  // Who they are and what they do.
  {
    label: "People",
    items: [
      { href: "/admin/dashboard/users", label: "Users", icon: Users },
      { href: "/admin/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  // Messages the academy sends out.
  {
    label: "Outbound",
    items: [
      { href: "/admin/dashboard/broadcasts", label: "Broadcasts", icon: Megaphone },
      { href: "/admin/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircle },
    ],
  },
  // Messages that arrive from students.
  {
    label: "Inbox",
    items: [
      { href: "/admin/dashboard/messages", label: "Messages", icon: MessagesSquare },
      { href: "/admin/dashboard/feedback", label: "Feedback", icon: MessageSquare },
      { href: "/admin/dashboard/voice-messages", label: "Voice messages", icon: Mic },
    ],
  },
  // Were under "Support", which they never belonged to.
  {
    label: "Ads",
    items: [
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
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
        <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
          C+
        </span>
        <span className="text-sm font-semibold">CTEVT Plus Admin</span>
      </div>

      <ScrollArea className="flex-1 px-3 pb-4">
        <nav>
          {NAV.map((group) => (
            <div key={group.label} className={group.label ? "mb-4" : "mb-2"}>
              {group.label && (
                <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive(item)
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="size-4" />
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
          onClick={handleLogout}
          className="w-full justify-start gap-2.5 text-muted-foreground hover:bg-sidebar-accent hover:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r md:block">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
            <ModeToggle />
            <span className="hidden sm:inline">{username}</span>
            <Avatar className="size-7">
              <AvatarFallback className="text-xs font-medium">
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
