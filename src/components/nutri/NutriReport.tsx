"use client";

import { useRef } from "react";
import { useNutri } from "@/lib/nutri/NutriContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NutriMessage, NutriProfile } from "@/lib/nutri/types";
import { FileText, Printer } from "lucide-react";

// ─── Label helpers ────────────────────────────────────────────────────────────

const DIET_LABELS: Record<string, string> = {
  none: "No preference",
  omnivore: "Omnivore",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  keto: "Keto",
  paleo: "Paleo",
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Active",
  very_active: "Very active",
};

const GOAL_LABELS: Record<string, string> = {
  general_wellness: "General wellness",
  weight_management: "Weight management",
  energy_levels: "Energy levels",
  heart_health: "Heart health",
  stress_reduction: "Stress reduction",
  better_sleep: "Better sleep",
  digestive_health: "Digestive health",
};

// ─── Print logic ──────────────────────────────────────────────────────────────

function printReport(contentId: string) {
  const el = document.getElementById(contentId);
  if (!el) return;
  const printWindow = window.open("", "_blank", "width=800,height=700");
  if (!printWindow) return;
  const styles = Array.from(document.styleSheets).map((s) => {
    try { return Array.from(s.cssRules).map((r) => r.cssText).join("\n"); }
    catch { return s.href ? `@import url("${s.href}");` : ""; }
  }).join("\n");
  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>BeatAhead Nutrition Report</title>
<style>${styles} body{font-family:system-ui,sans-serif;background:white;margin:0;padding:24px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>
</head><body>${el.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
}

// ─── Report HTML ──────────────────────────────────────────────────────────────

function ReportContent({
  id, messages, profile,
}: {
  id: string;
  messages: NutriMessage[];
  profile: NutriProfile;
}) {
  const now = new Date();
  const generatedAt = now.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Only today's messages (by timestamp date)
  const todayISO = now.toISOString().split("T")[0];
  const todayMessages = messages.filter((m) => {
    const d = new Date(m.timestamp).toISOString().split("T")[0];
    return d === todayISO;
  });

  const goalsList = profile.goals.map((g) => GOAL_LABELS[g] ?? g).join(", ");

  return (
    <div id={id} style={{ fontFamily: "system-ui,sans-serif", maxWidth: 720, margin: "0 auto", padding: 32, color: "#1e2a3a", background: "white" }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #10b981", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>BeatAhead Nutrition Report</h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>{dateLabel}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Generated</p>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{generatedAt}</p>
          </div>
        </div>
      </div>

      {/* Profile summary */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, marginTop: 0 }}>Nutrition Profile</h2>
      {!profile.isProfileComplete ? (
        <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic", marginBottom: 24 }}>Profile not yet completed.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 28 }}>
          {[
            { label: "Dietary Preference", value: DIET_LABELS[profile.dietaryPreference] ?? profile.dietaryPreference },
            { label: "Activity Level", value: ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel },
            { label: "Meals Per Day", value: String(profile.mealsPerDay) },
            { label: "Goals", value: goalsList || "—" },
            { label: "Allergens / Restrictions", value: profile.allergens || "None" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 600, color: "#1e2a3a" }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today's conversation */}
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, marginTop: 0 }}>
        Today&apos;s Nutrition Conversation
        <span style={{ fontSize: 12, fontWeight: 400, color: "#94a3b8", marginLeft: 8 }}>
          ({todayMessages.length} {todayMessages.length === 1 ? "message" : "messages"})
        </span>
      </h2>

      {todayMessages.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>No messages recorded today.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {todayMessages.map((m, i) => (
            <div key={m.id ?? i} style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: m.role === "user" ? "#1e2a3a" : "#f0fdf4",
              border: m.role === "user" ? "none" : "1px solid #bbf7d0",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: m.role === "user" ? "#94a3b8" : "#16a34a", marginBottom: 4 }}>
                {m.role === "user" ? "You" : "Nutri Agent"}
              </p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: m.role === "user" ? "white" : "#1e2a3a", whiteSpace: "pre-wrap" }}>
                {m.content}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 10, color: m.role === "user" ? "#64748b" : "#94a3b8" }}>
                {new Date(m.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 36, paddingTop: 16, borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
        BeatAhead Wellness Platform — This report is for personal wellness tracking only and does not constitute medical advice.
      </div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function NutriReport() {
  const { messages, profile } = useNutri();
  const REPORT_ID = "nutri-report-printable";

  const todayISO = new Date().toISOString().split("T")[0];
  const todayMessages = messages.filter((m) => {
    const d = new Date(m.timestamp).toISOString().split("T")[0];
    return d === todayISO;
  });

  return (
    <>
      {/* Hidden printable content */}
      <div style={{ position: "absolute", left: -9999, top: -9999, width: 760 }} aria-hidden>
        <ReportContent id={REPORT_ID} messages={messages} profile={profile} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">Print Nutrition Report</CardTitle>
          </div>
          <CardDescription>
            Print today&apos;s nutrition profile and chat conversation summary.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Preview */}
          <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-navy-700">
              Today&apos;s report · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-navy-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-navy-200 px-2.5 py-0.5">
                Profile: <strong className="ml-1 text-navy-800">{profile.isProfileComplete ? "Complete" : "Incomplete"}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white border border-navy-200 px-2.5 py-0.5">
                Messages today: <strong className="ml-1 text-navy-800">{todayMessages.length}</strong>
              </span>
              {profile.isProfileComplete && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white border border-navy-200 px-2.5 py-0.5">
                  Diet: <strong className="ml-1 text-navy-800">{DIET_LABELS[profile.dietaryPreference] ?? profile.dietaryPreference}</strong>
                </span>
              )}
            </div>
          </div>

          <Button onClick={() => printReport(REPORT_ID)} className="gap-2 bg-emerald-700 hover:bg-emerald-800" size="sm">
            <Printer className="h-4 w-4" /> Print Today&apos;s Report
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
