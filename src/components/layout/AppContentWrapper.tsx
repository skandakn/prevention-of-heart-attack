"use client";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppHeader } from "./Sidebar";

export function AppContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLanding = pathname === "/";
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const isOnboarding = pathname.startsWith("/health-record") && searchParams.get("onboarding") === "true";

  if (isLanding || isAuthPage || isOnboarding) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="lg:pl-64">
      <AppHeader />
      <main className="min-h-screen pb-20 lg:pb-0">{children}</main>
    </div>
  );
}
