"use client";

import Link from "next/link";
import { useBeatAheadAuth } from "@/lib/auth/ClerkAuthWrapper";
import { motion } from "framer-motion";
import { ArrowRight, Heart, Activity, Brain, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { LandingNav } from "@/components/landing/LandingNav";
import { PipelineSection } from "@/components/landing/PipelineSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { HeroVisualization } from "@/components/landing/HeroVisualization";

export default function LandingPage() {
  const { isSignedIn } = useBeatAheadAuth();


  return (
    <div className="min-h-screen">
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-16 px-4 lg:px-8 bg-white min-h-[680px] lg:min-h-[720px]">
        <div className="absolute inset-y-20 right-0 w-full lg:w-[66%] opacity-80 lg:opacity-100">
          <HeroVisualization className="h-full" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-cardiac text-xs font-medium border border-red-100 mb-6">
                <Activity className="w-3 h-3" />
                Ischemic Stress Index (ISI)
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-navy-900 leading-tight">
                See the Trend{" "}
                <span className="text-cardiac">Before the Event.</span>
              </h1>
              <p className="mt-6 text-lg text-navy-600 leading-relaxed max-w-xl">
                BeatAhead&apos;s Ischemic Stress Index fuses continuous physiological signals
                into a personalized risk-trend indicator designed to identify changes that
                may warrant clinical follow-up.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {isSignedIn ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="gap-2 font-semibold">
                      Open Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/sign-up">
                      <Button size="lg" className="gap-2 font-semibold">
                        Get Started
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href="/sign-in">
                      <Button size="lg" variant="outline" className="font-semibold">
                        Sign In
                      </Button>
                    </Link>
                  </>
                )}
                <Link href="/methodology">
                  <Button size="lg" variant="outline">
                    How ISI Works
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-xs text-navy-400 max-w-md">
                Research prototype screening system — not a medical diagnostic device.
              </p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Features strip */}
      <section className="py-12 border-y border-navy-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Activity, title: "Multi-Signal Fusion", desc: "PPG, ECG, SpO₂, IMU combined" },
              { icon: TrendingUp, title: "Personal Baseline", desc: "Individual-normalized scoring" },
              { icon: Brain, title: "AI Fusion Model", desc: "Explainable trend analysis" },
              { icon: Heart, title: "Continuous Trends", desc: "Beyond snapshot testing" },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-navy-50">
                  <f.icon className="w-5 h-5 text-navy-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy-900 text-sm">{f.title}</h3>
                  <p className="text-xs text-navy-500 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProblemSection />
      <PipelineSection />

      {/* CTA */}
      <section className="py-20 px-4 lg:px-8 bg-navy-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">Ready to explore the platform?</h2>
          <p className="mt-4 text-navy-300">
            Experience the full BeatAhead dashboard with live simulated physiological monitoring.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            {isSignedIn ? (
              <Link href="/dashboard">
                <Button size="lg" variant="accent" className="gap-2">
                  Launch Live Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/sign-up">
                <Button size="lg" variant="accent" className="gap-2 font-semibold">
                  Create Account & Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

