import { Footer } from "@/components/layout/Footer";

const sections = [
  {
    title: "Why Multimodal Fusion?",
    content: "Individual physiological signals provide incomplete information. PPG captures pulse morphology, ECG reveals electrical activity, SpO₂ tracks oxygenation trends, and IMU detects motion artifacts. Fusing these signals produces a more robust risk assessment than any single modality alone.",
  },
  {
    title: "Why Personal Baseline?",
    content: "Population-wide 'normal' ranges fail to account for individual variation. BeatAhead normalizes ISI against each user's rolling personal baseline — resting heart rate, HRV, SpO₂, and pulse morphology — detecting deviations from their own history rather than arbitrary thresholds.",
  },
  {
    title: "Why Trends?",
    content: "Cardiac stress manifests as changing patterns over time, not isolated readings. Continuous trend analysis identifies gradual elevations, transient spikes, and recovery patterns that point-in-time tests cannot capture.",
  },
  {
    title: "Signal Processing",
    content: "Raw sensor data undergoes Butterworth bandpass filtering, Kalman smoothing, and motion artifact rejection before feature extraction. This pipeline ensures that downstream AI models receive clean, physiologically meaningful inputs.",
  },
  {
    title: "Feature Engineering",
    content: "Key features include HRV (SDNN), pulse morphology (amplitude, rise time, peak characteristics), SpO₂ trends (average, minimum, slope), ECG-derived metrics (heart rate, RR interval, rhythm features), and IMU motion intensity for artifact detection.",
  },
  {
    title: "AI Fusion",
    content: "The prototype uses an XGBoost-inspired scoring engine that weights multimodal features against personal baseline and historical trends. The modular architecture allows direct replacement with a trained production model.",
  },
  {
    title: "ISI Scoring",
    content: "The Ischemic Stress Index produces a 0–100 trend-weighted score normalized against personal baseline. Higher scores indicate greater deviation from the user's recent physiological patterns — not a diagnosis of ischemia or any specific condition.",
  },
  {
    title: "Edge AI & Cloud Analytics",
    content: "Future deployment envisions on-device inference for real-time monitoring with cloud analytics for longitudinal trend analysis, population studies, and model refinement.",
  },
  {
    title: "Clinical Validation Roadmap",
    content: "Clinical validation is still required. The current system is a research prototype. Planned validation includes prospective cohort studies, comparison with gold-standard cardiac assessments, and sensitivity/specificity analysis.",
  },
  {
    title: "Regulatory Pathway",
    content: "BeatAhead aims for classification as a clinical decision support / screening tool, not a diagnostic device. The regulatory pathway will follow FDA Software as a Medical Device (SaMD) guidance with appropriate clinical evidence.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen">
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Methodology</h1>
          <p className="text-sm text-navy-500 mt-1">Technical approach and validation roadmap</p>

        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Important:</strong> Clinical validation is still required. This platform is a research prototype.
        </div>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={section.title} className="p-6 rounded-xl border border-navy-100 bg-white">
              <div className="flex items-start gap-3">
                <span className="text-xs font-bold text-cardiac bg-red-50 px-2 py-1 rounded shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-navy-900">{section.title}</h2>
                  <p className="text-sm text-navy-600 mt-2 leading-relaxed">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
