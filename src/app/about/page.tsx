import { Footer, DisclaimerBanner } from "@/components/layout/Footer";
import { Heart, Shield, TrendingUp, Brain, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const phases = [
  { phase: "Phase 1", title: "AI Prototype", status: "Current", desc: "Multimodal fusion prototype with simulated data pipeline" },
  { phase: "Phase 2", title: "Clinical Validation", status: "Planned", desc: "Prospective studies with clinical endpoints" },
  { phase: "Phase 3", title: "Regulatory Clearance", status: "Future", desc: "FDA/CE pathway for screening device classification" },
  { phase: "Phase 4", title: "Hospital & Health-Tech Integration", status: "Future", desc: "EHR integration and hospital analytics deployment" },
];

const futureDirections = [
  "Wearable SDK",
  "Hospital analytics",
  "EHR integration",
  "Health-tech licensing",
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-navy-900">About BeatAhead</h1>
              <p className="text-sm text-navy-500">Ischemic Stress Index Platform</p>
            </div>
          </div>
          <DisclaimerBanner />
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-navy-900">Our Mission</h2>
          <p className="text-navy-600 leading-relaxed">
            BeatAhead develops an AI framework for early cardiac risk assessment through the Ischemic Stress Index (ISI).
            By fusing continuous physiological signals from wearables and medical devices, we aim to identify
            personalized risk trends that may warrant clinical follow-up — before they become acute events.
          </p>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Activity, title: "Multi-Signal Fusion", desc: "PPG, ECG, SpO₂, and IMU combined into unified analysis" },
            { icon: TrendingUp, title: "Personal Baseline", desc: "Individual-normalized scoring against rolling personal history" },
            { icon: Brain, title: "Explainable AI", desc: "Transparent feature contributions, not black-box predictions" },
            { icon: Shield, title: "Medically Responsible", desc: "Screening indicator only — never a diagnosis" },
          ].map((item) => (
            <div key={item.title} className="p-5 rounded-xl border border-navy-100 bg-white">
              <item.icon className="w-5 h-5 text-navy-700 mb-3" />
              <h3 className="font-semibold text-navy-900">{item.title}</h3>
              <p className="text-sm text-navy-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-navy-900">Roadmap</h2>
          <div className="space-y-3">
            {phases.map((p) => (
              <div key={p.phase} className="flex gap-4 p-4 rounded-xl border border-navy-100 bg-white">
                <div className="shrink-0">
                  <span className="text-xs font-bold text-cardiac">{p.phase}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-navy-900">{p.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.status === "Current" ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-sm text-navy-500 mt-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-navy-900">Future Directions</h2>
          <div className="flex flex-wrap gap-2">
            {futureDirections.map((d) => (
              <span key={d} className="px-3 py-1.5 rounded-full bg-navy-50 text-navy-700 text-sm border border-navy-100">
                {d}
              </span>
            ))}
          </div>
        </section>

        <div className="pt-4">
          <Link href="/dashboard">
            <Button>Explore the Platform</Button>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
