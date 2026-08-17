"use client";

import { motion } from "framer-motion";
import { Camera, Activity, Scan } from "lucide-react";

export function ProblemSection() {
  return (
    <section className="py-20 px-4 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-navy-900">
            Traditional cardiac testing is often a snapshot.
          </h2>
          <p className="mt-4 text-navy-600 max-w-2xl mx-auto">
            Point-in-time assessments miss the continuous physiological changes that occur between clinical visits.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Snapshot tests */}
          <div>
            <h3 className="text-sm font-semibold text-navy-500 uppercase tracking-wider mb-4">
              Point-in-Time Assessments
            </h3>
            <div className="space-y-3">
              {[
                { icon: Activity, label: "ECG", desc: "Single recording at one moment" },
                { icon: Scan, label: "Stress Test", desc: "Induced exertion snapshot" },
                { icon: Camera, label: "Angiography", desc: "Invasive imaging procedure" },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-navy-100 bg-navy-50/50"
                >
                  <div className="p-2 rounded-lg bg-white border border-navy-100">
                    <item.icon className="w-5 h-5 text-navy-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-navy-900">{item.label}</p>
                    <p className="text-xs text-navy-500">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Continuous monitoring */}
          <div>
            <h3 className="text-sm font-semibold text-cardiac uppercase tracking-wider mb-4">
              Continuous Physiological Trends
            </h3>
            <div className="rounded-xl border-2 border-red-100 bg-gradient-to-br from-red-50/50 to-white p-6">
              <div className="h-32 relative">
                <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  <motion.path
                    d="M0,70 Q30,65 60,60 T120,55 T180,45 T240,50 T300,42"
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="2"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2 }}
                  />
                  <motion.path
                    d="M0,80 Q30,78 60,75 T120,72 T180,68 T240,70 T300,65"
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="1.5"
                    strokeOpacity="0.3"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: 0.3 }}
                  />
                </svg>
              </div>
              <p className="text-sm text-navy-700 mt-4 leading-relaxed">
                BeatAhead analyzes <strong>changing physiological patterns</strong> rather than isolated readings,
                combining wearable signals into a personalized ischemic-risk trend that existing devices expose separately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
