"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBeatAheadAuth, SafeUserButton } from "@/lib/auth/ClerkAuthWrapper";

import {
  Activity,
  BarChart3,
  Brain,
  Heart,
  LayoutDashboard,
  Menu,
  Radio,
  Stethoscope,
  X,
  BookOpen,
  Info,
  CreditCard,
  PhoneCall,
  FileText,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { useState } from "react";
import { DemoModePanel } from "./DemoModePanel";
import { SystemStatusPanel } from "./SystemStatusPanel";
import { SettingsButton } from "./SettingsPanel";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/helpline", label: "Cardiac Helpline", icon: PhoneCall },
  { href: "/calls", label: "Call Records", icon: FileText },
  { href: "/monitor", label: "Live Monitor", icon: Radio },
  { href: "/signals", label: "Signals", icon: Activity },
  { href: "/trends", label: "Trends", icon: BarChart3 },
  { href: "/insights", label: "AI Insights", icon: Brain },
  { href: "/clinician", label: "Clinician View", icon: Stethoscope },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
  { href: "/about", label: "About", icon: Info },
];

export function Sidebar() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isLanding || isAuthPage) return null;

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40 border-r border-navy-100 bg-white">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-100">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-navy-900">
          <Heart className="w-5 h-5 text-white" fill="white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-navy-900">BeatAhead</h1>
          <p className="text-xs text-navy-500">ISI Platform</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-navy-900 text-white"
                  : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-3 border-t border-navy-100">
        <SystemStatusPanel compact />
        <DemoModePanel compact />
        <SidebarSignOutButton />
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-xs text-navy-500">Settings</span>
          <SettingsButton />
        </div>
      </div>
    </aside>
  );
}

function SidebarSignOutButton() {
  const { isSignedIn, signOut, user } = useBeatAheadAuth();
  if (!isSignedIn) return null;
  return (
    <div className="pt-1 border-t border-navy-100 flex items-center justify-between px-1 text-xs">
      <span className="font-semibold text-navy-800 truncate max-w-[110px]">
        {user?.fullName || "Account"}
      </span>
      <button
        onClick={() => signOut()}
        className="text-red-600 hover:text-red-800 font-bold hover:underline"
      >
        Sign Out
      </button>
    </div>
  );
}


export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isLanding = pathname === "/";
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isLanding || isAuthPage) return null;

  const mobileItems = navItems.slice(0, 5);

  return (
    <>
      {/* Bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-navy-100 safe-area-pb">
        <div className="flex items-center justify-around py-2">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs transition-colors",
                  isActive ? "text-navy-900" : "text-navy-400"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "text-cardiac")} />
                <span className="truncate max-w-[60px]">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-navy-400"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-elevated p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-navy-900">Menu</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-navy-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                      isActive ? "bg-navy-900 text-white" : "text-navy-600 hover:bg-navy-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-6 space-y-3">
              <SystemStatusPanel />
              <DemoModePanel />
              <div className="flex items-center justify-between px-1 pt-2 border-t border-navy-100">
                <span className="text-xs text-navy-500">Settings</span>
                <SettingsButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { isSignedIn } = useBeatAheadAuth();
  const isLanding = pathname === "/";
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isLanding || isAuthPage) return null;

  const titles: Record<string, string> = {
    "/dashboard": "Live Physiological Monitoring",
    "/monitor": "Live Signal Monitoring",
    "/signals": "Feature Analysis",
    "/trends": "Long-term Trends",
    "/insights": "AI Insights",
    "/clinician": "Clinician Dashboard",
    "/pricing": "Pricing & Plans",
    "/methodology": "Methodology",
    "/about": "About BeatAhead",
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-navy-100">
      <div className="flex items-center justify-between px-4 lg:px-8 py-4">
        <div className="lg:hidden flex items-center gap-2">
          <Heart className="w-5 h-5 text-cardiac" fill="#DC2626" />
          <span className="font-bold text-navy-900">BeatAhead</span>
        </div>
        <h2 className="hidden lg:block text-xl font-semibold text-navy-900">
          {titles[pathname] || "BeatAhead"}
        </h2>
        <div className="flex items-center gap-2 sm:gap-3">
          <HeaderProStatusBadge />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Simulated Data
          </span>
          <SettingsButton />

          <div className="ml-1 pl-2 border-l border-navy-200 flex items-center">
            {isSignedIn ? (
              <SafeUserButton
                showName
                appearance={{
                  elements: {
                    userButtonBox: "flex flex-row-reverse items-center gap-2",
                    userButtonOuterIdentifier: "text-xs font-semibold text-navy-800 hidden sm:inline-block",
                  },
                }}
              />
            ) : (
              <Link href="/sign-in">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-semibold">
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}



function HeaderProStatusBadge() {
  const { subscriptionStatus, demoMode } = useSubscription();

  if (subscriptionStatus === "active") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-extrabold">
        PRO ✓
      </span>
    );
  }

  if (demoMode) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
        DEMO PRO ✓
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-navy-100 text-navy-700 text-xs font-medium">
      FREE USER
    </span>
  );
}

