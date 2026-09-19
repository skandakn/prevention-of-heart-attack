import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BeatAheadAuthProvider } from "@/lib/auth/ClerkAuthWrapper";
import { SimulationProvider } from "@/lib/simulation/SimulationContext";
import { SubscriptionProvider } from "@/lib/subscription/SubscriptionContext";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { Sidebar, MobileNav } from "@/components/layout/Sidebar";
import { AppContentWrapper } from "@/components/layout/AppContentWrapper";
import { Toast } from "@/components/layout/Toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CardiacVoiceWidget } from "@/components/voice/CardiacVoiceWidget";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BeatAhead — Ischemic Stress Index",
  description:
    "AI Framework for Early Cardiac Risk Assessment. Multimodal physiological signal fusion for personalized risk-trend screening.",
  keywords: ["cardiac", "ISI", "wearable", "HRV", "healthcare AI", "physiological monitoring"],
  authors: [{ name: "BeatAhead" }],
  openGraph: {
    title: "BeatAhead — See the Trend Before the Event",
    description:
      "Multimodal AI fusion for personalized cardiac risk-trend screening. Research prototype — not a medical diagnosis.",
    type: "website",
    siteName: "BeatAhead",
  },
  twitter: {
    card: "summary_large_image",
    title: "BeatAhead — Ischemic Stress Index",
    description:
      "Multimodal physiological signal fusion for personalized risk-trend screening.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <BeatAheadAuthProvider>
      <html lang="en">
        <body className={`${inter.variable} font-sans`}>
          <SubscriptionProvider>
            <SimulationProvider>
              <TooltipProvider>
                <DemoBanner />
                <Sidebar />
                <AppContentWrapper>{children}</AppContentWrapper>
                <MobileNav />
                <Toast />
                <CardiacVoiceWidget />
              </TooltipProvider>
            </SimulationProvider>
          </SubscriptionProvider>
        </body>
      </html>
    </BeatAheadAuthProvider>
  );
}
