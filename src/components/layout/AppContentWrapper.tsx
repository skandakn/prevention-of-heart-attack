"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "./Sidebar";

export function AppContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isLanding || isAuthPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="lg:pl-64">
      <AppHeader />
      <main className="min-h-screen pb-20 lg:pb-0">{children}</main>
    </div>
  );
}
