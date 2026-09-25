"use client";

import { useEffect, useState, useCallback } from "react";
import { useBeatAheadAuth } from "@/lib/auth/ClerkAuthWrapper";
import {
  createEmptyPatientRecord,
  BLOOD_PRESSURE_OPTIONS,
  CHOLESTEROL_STATUS_OPTIONS,
  SMOKING_STATUS_OPTIONS,
  ALCOHOL_USE_OPTIONS,
  EXERCISE_FREQUENCY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  DIET_TYPE_OPTIONS,
  type PatientRecord,
} from "@/lib/patient-record";
import { Button } from "@/components/ui/button";
import {
  Heart, HeartPulse, Droplets, Activity, Zap,
  Wind, X, CheckCircle2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Session flag ─────────────────────────────────────────────────────────────
// Set on every sign-in. Cleared once the vitals modal is dismissed.
export const VITALS_SESSION_KEY = "beatahead-vitals-session-checked";

function prettify(s: string) {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bpRiskLabel(sys: number | null, dia: number | null) {
  if (!sys && !dia) return { label: "", color: "" };
  const s = sys ?? 0, d = dia ?? 0;
  if (s >= 180 || d >= 120) return { label: "Hypertensive Crisis", color: "text-red-400" };
  if (s >= 140 || d >= 90) return { label: "High – Stage 2", color: "text-red-400" };
  if (s >= 130 || d >= 80) return { label: "High – Stage 1", color: "text-orange-400" };
  if (s >= 120 && d < 80) return { label: "Elevated", color: "text-amber-400" };
  if (s > 0 && d > 0) return { label: "Normal", color: "text-emerald-400" };
  return { label: "", color: "" };
}

// ─── Reusable field components ────────────────────────────────────────────────

const inputCls =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20";

function NumField({
  label, value, onChange, placeholder, min, max, unit, icon,
}: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  placeholder: string; min?: number; max?: number; unit?: string; icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-0.5">{label}</p>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">{icon}</div>}
        <input
          type="number" min={min} max={max} step="1"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={placeholder}
          className={inputCls + (icon ? " pl-9" : "") + (unit ? " pr-12" : "")}
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">{unit}</span>}
      </div>
    </label>
  );
}

function SelField({
  label, value, options, onChange, icon,
}: {
  label: string; value: string; options: readonly string[];
  onChange: (v: string) => void; icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-0.5">{label}</p>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">{icon}</div>}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls + " appearance-none cursor-pointer" + (icon ? " pl-9" : "")}
        >
          <option value="" className="bg-[#0f172a]">Select…</option>
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#0f172a]">{prettify(o)}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ToggleBtn({
  label, sublabel, checked, onChange, icon,
}: {
  label: string; sublabel?: string; checked: boolean;
  onChange: (v: boolean) => void; icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full text-left rounded-xl border p-3.5 transition-all",
        checked
          ? "border-red-500/50 bg-red-500/10"
          : "border-white/8 bg-white/3 hover:border-white/15"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon && <span className={checked ? "text-red-400" : "text-white/30"}>{icon}</span>}
          <div>
            <p className={cn("text-sm font-semibold", checked ? "text-white" : "text-white/60")}>{label}</p>
            {sublabel && <p className="text-[11px] text-white/30 mt-0.5">{sublabel}</p>}
          </div>
        </div>
        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
          checked ? "border-red-500 bg-red-500" : "border-white/20")}>
          {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </div>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VitalsCheckModal() {
  const { userId, isLoaded, isSignedIn } = useBeatAheadAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const effectiveUserId = userId || "demo-user-1";
  const lsKey = `beatahead-patient-record-${effectiveUserId}`;

  // ── Vitals state (pre-populated from localStorage) ─────────────────────────
  const [vitals, setVitals] = useState({
    systolicBP: null as number | null,
    diastolicBP: null as number | null,
    restingHeartRate: null as number | null,
    bloodPressureCategory: "" as PatientRecord["bloodPressureCategory"],
    cholesterolStatus: "" as PatientRecord["cholesterolStatus"],
    smokingStatus: "" as PatientRecord["smokingStatus"],
    alcoholUse: "" as PatientRecord["alcoholUse"],
    exerciseFrequency: "" as PatientRecord["exerciseFrequency"],
    stressLevel: "" as PatientRecord["stressLevel"],
    dietType: "" as PatientRecord["dietType"],
    chestPainHistory: false,
    shortnessOfBreath: false,
  });

  // ── On mount: decide whether to show the modal ────────────────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Only show once per browser session (sessionStorage clears on tab close)
    const alreadyChecked = sessionStorage.getItem(VITALS_SESSION_KEY);
    if (alreadyChecked) return;

    // Pre-populate from existing saved record
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        const rec = JSON.parse(stored) as PatientRecord;
        setVitals({
          systolicBP: rec.systolicBP,
          diastolicBP: rec.diastolicBP,
          restingHeartRate: rec.restingHeartRate,
          bloodPressureCategory: rec.bloodPressureCategory,
          cholesterolStatus: rec.cholesterolStatus,
          smokingStatus: rec.smokingStatus,
          alcoholUse: rec.alcoholUse,
          exerciseFrequency: rec.exerciseFrequency,
          stressLevel: rec.stressLevel,
          dietType: rec.dietType,
          chestPainHistory: rec.chestPainHistory,
          shortnessOfBreath: rec.shortnessOfBreath,
        });
      }
    } catch {/* ignore */}

    setOpen(true);
  }, [isLoaded, isSignedIn, lsKey]);

  const set = useCallback(<K extends keyof typeof vitals>(k: K, v: typeof vitals[K]) => {
    setVitals((prev) => ({ ...prev, [k]: v }));
  }, []);

  // ── Save vitals back into the full patient record in localStorage ──────────
  async function handleSave() {
    setSaving(true);
    try {
      // Load full existing record (or create empty)
      let rec: PatientRecord;
      try {
        const stored = localStorage.getItem(lsKey);
        rec = stored ? (JSON.parse(stored) as PatientRecord) : createEmptyPatientRecord(effectiveUserId);
      } catch {
        rec = createEmptyPatientRecord(effectiveUserId);
      }

      const updated: PatientRecord = {
        ...rec,
        ...vitals,
        userId: effectiveUserId,
        updatedAt: new Date().toISOString(),
      };

      // Validate via API (stateless — just sanitises and returns)
      const res = await fetch("/api/patient-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: effectiveUserId, ...vitals,
          // pass rest of fields so the API validates cleanly
          dateOfBirth: rec.dateOfBirth, biologicalSex: rec.biologicalSex,
          heightCm: rec.heightCm, weightKg: rec.weightKg,
          conditions: rec.conditions, medications: rec.medications,
          allergies: rec.allergies, diabetesStatus: rec.diabetesStatus,
          priorHeartAttack: rec.priorHeartAttack, priorStroke: rec.priorStroke,
          priorAngina: rec.priorAngina, familyHeartAttack: rec.familyHeartAttack,
          familyDiabetes: rec.familyDiabetes, familyHypertension: rec.familyHypertension,
          familyHighCholesterol: rec.familyHighCholesterol, familyHistory: rec.familyHistory,
          emergencyContactName: rec.emergencyContactName,
          emergencyContactPhone: rec.emergencyContactPhone,
          primaryCarePhysician: rec.primaryCarePhysician, notes: rec.notes,
        }),
      });

      const payload = await res.json() as { record?: PatientRecord };
      const saved = payload.record ?? updated;
      localStorage.setItem(lsKey, JSON.stringify(saved));
    } catch {/* silently save locally even if API fails */
      try {
        const stored = localStorage.getItem(lsKey);
        const rec = stored ? (JSON.parse(stored) as PatientRecord) : createEmptyPatientRecord(effectiveUserId);
        localStorage.setItem(lsKey, JSON.stringify({
          ...rec, ...vitals, userId: effectiveUserId, updatedAt: new Date().toISOString(),
        }));
      } catch {/* ignore */}
    } finally {
      setSaving(false);
    }

    setSaved(true);
    sessionStorage.setItem(VITALS_SESSION_KEY, "1");
    setTimeout(() => dismiss(), 1200);
  }

  function dismiss() {
    sessionStorage.setItem(VITALS_SESSION_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  const bpRisk = bpRiskLabel(vitals.systolicBP, vitals.diastolicBP);

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0a0f1e] border border-white/10 shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0f1e] border-b border-white/8 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              <HeartPulse className="w-4.5 h-4.5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Daily Vitals Check</h2>
              <p className="text-[11px] text-white/40">Update your readings for today</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors"
            aria-label="Skip"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {saved ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-white">Vitals saved!</p>
            <p className="text-xs text-white/40">Your health record has been updated.</p>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-5">

            {/* Blood Pressure */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-white">Blood Pressure &amp; Heart Rate</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Systolic BP" value={vitals.systolicBP}
                  onChange={(v) => set("systolicBP", v)} placeholder="e.g. 120"
                  min={60} max={300} unit="mmHg" icon={<Droplets className="w-4 h-4" />} />
                <NumField label="Diastolic BP" value={vitals.diastolicBP}
                  onChange={(v) => set("diastolicBP", v)} placeholder="e.g. 80"
                  min={40} max={200} unit="mmHg" icon={<Droplets className="w-4 h-4" />} />
              </div>

              {/* BP reading */}
              {(vitals.systolicBP || vitals.diastolicBP) && (
                <div className="mt-3 flex items-center gap-4 rounded-xl border border-white/8 bg-white/3 p-3">
                  <p className="text-xl font-bold text-white tabular-nums">
                    {vitals.systolicBP ?? "–"}/{vitals.diastolicBP ?? "–"}
                    <span className="text-xs font-normal text-white/30 ml-1">mmHg</span>
                  </p>
                  {bpRisk.label && (
                    <p className={cn("text-sm font-bold", bpRisk.color)}>{bpRisk.label}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-3">
                <NumField label="Resting Heart Rate" value={vitals.restingHeartRate}
                  onChange={(v) => set("restingHeartRate", v)} placeholder="e.g. 72"
                  min={30} max={250} unit="bpm" icon={<HeartPulse className="w-4 h-4" />} />
                <SelField label="BP Category" value={vitals.bloodPressureCategory}
                  options={BLOOD_PRESSURE_OPTIONS}
                  onChange={(v) => set("bloodPressureCategory", v as PatientRecord["bloodPressureCategory"])}
                  icon={<Activity className="w-4 h-4" />} />
              </div>
            </section>

            {/* Lifestyle */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Lifestyle</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelField label="Cholesterol" value={vitals.cholesterolStatus}
                  options={CHOLESTEROL_STATUS_OPTIONS}
                  onChange={(v) => set("cholesterolStatus", v as PatientRecord["cholesterolStatus"])}
                  icon={<Zap className="w-4 h-4" />} />
                <SelField label="Smoking" value={vitals.smokingStatus}
                  options={SMOKING_STATUS_OPTIONS}
                  onChange={(v) => set("smokingStatus", v as PatientRecord["smokingStatus"])} />
                <SelField label="Alcohol Use" value={vitals.alcoholUse}
                  options={ALCOHOL_USE_OPTIONS}
                  onChange={(v) => set("alcoholUse", v as PatientRecord["alcoholUse"])} />
                <SelField label="Exercise" value={vitals.exerciseFrequency}
                  options={EXERCISE_FREQUENCY_OPTIONS}
                  onChange={(v) => set("exerciseFrequency", v as PatientRecord["exerciseFrequency"])} />
                <SelField label="Stress Level" value={vitals.stressLevel}
                  options={STRESS_LEVEL_OPTIONS}
                  onChange={(v) => set("stressLevel", v as PatientRecord["stressLevel"])} />
                <SelField label="Diet" value={vitals.dietType}
                  options={DIET_TYPE_OPTIONS}
                  onChange={(v) => set("dietType", v as PatientRecord["dietType"])} />
              </div>
            </section>

            {/* Symptoms */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wind className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Symptoms today</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ToggleBtn label="Chest discomfort" sublabel="Pressure or tightness"
                  checked={vitals.chestPainHistory} onChange={(v) => set("chestPainHistory", v)}
                  icon={<Heart className="w-5 h-5" fill={vitals.chestPainHistory ? "currentColor" : "none"} />} />
                <ToggleBtn label="Shortness of breath" sublabel="At rest or mild exertion"
                  checked={vitals.shortnessOfBreath} onChange={(v) => set("shortnessOfBreath", v)}
                  icon={<Wind className="w-5 h-5" />} />
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        {!saved && (
          <div className="sticky bottom-0 bg-[#0a0f1e] border-t border-white/8 px-5 py-4 flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 font-bold"
            >
              {saving ? "Saving…" : "Save Vitals"}
              {!saving && <ChevronRight className="w-4 h-4" />}
            </Button>
            <button
              onClick={dismiss}
              className="text-xs text-white/30 hover:text-white/60 transition-colors underline px-2"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
