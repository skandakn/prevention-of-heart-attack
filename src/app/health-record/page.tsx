"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, HeartPulse, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBeatAheadAuth } from "@/lib/auth/ClerkAuthWrapper";
import {
  BIOLOGICAL_SEX_OPTIONS,
  PatientRecord,
  PatientRecordUpdate,
  createEmptyPatientRecord,
} from "@/lib/patient-record";

type TextLists = Pick<PatientRecordUpdate, "conditions" | "medications" | "allergies">;

function toTextLists(record: PatientRecord): Record<keyof TextLists, string> {
  return {
    conditions: record.conditions.join("\n"),
    medications: record.medications.join("\n"),
    allergies: record.allergies.join("\n"),
  };
}

function fromLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

const inputClass = "mt-1.5 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none transition focus:border-navy-900 focus:ring-2 focus:ring-navy-100";
const labelClass = "block text-sm font-medium text-navy-800";

export default function HealthRecordPage() {
  const { userId, isLoaded } = useBeatAheadAuth();
  const effectiveUserId = userId || "demo-user-1";
  const [record, setRecord] = useState<PatientRecord>(() => createEmptyPatientRecord(effectiveUserId));
  const [lists, setLists] = useState<Record<keyof TextLists, string>>(() => toTextLists(record));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    fetch(`/api/patient-record?userId=${encodeURIComponent(effectiveUserId)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load your health record.");
        return payload.record as PatientRecord;
      })
      .then((nextRecord) => {
        if (!active) return;
        setRecord(nextRecord);
        setLists(toTextLists(nextRecord));
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Unable to load your health record."))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [effectiveUserId, isLoaded]);

  const updatedLabel = useMemo(() => {
    if (!record.updatedAt) return "Not yet saved";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.updatedAt));
  }, [record.updatedAt]);

  function updateField<K extends keyof PatientRecordUpdate>(key: K, value: PatientRecordUpdate[K]) {
    setRecord((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    const update: PatientRecordUpdate = {
      dateOfBirth: record.dateOfBirth,
      biologicalSex: record.biologicalSex,
      heightCm: record.heightCm,
      weightKg: record.weightKg,
      conditions: fromLines(lists.conditions),
      medications: fromLines(lists.medications),
      allergies: fromLines(lists.allergies),
      familyHistory: record.familyHistory,
      emergencyContactName: record.emergencyContactName,
      emergencyContactPhone: record.emergencyContactPhone,
      primaryCarePhysician: record.primaryCarePhysician,
      notes: record.notes,
    };
    try {
      const response = await fetch("/api/patient-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: effectiveUserId, ...update }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save your health record.");
      const saved = payload.record as PatientRecord;
      setRecord(saved);
      setLists(toTextLists(saved));
      setMessage("Health record saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your health record.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-cardiac" />
            <h1 className="text-2xl font-bold text-navy-900">My Health Record</h1>
          </div>
          <p className="mt-1 text-sm text-navy-500">Keep key health information ready for your cardiac-care conversations.</p>
        </div>
        <p className="text-xs text-navy-500">Last saved: {updatedLabel}</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This record supports personal organization and care discussions. It does not provide a diagnosis or replace medical advice.
      </div>

      {error && <StatusMessage kind="error" message={error} />}
      {message && <StatusMessage kind="success" message={message} />}

      <form onSubmit={saveRecord} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Only information relevant to your health record is collected here.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelClass}>Date of birth
              <input className={inputClass} type="date" value={record.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} disabled={isLoading} />
            </label>
            <label className={labelClass}>Biological sex
              <select className={inputClass} value={record.biologicalSex} onChange={(event) => updateField("biologicalSex", event.target.value as PatientRecordUpdate["biologicalSex"])} disabled={isLoading}>
                <option value="">Prefer not to specify</option>
                {BIOLOGICAL_SEX_OPTIONS.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className={labelClass}>Height (cm)
              <input className={inputClass} type="number" min="1" max="500" step="0.1" value={record.heightCm ?? ""} onChange={(event) => updateField("heightCm", event.target.value === "" ? null : Number(event.target.value))} disabled={isLoading} />
            </label>
            <label className={labelClass}>Weight (kg)
              <input className={inputClass} type="number" min="1" max="500" step="0.1" value={record.weightKg ?? ""} onChange={(event) => updateField("weightKg", event.target.value === "" ? null : Number(event.target.value))} disabled={isLoading} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medical information</CardTitle>
            <CardDescription>Enter one item per line so the record stays easy to scan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-3">
            <TextListField label="Conditions" value={lists.conditions} disabled={isLoading} onChange={(value) => { setLists((current) => ({ ...current, conditions: value })); setMessage(null); }} placeholder="e.g. Hypertension" />
            <TextListField label="Medications" value={lists.medications} disabled={isLoading} onChange={(value) => { setLists((current) => ({ ...current, medications: value })); setMessage(null); }} placeholder="e.g. Atorvastatin 20 mg" />
            <TextListField label="Allergies" value={lists.allergies} disabled={isLoading} onChange={(value) => { setLists((current) => ({ ...current, allergies: value })); setMessage(null); }} placeholder="e.g. Penicillin" />
            <label className={`${labelClass} lg:col-span-3`}>Family cardiac history
              <textarea className={inputClass} rows={3} value={record.familyHistory} onChange={(event) => updateField("familyHistory", event.target.value)} disabled={isLoading} placeholder="Relevant family history, if known" />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Care contacts and notes</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>Primary care physician
              <input className={inputClass} value={record.primaryCarePhysician} onChange={(event) => updateField("primaryCarePhysician", event.target.value)} disabled={isLoading} />
            </label>
            <label className={labelClass}>Emergency contact name
              <input className={inputClass} value={record.emergencyContactName} onChange={(event) => updateField("emergencyContactName", event.target.value)} disabled={isLoading} />
            </label>
            <label className={labelClass}>Emergency contact phone
              <input className={inputClass} type="tel" value={record.emergencyContactPhone} onChange={(event) => updateField("emergencyContactPhone", event.target.value)} disabled={isLoading} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>Additional notes
              <textarea className={inputClass} rows={4} maxLength={2000} value={record.notes} onChange={(event) => updateField("notes", event.target.value)} disabled={isLoading} placeholder="Optional information you would like to have available during care discussions" />
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || isSaving} className="min-w-36">
            <Save className="h-4 w-4" />{isSaving ? "Saving…" : "Save record"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TextListField({ label, value, disabled, onChange, placeholder }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; placeholder: string }) {
  return <label className={labelClass}>{label}<textarea className={inputClass} rows={5} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function StatusMessage({ kind, message }: { kind: "error" | "success"; message: string }) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return <div role="status" className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><Icon className="h-4 w-4" />{message}</div>;
}
