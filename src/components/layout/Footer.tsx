import { MEDICAL_DISCLAIMER, SIMULATED_DATA_LABEL } from "@/lib/isi/types";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-navy-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-navy-900 mb-2">BeatAhead</h3>
            <p className="text-sm text-navy-500">
              AI Framework for Early Cardiac Risk Assessment through the Ischemic Stress Index.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-navy-900 mb-2">Platform</h3>
            <div className="space-y-1">
              <Link href="/dashboard" className="block text-sm text-navy-500 hover:text-navy-900">Dashboard</Link>
              <Link href="/methodology" className="block text-sm text-navy-500 hover:text-navy-900">Methodology</Link>
              <Link href="/about" className="block text-sm text-navy-500 hover:text-navy-900">About</Link>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-navy-900 mb-2">Important</h3>
            <p className="text-xs text-navy-500 leading-relaxed">{MEDICAL_DISCLAIMER}</p>
          </div>
        </div>
        <div className="pt-6 border-t border-navy-100 flex flex-col sm:flex-row justify-between gap-2 text-xs text-navy-400">
          <span>&copy; {new Date().getFullYear()} BeatAhead. Research prototype.</span>
          <span>{SIMULATED_DATA_LABEL}</span>
        </div>
      </div>
    </footer>
  );
}

export function DisclaimerBanner({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 ${className ?? ""}`}>
      <strong>Research Prototype:</strong> {MEDICAL_DISCLAIMER}
    </div>
  );
}
