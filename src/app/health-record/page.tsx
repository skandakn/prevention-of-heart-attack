"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Heart,
  HeartPulse,
  User,
  Activity,
  Stethoscope,
  Users,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Sparkles,
  Thermometer,
  Droplets,
  Wind,
  Zap,
  Phone,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBeatAheadAuth } from "@/lib/auth/ClerkAuthWrapper";
import {
  BIOLOGICAL_SEX_OPTIONS,
  SMOKING_STATUS_OPTIONS,
  ALCOHOL_USE_OPTIONS,
  EXERCISE_FREQUENCY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  DIET_TYPE_OPTIONS,
  BLOOD_PRESSURE_OPTIONS,
  DIABETES_STATUS_OPTIONS,
  CHOLESTEROL_STATUS_OPTIONS,
  PatientRecord,
  PatientRecordUpdate,
  createEmptyPatientRecord,
} from "@/lib/patient-record";

// ─────────────────────── helpers ────────────────────────

type TextLists = Pick<PatientRecordUpdate, "conditions" | "medications" | "allergies">;

function toTextLists(r: PatientRecord): Record<keyof TextLists, string> {
  return {
    conditions: r.conditions.join("\n"),
    medications: r.medications.join("\n"),
    allergies: r.allergies.join("\n"),
  };
}

function fromLines(v: string) {
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}

function bmi(h: number | null, w: number | null): string {
  if (!h || !w || h <= 0) return "—";
  const val = w / (h / 100) ** 2;
  return val.toFixed(1);
}

function bmiLabel(h: number | null, w: number | null): string {
  if (!h || !w || h <= 0) return "";
  const val = w / (h / 100) ** 2;
  if (val < 18.5) return "Underweight";
  if (val < 25) return "Normal";
  if (val < 30) return "Overweight";
  return "Obese";
}

function prettify(s: string) {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bpRiskLabel(sys: number | null, dia: number | null): { label: string; color: string } {
  if (!sys && !dia) return { label: "", color: "" };
  const s = sys ?? 0;
  const d = dia ?? 0;
  if (s >= 180 || d >= 120) return { label: "Hypertensive Crisis", color: "text-red-400" };
  if (s >= 140 || d >= 90) return { label: "High – Stage 2", color: "text-red-400" };
  if (s >= 130 || d >= 80) return { label: "High – Stage 1", color: "text-orange-400" };
  if (s >= 120 && d < 80) return { label: "Elevated", color: "text-amber-400" };
  if (s > 0 && d > 0) return { label: "Normal", color: "text-emerald-400" };
  return { label: "", color: "" };
}

// ─────────────────────── styling tokens ─────────────────

const glass = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl";
const glassHover = "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-white/20 transition-colors";

const inputCls =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50";

const labelCls = "block text-xs font-semibold uppercase tracking-wider text-white/50 mb-0.5";

// ─────────────────────── sub-components ─────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className={labelCls}>{children}</p>;
}

function SelectField({
  label, value, options, disabled, onChange, placeholder = "Select…", icon,
}: {
  label: string;
  value: string;
  options: readonly string[];
  disabled: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none mt-0.5">
            {icon}
          </div>
        )}
        <select
          className={inputCls + " appearance-none cursor-pointer" + (icon ? " pl-9" : "")}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" className="bg-[#0f172a] text-white">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#0f172a] text-white">
              {prettify(o)}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function NumberField({
  label, value, disabled, onChange, placeholder, min, max, unit, icon,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (v: number | null) => void;
  placeholder: string;
  min?: number;
  max?: number;
  unit?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none mt-0.5">
            {icon}
          </div>
        )}
        <input
          className={inputCls + (icon ? " pl-9" : "") + (unit ? " pr-12" : "")}
          type="number"
          min={min}
          max={max}
          step="1"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
          placeholder={placeholder}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 mt-0.5 pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

function ToggleCard({
  label, sublabel, checked, disabled, onChange, icon,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 w-full text-left p-4 rounded-xl border transition-all duration-200
        ${checked
          ? "border-red-500/50 bg-red-500/10 shadow-lg shadow-red-500/10"
          : "border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200
          ${checked ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/30"}`}
      >
        {icon ?? (
          <div
            className={`w-4 h-4 rounded-full border-2 transition-colors
              ${checked ? "border-red-400 bg-red-500" : "border-white/30 bg-transparent"}`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold transition-colors ${checked ? "text-white" : "text-white/60"}`}>
          {label}
        </p>
        {sublabel && (
          <p className={`text-xs mt-0.5 transition-colors ${checked ? "text-white/40" : "text-white/25"}`}>
            {sublabel}
          </p>
        )}
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200
        ${checked ? "border-red-400 bg-red-500" : "border-white/20 bg-transparent"}`}
      >
        {checked && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
    </button>
  );
}

function TextListField({
  label, value, disabled, onChange, placeholder, icon,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon && <span className="text-red-400/60">{icon}</span>}
        <span className={labelCls}>{label}</span>
      </div>
      <textarea
        className={inputCls}
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p className="text-[11px] text-white/20 mt-1 pl-0.5">One entry per line</p>
    </label>
  );
}

function StatusMsg({ kind, message }: { kind: "error" | "success"; message: string }) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl border p-3.5 text-sm ${
        kind === "error"
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {message}
    </div>
  );
}

// ─────────────────────── step definitions ───────────────

const STEPS = [
  { label: "Personal", icon: User, description: "Basic identity & measurements" },
  { label: "Vitals", icon: Activity, description: "Blood pressure, heart rate & lifestyle" },
  { label: "Medical", icon: Stethoscope, description: "History, medications & allergies" },
  { label: "Family", icon: Users, description: "Hereditary risk & care contacts" },
] as const;

function HealthRecordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "true";

  const { userId, isLoaded } = useBeatAheadAuth();
  const effectiveUserId = userId || "demo-user-1";

  const [record, setRecord] = useState<PatientRecord>(() =>
    createEmptyPatientRecord(effectiveUserId)
  );
  const [lists, setLists] = useState<Record<keyof TextLists, string>>(() =>
    toTextLists(record)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // ── localStorage key for this user ──────────────────────────────────────────
  const lsKey = `beatahead-patient-record-${effectiveUserId}`;

  // Load existing record — try localStorage first, then API as fallback
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    setIsLoading(true);
    setError(null);

    // 1. Try localStorage (instant, works on Vercel)
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        const parsed = JSON.parse(stored) as PatientRecord;
        if (active) {
          setRecord(parsed);
          setLists(toTextLists(parsed));
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // ignore parse errors — fall through to API
    }

    // 2. Fallback: API (returns empty record on Vercel, useful for first load)
    fetch(`/api/patient-record?userId=${encodeURIComponent(effectiveUserId)}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Unable to load your health record.");
        return payload.record as PatientRecord;
      })
      .then((next) => {
        if (!active) return;
        setRecord(next);
        setLists(toTextLists(next));
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Unable to load."))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [effectiveUserId, isLoaded, lsKey]);

  const updatedLabel = useMemo(() => {
    if (!record.updatedAt) return "Not yet saved";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(record.updatedAt)
    );
  }, [record.updatedAt]);

  function field<K extends keyof PatientRecordUpdate>(key: K, value: PatientRecordUpdate[K]) {
    setRecord((c) => ({ ...c, [key]: value }));
    setMessage(null);
  }

  function goToStep(next: number) {
    if (next === step) return;
    setAnimDir(next > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  }

  const buildUpdate = useCallback((): PatientRecordUpdate => ({
    dateOfBirth: record.dateOfBirth,
    biologicalSex: record.biologicalSex,
    heightCm: record.heightCm,
    weightKg: record.weightKg,
    smokingStatus: record.smokingStatus,
    alcoholUse: record.alcoholUse,
    exerciseFrequency: record.exerciseFrequency,
    stressLevel: record.stressLevel,
    dietType: record.dietType,
    systolicBP: record.systolicBP,
    diastolicBP: record.diastolicBP,
    restingHeartRate: record.restingHeartRate,
    bloodPressureCategory: record.bloodPressureCategory,
    cholesterolStatus: record.cholesterolStatus,
    conditions: fromLines(lists.conditions),
    medications: fromLines(lists.medications),
    allergies: fromLines(lists.allergies),
    diabetesStatus: record.diabetesStatus,
    chestPainHistory: record.chestPainHistory,
    shortnessOfBreath: record.shortnessOfBreath,
    priorHeartAttack: record.priorHeartAttack,
    priorStroke: record.priorStroke,
    priorAngina: record.priorAngina,
    familyHeartAttack: record.familyHeartAttack,
    familyDiabetes: record.familyDiabetes,
    familyHypertension: record.familyHypertension,
    familyHighCholesterol: record.familyHighCholesterol,
    familyHistory: record.familyHistory,
    emergencyContactName: record.emergencyContactName,
    emergencyContactPhone: record.emergencyContactPhone,
    primaryCarePhysician: record.primaryCarePhysician,
    notes: record.notes,
  }), [record, lists]);

  async function saveRecord(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/patient-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: effectiveUserId, ...buildUpdate() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Unable to save.");
      const saved = payload.record as PatientRecord;

      // Persist to localStorage — this is the authoritative store on Vercel
      try {
        localStorage.setItem(lsKey, JSON.stringify(saved));
      } catch {
        // Silently ignore storage quota errors
      }

      setRecord(saved);
      setLists(toTextLists(saved));
      if (isOnboarding) {
        router.push("/dashboard");
      } else {
        setMessage("Health record saved successfully.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your health record.");
    } finally {
      setIsSaving(false);
    }
  }

  const bmiVal = bmi(record.heightCm, record.weightKg);
  const bmiLbl = bmiLabel(record.heightCm, record.weightKg);
  const bpRisk = bpRiskLabel(record.systolicBP, record.diastolicBP);

  const animClass = animating
    ? animDir === "forward"
      ? "opacity-0 translate-x-4"
      : "opacity-0 -translate-x-4"
    : "opacity-100 translate-x-0";

  // ── render ──
  return (
    <div className={
      isOnboarding
        ? "fixed inset-0 z-[9999] bg-[#030712] text-white overflow-y-auto"
        : "min-h-screen bg-[#030712] text-white"
    }>
      {/* Background gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-64 -left-64 w-[600px] h-[600px] rounded-full bg-red-600/8 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full bg-rose-800/6 blur-3xl animate-pulse" style={{ animationDuration: "8s", animationDelay: "2s" }} />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-red-900/5 blur-3xl animate-pulse" style={{ animationDuration: "10s", animationDelay: "4s" }} />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 lg:py-12" ref={formRef}>

        {/* ── Onboarding welcome hero ── */}
        {isOnboarding && (
          <div className="mb-10 text-center">
            {/* Animated heart */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-rose-600/20 border border-red-500/20 mb-5 shadow-2xl shadow-red-500/10 relative">
              <Heart
                className="w-9 h-9 text-red-400"
                fill="currentColor"
                style={{ animation: "heartbeat 1.4s ease-in-out infinite" }}
              />
              <div className="absolute inset-0 rounded-3xl bg-red-500/10 animate-ping" style={{ animationDuration: "2s" }} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-400">BeatAhead</span>
            </h1>
            <p className="text-white/50 text-base max-w-md mx-auto leading-relaxed">
              Help us understand your heart health. Your personalized cardiac risk assessment starts here — it only takes 3–4 minutes.
            </p>
            <div className="flex items-center justify-center gap-6 mt-5">
              {["100% Private", "Clinically Guided", "Heart-Focused"].map((tag) => (
                <div key={tag} className="flex items-center gap-1.5 text-xs text-white/40">
                  <div className="w-1 h-1 rounded-full bg-red-500/60" />
                  {tag}
                </div>
              ))}
            </div>
          </div>
        )}


        {/* ── Non-onboarding header ── */}
        {!isOnboarding && (
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <HeartPulse className="w-4.5 h-4.5 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">My Health Record</h1>
              </div>
              <p className="text-sm text-white/40">Keep key health information ready for your cardiac-care conversations.</p>
            </div>
            <p className="text-xs text-white/30 text-right">
              Last saved<br />
              <span className="text-white/50">{updatedLabel}</span>
            </p>
          </div>
        )}

        {/* ── Progress stepper ── */}
        <div className={`${glass} p-5 mb-6`}>
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.label} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => isDone && goToStep(i)}
                    className={`flex flex-col items-center gap-2 flex-1 transition-all ${isDone ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300
                        ${isActive
                          ? "bg-gradient-to-br from-red-500 to-rose-600 border-red-400 shadow-lg shadow-red-500/30 scale-110"
                          : isDone
                          ? "bg-red-500/15 border-red-500/30"
                          : "bg-white/3 border-white/8"
                        }`}
                    >
                      {isDone
                        ? <CheckCircle2 className="w-4.5 h-4.5 text-red-300" />
                        : <Icon className={`w-4.5 h-4.5 ${isActive ? "text-white" : "text-white/30"}`} />
                      }
                    </div>
                    <div className="text-center">
                      <span className={`text-[11px] font-semibold block ${isActive ? "text-white" : isDone ? "text-red-400/80" : "text-white/25"}`}>
                        {s.label}
                      </span>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px flex-1 mx-2 mb-5 transition-all duration-500 ${i < step ? "bg-gradient-to-r from-red-500/60 to-rose-500/40" : "bg-white/8"}`} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full transition-all duration-700"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-center text-[11px] text-white/25 mt-2">
            Step {step + 1} of {STEPS.length} — {STEPS[step].description}
          </p>
        </div>

        {/* ── Messages ── */}
        {error && <div className="mb-4"><StatusMsg kind="error" message={error} /></div>}
        {message && <div className="mb-4"><StatusMsg kind="success" message={message} /></div>}

        {/* ── Disclaimer ── */}
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-xs text-amber-300/70 mb-5 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400/60" />
          <span>
            <span className="font-semibold text-amber-300/90">Note: </span>
            This record supports personal organization and care discussions. It does not provide a diagnosis or replace medical advice.
          </span>
        </div>

        {/* ────────────────── FORM STEPS ────────────────── */}
        <form onSubmit={saveRecord}>
          <div
            className={`transition-all duration-200 ${animClass}`}
            style={{ willChange: "opacity, transform" }}
          >

            {/* ══════════ STEP 0: Personal Details ══════════ */}
            {step === 0 && (
              <div className="space-y-5">
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Personal Details</h2>
                      <p className="text-[11px] text-white/30">Basic identity and body measurements</p>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <FieldLabel>Date of Birth</FieldLabel>
                      <input
                        className={inputCls}
                        type="date"
                        value={record.dateOfBirth}
                        onChange={(e) => field("dateOfBirth", e.target.value)}
                        disabled={isLoading}
                      />
                    </label>

                    <SelectField
                      label="Biological Sex"
                      value={record.biologicalSex}
                      options={BIOLOGICAL_SEX_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("biologicalSex", v as PatientRecord["biologicalSex"])}
                      placeholder="Prefer not to specify"
                      icon={<User className="w-4 h-4" />}
                    />

                    <NumberField
                      label="Height"
                      value={record.heightCm}
                      onChange={(v) => field("heightCm", v)}
                      disabled={isLoading}
                      placeholder="e.g. 170"
                      min={1} max={300}
                      unit="cm"
                    />

                    <NumberField
                      label="Weight"
                      value={record.weightKg}
                      onChange={(v) => field("weightKg", v)}
                      disabled={isLoading}
                      placeholder="e.g. 70"
                      min={1} max={500}
                      unit="kg"
                    />
                  </div>

                  {/* BMI card */}
                  {record.heightCm && record.weightKg && (
                    <div className="mt-5 flex items-center gap-5 rounded-xl border border-white/8 bg-white/3 p-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-white">{bmiVal}</p>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">BMI</p>
                      </div>
                      <div className="w-px h-12 bg-white/8" />
                      <div className="flex-1">
                        <p className={`text-sm font-bold mb-1 ${
                          bmiLbl === "Normal" ? "text-emerald-400" :
                          bmiLbl === "Underweight" ? "text-sky-400" :
                          bmiLbl === "Overweight" ? "text-amber-400" : "text-red-400"
                        }`}>{bmiLbl}</p>
                        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              bmiLbl === "Normal" ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                              bmiLbl === "Underweight" ? "bg-gradient-to-r from-sky-500 to-sky-400" :
                              bmiLbl === "Overweight" ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                              "bg-gradient-to-r from-red-500 to-rose-400"
                            }`}
                            style={{ width: `${Math.min(100, (Number(bmiVal) / 40) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-white/20 mt-1">
                          <span>18.5</span><span>25</span><span>30</span><span>40+</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════ STEP 1: Vitals & Lifestyle ══════════ */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Blood Pressure */}
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                      <Droplets className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Blood Pressure & Heart Rate</h2>
                      <p className="text-[11px] text-white/30">Key cardiac vitals</p>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <NumberField
                      label="Systolic BP"
                      value={record.systolicBP}
                      onChange={(v) => field("systolicBP", v)}
                      disabled={isLoading}
                      placeholder="e.g. 120"
                      min={60} max={300}
                      unit="mmHg"
                      icon={<Droplets className="w-4 h-4" />}
                    />
                    <NumberField
                      label="Diastolic BP"
                      value={record.diastolicBP}
                      onChange={(v) => field("diastolicBP", v)}
                      disabled={isLoading}
                      placeholder="e.g. 80"
                      min={40} max={200}
                      unit="mmHg"
                      icon={<Droplets className="w-4 h-4" />}
                    />
                  </div>

                  {/* BP reading card */}
                  {(record.systolicBP || record.diastolicBP) && (
                    <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/8 bg-white/3 p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white tabular-nums">
                          {record.systolicBP ?? "–"}/{record.diastolicBP ?? "–"}
                        </p>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">mmHg</p>
                      </div>
                      {bpRisk.label && (
                        <>
                          <div className="w-px h-10 bg-white/8" />
                          <p className={`text-sm font-bold ${bpRisk.color}`}>{bpRisk.label}</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="grid gap-5 sm:grid-cols-2 mt-5">
                    <NumberField
                      label="Resting Heart Rate"
                      value={record.restingHeartRate}
                      onChange={(v) => field("restingHeartRate", v)}
                      disabled={isLoading}
                      placeholder="e.g. 72"
                      min={30} max={250}
                      unit="bpm"
                      icon={<HeartPulse className="w-4 h-4" />}
                    />
                    <SelectField
                      label="BP Category (if known)"
                      value={record.bloodPressureCategory}
                      options={BLOOD_PRESSURE_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("bloodPressureCategory", v as PatientRecord["bloodPressureCategory"])}
                      icon={<Activity className="w-4 h-4" />}
                    />
                  </div>
                </div>

                {/* Cholesterol & Lifestyle */}
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Lifestyle & Cholesterol</h2>
                      <p className="text-[11px] text-white/30">Daily habits that affect your heart</p>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField
                      label="Cholesterol Status"
                      value={record.cholesterolStatus}
                      options={CHOLESTEROL_STATUS_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("cholesterolStatus", v as PatientRecord["cholesterolStatus"])}
                      icon={<Zap className="w-4 h-4" />}
                    />
                    <SelectField
                      label="Smoking Status"
                      value={record.smokingStatus}
                      options={SMOKING_STATUS_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("smokingStatus", v as PatientRecord["smokingStatus"])}
                    />
                    <SelectField
                      label="Alcohol Use"
                      value={record.alcoholUse}
                      options={ALCOHOL_USE_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("alcoholUse", v as PatientRecord["alcoholUse"])}
                    />
                    <SelectField
                      label="Exercise Frequency"
                      value={record.exerciseFrequency}
                      options={EXERCISE_FREQUENCY_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("exerciseFrequency", v as PatientRecord["exerciseFrequency"])}
                    />
                    <SelectField
                      label="Stress Level"
                      value={record.stressLevel}
                      options={STRESS_LEVEL_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("stressLevel", v as PatientRecord["stressLevel"])}
                    />
                    <SelectField
                      label="Diet Type"
                      value={record.dietType}
                      options={DIET_TYPE_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("dietType", v as PatientRecord["dietType"])}
                    />
                  </div>
                </div>

                {/* Symptoms */}
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
                      <Wind className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Current Symptoms</h2>
                      <p className="text-[11px] text-white/30">Select all that apply</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleCard
                      label="Chest pain or discomfort"
                      sublabel="Pressure, squeezing, or tightness"
                      checked={record.chestPainHistory}
                      disabled={isLoading}
                      onChange={(v) => field("chestPainHistory", v)}
                      icon={<Heart className="w-5 h-5" fill={record.chestPainHistory ? "currentColor" : "none"} />}
                    />
                    <ToggleCard
                      label="Shortness of breath"
                      sublabel="At rest or during mild exertion"
                      checked={record.shortnessOfBreath}
                      disabled={isLoading}
                      onChange={(v) => field("shortnessOfBreath", v)}
                      icon={<Wind className="w-5 h-5" />}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ══════════ STEP 2: Medical History ══════════ */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Prior cardiac events */}
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                      <HeartPulse className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Prior Cardiac Events</h2>
                      <p className="text-[11px] text-white/30">Have you personally experienced any of these?</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ToggleCard
                      label="Heart Attack"
                      sublabel="Myocardial infarction"
                      checked={record.priorHeartAttack}
                      disabled={isLoading}
                      onChange={(v) => field("priorHeartAttack", v)}
                      icon={<Heart className="w-5 h-5" fill={record.priorHeartAttack ? "currentColor" : "none"} />}
                    />
                    <ToggleCard
                      label="Stroke"
                      sublabel="Cerebrovascular event"
                      checked={record.priorStroke}
                      disabled={isLoading}
                      onChange={(v) => field("priorStroke", v)}
                      icon={<Zap className="w-5 h-5" />}
                    />
                    <ToggleCard
                      label="Angina"
                      sublabel="Chest pain from CAD"
                      checked={record.priorAngina}
                      disabled={isLoading}
                      onChange={(v) => field("priorAngina", v)}
                      icon={<Activity className="w-5 h-5" />}
                    />
                  </div>
                </div>

                {/* Conditions */}
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Medical History</h2>
                      <p className="text-[11px] text-white/30">Conditions, medications & allergies</p>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 mb-5">
                    <SelectField
                      label="Diabetes Status"
                      value={record.diabetesStatus}
                      options={DIABETES_STATUS_OPTIONS}
                      disabled={isLoading}
                      onChange={(v) => field("diabetesStatus", v as PatientRecord["diabetesStatus"])}
                      icon={<Thermometer className="w-4 h-4" />}
                    />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-3">
                    <TextListField
                      label="Conditions"
                      value={lists.conditions}
                      disabled={isLoading}
                      onChange={(v) => { setLists((c) => ({ ...c, conditions: v })); setMessage(null); }}
                      placeholder={"Hypertension\nCoronary artery disease\nHyperlipidemia"}
                      icon={<Stethoscope className="w-3.5 h-3.5" />}
                    />
                    <TextListField
                      label="Current Medications"
                      value={lists.medications}
                      disabled={isLoading}
                      onChange={(v) => { setLists((c) => ({ ...c, medications: v })); setMessage(null); }}
                      placeholder={"Atorvastatin 20 mg\nMetoprolol 25 mg\nAspirin 81 mg"}
                      icon={<Zap className="w-3.5 h-3.5" />}
                    />
                    <TextListField
                      label="Allergies"
                      value={lists.allergies}
                      disabled={isLoading}
                      onChange={(v) => { setLists((c) => ({ ...c, allergies: v })); setMessage(null); }}
                      placeholder={"Penicillin\nSulfa drugs\nContrast dye"}
                      icon={<AlertCircle className="w-3.5 h-3.5" />}
                    />
                  </div>

                  <label className="block mt-5">
                    <FieldLabel>Additional Medical Notes</FieldLabel>
                    <textarea
                      className={inputCls}
                      rows={4}
                      maxLength={2000}
                      value={record.notes}
                      onChange={(e) => field("notes", e.target.value)}
                      disabled={isLoading}
                      placeholder="Any other relevant medical history, recent procedures, or notes for your care team…"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ══════════ STEP 3: Family History & Contacts ══════════ */}
            {step === 3 && (
              <div className="space-y-5">
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Family Cardiac History</h2>
                      <p className="text-[11px] text-white/30">Parents, siblings, grandparents</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleCard
                      label="Heart Attack"
                      sublabel="Myocardial infarction in family"
                      checked={record.familyHeartAttack}
                      disabled={isLoading}
                      onChange={(v) => field("familyHeartAttack", v)}
                      icon={<Heart className="w-5 h-5" fill={record.familyHeartAttack ? "currentColor" : "none"} />}
                    />
                    <ToggleCard
                      label="Diabetes"
                      sublabel="Type 1 or Type 2 in family"
                      checked={record.familyDiabetes}
                      disabled={isLoading}
                      onChange={(v) => field("familyDiabetes", v)}
                      icon={<Thermometer className="w-5 h-5" />}
                    />
                    <ToggleCard
                      label="High Blood Pressure"
                      sublabel="Hypertension in family"
                      checked={record.familyHypertension}
                      disabled={isLoading}
                      onChange={(v) => field("familyHypertension", v)}
                      icon={<Droplets className="w-5 h-5" />}
                    />
                    <ToggleCard
                      label="High Cholesterol"
                      sublabel="Hyperlipidemia in family"
                      checked={record.familyHighCholesterol}
                      disabled={isLoading}
                      onChange={(v) => field("familyHighCholesterol", v)}
                      icon={<Activity className="w-5 h-5" />}
                    />
                  </div>

                  <label className="block mt-5">
                    <FieldLabel>Additional Family History Details</FieldLabel>
                    <textarea
                      className={inputCls}
                      rows={3}
                      value={record.familyHistory}
                      onChange={(e) => field("familyHistory", e.target.value)}
                      disabled={isLoading}
                      placeholder="e.g. Father had a heart attack at 52, maternal grandmother had stroke at 70…"
                    />
                  </label>
                </div>

                {/* Care contacts */}
                <div className={`${glass} p-6`}>
                  <div className="flex items-center gap-2.5 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/20 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-sky-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Care Contacts</h2>
                      <p className="text-[11px] text-white/30">Your physician and emergency contact</p>
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <FieldLabel>Primary Care Physician</FieldLabel>
                      <div className="relative">
                        <UserCheck className="w-4 h-4 text-white/25 absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 pointer-events-none" />
                        <input
                          className={inputCls + " pl-9"}
                          value={record.primaryCarePhysician}
                          onChange={(e) => field("primaryCarePhysician", e.target.value)}
                          disabled={isLoading}
                          placeholder="Dr. Smith"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <FieldLabel>Emergency Contact Name</FieldLabel>
                      <div className="relative">
                        <User className="w-4 h-4 text-white/25 absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 pointer-events-none" />
                        <input
                          className={inputCls + " pl-9"}
                          value={record.emergencyContactName}
                          onChange={(e) => field("emergencyContactName", e.target.value)}
                          disabled={isLoading}
                          placeholder="Jane Doe"
                        />
                      </div>
                    </label>
                    <label className="block sm:col-span-2">
                      <FieldLabel>Emergency Contact Phone</FieldLabel>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-white/25 absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 pointer-events-none" />
                        <input
                          className={inputCls + " pl-9"}
                          type="tel"
                          value={record.emergencyContactPhone}
                          onChange={(e) => field("emergencyContactPhone", e.target.value)}
                          disabled={isLoading}
                          placeholder="+91 98765 43210"
                        />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ── Navigation buttons ── */}
          <div className="flex items-center justify-between mt-6 gap-3">
            <div>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => goToStep(step - 1)}
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white/60 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Skip to dashboard (onboarding only) */}
              {isOnboarding && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="text-xs text-white/25 hover:text-white/50 underline underline-offset-2 transition-colors"
                >
                  Skip for now
                </button>
              )}

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToStep(step + 1)}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-semibold shadow-lg shadow-red-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <Button
                  type="submit"
                  disabled={isLoading || isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-semibold shadow-lg shadow-red-500/25 transition-all active:scale-[0.98] disabled:opacity-50 min-w-48"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : isOnboarding ? (
                    <>
                      <LayoutDashboard className="w-4 h-4" />
                      Save & Go to Dashboard
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Record
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Heartbeat keyframe */}
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.15); }
          28% { transform: scale(1); }
          42% { transform: scale(1.1); }
          56% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function HealthRecordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-center bg-[#070b14]">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-white/60">Loading Health Record...</p>
        </div>
      }
    >
      <HealthRecordPageContent />
    </Suspense>
  );
}
