"use client";

import { useState } from "react";
import { useNutri } from "@/lib/nutri/NutriContext";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NutriMessage, NutriProfile } from "@/lib/nutri/types";
import { FileText, Printer, RefreshCw, AlertTriangle } from "lucide-react";

// ─── Label maps ───────────────────────────────────────────────────────────────

const DIET_LABELS: Record<string, string> = {
  none: "No preference", omnivore: "Omnivore", vegetarian: "Vegetarian",
  vegan: "Vegan", pescatarian: "Pescatarian", gluten_free: "Gluten-free",
  dairy_free: "Dairy-free", keto: "Ketogenic", paleo: "Paleo",
};
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary", light: "Lightly active", moderate: "Moderately active",
  active: "Active", very_active: "Very active",
};
const GOAL_LABELS: Record<string, string> = {
  general_wellness: "General wellness", weight_management: "Weight management",
  energy_levels: "Energy levels", heart_health: "Heart health",
  stress_reduction: "Stress reduction", better_sleep: "Better sleep",
  digestive_health: "Digestive health",
};

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: #fff; color: #1e2a3a; padding: 28px; font-size: 13px; line-height: 1.5;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1  { font-size: 21px; font-weight: 800; }
  h2  { font-size: 13px; font-weight: 700; margin: 22px 0 8px; text-transform: uppercase;
        letter-spacing: .05em; color: #475569; }
  p   { margin: 0; }
  .doc-header { border-bottom: 2px solid #10b981; padding-bottom: 14px; margin-bottom: 20px;
                display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-header-right { text-align: right; font-size: 11px; color: #94a3b8; }
  .grid4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 6px; }
  .grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 6px; }
  .grid2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-bottom: 6px; }
  .stat  { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 13px; }
  .stat-label { font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .stat-value { font-size: 19px; font-weight: 800; color: #1e2a3a; margin-top: 2px; }
  .stat-unit  { font-size: 11px; color: #64748b; }
  .isi-bar  { height: 8px; border-radius: 99px; background: #e2e8f0; margin: 6px 0 2px; overflow: hidden; }
  .isi-fill { height: 100%; border-radius: 99px; }
  .section-box { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 4px; }
  .section-box-header { background: #f8fafc; padding: 8px 13px; font-size: 11px; font-weight: 700;
                        color: #475569; border-bottom: 1px solid #e2e8f0; }
  .section-box-body { padding: 12px 13px; }
  .info-row { display: flex; justify-content: space-between; padding: 5px 0;
              border-bottom: 1px solid #f1f5f9; font-size: 12.5px; }
  .info-row:last-child { border-bottom: none; }
  .info-key { color: #64748b; }
  .info-val { font-weight: 600; color: #1e2a3a; text-align: right; max-width: 60%; }
  .plan-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
              padding: 14px 16px; white-space: pre-wrap; font-size: 12.5px; line-height: 1.6;
              color: #1e2a3a; }
  .recs-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
              padding: 14px 16px; white-space: pre-wrap; font-size: 12.5px; line-height: 1.6;
              color: #1e2a3a; }
  .msgs { display: flex; flex-direction: column; gap: 8px; }
  .msg-user  { background: #1e2a3a; color: white; padding: 9px 13px; border-radius: 10px;
               margin-left: auto; max-width: 86%; }
  .msg-agent { background: #f0fdf4; border: 1px solid #bbf7d0; color: #1e2a3a;
               padding: 9px 13px; border-radius: 10px; max-width: 86%; }
  .msg-role  { font-size: 9.5px; font-weight: 700; text-transform: uppercase;
               letter-spacing: .05em; margin-bottom: 3px; }
  .msg-user .msg-role  { color: #94a3b8; }
  .msg-agent .msg-role { color: #16a34a; }
  .msg-text  { white-space: pre-wrap; font-size: 12.5px; }
  .msg-time  { font-size: 9.5px; opacity: 0.55; margin-top: 5px; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0;
            font-size: 9.5px; color: #94a3b8; text-align: center; }
  .disclaimer { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px;
                padding: 8px 12px; font-size: 10px; color: #713f12; margin-top: 12px; }
  .empty { color: #94a3b8; font-style: italic; font-size: 12.5px; padding: 12px 0; }
`;

// ─── iframe print ─────────────────────────────────────────────────────────────

function printViaIframe(html: string) {
  const existing = document.getElementById("beatahead-print-iframe");
  if (existing) existing.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "beatahead-print-iframe";
  iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 250);
  };
}

function isiBarColor(score: number) {
  if (score < 30) return "#16a34a";
  if (score < 60) return "#f59e0b";
  return "#dc2626";
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

interface NutriReportData {
  profile: NutriProfile;
  messages: NutriMessage[];
  dailyPlan: string | null;
  recommendations: string | null;
  isi: { score: number; label: string; trend: string; hrv: number; heartRate: number; spo2: number; signalQuality: number; };
}

function buildNutriReport(d: NutriReportData): string {
  const now = new Date();
  const gen = now.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const todayISO = now.toISOString().split("T")[0];
  const todayMsgs = d.messages.filter(
    (m) => new Date(m.timestamp).toISOString().split("T")[0] === todayISO
  );

  const isiPct = Math.min(100, Math.round(d.isi.score));

  // ── Wellness section
  const wellnessHTML = `
    <h2>Wellness Indicator (at time of report)</h2>
    <div class="section-box">
      <div class="section-box-header">ISI Platform — Research Prototype · Not clinically validated</div>
      <div class="section-box-body">
        <div class="grid4">
          <div class="stat"><p class="stat-label">ISI Score</p><p class="stat-value">${d.isi.score.toFixed(1)}</p><p class="stat-unit">${d.isi.label}</p></div>
          <div class="stat"><p class="stat-label">Trend</p><p class="stat-value" style="font-size:15px;margin-top:4px;text-transform:capitalize">${d.isi.trend}</p></div>
          <div class="stat"><p class="stat-label">Heart Rate</p><p class="stat-value">${Math.round(d.isi.heartRate)}<span class="stat-unit"> bpm</span></p></div>
          <div class="stat"><p class="stat-label">HRV (SDNN)</p><p class="stat-value">${Math.round(d.isi.hrv)}<span class="stat-unit"> ms</span></p></div>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="stat"><p class="stat-label">SpO₂</p><p class="stat-value">${d.isi.spo2.toFixed(1)}<span class="stat-unit">%</span></p></div>
          <div class="stat"><p class="stat-label">Signal Quality</p><p class="stat-value">${Math.round(d.isi.signalQuality)}<span class="stat-unit">%</span></p></div>
        </div>
        <div class="isi-bar"><div class="isi-fill" style="width:${isiPct}%;background:${isiBarColor(d.isi.score)}"></div></div>
        <p style="font-size:10px;color:#94a3b8">ISI ${d.isi.score.toFixed(1)} / 100 — ${d.isi.label}</p>
      </div>
    </div>`;

  // ── Nutrition profile
  const profileHTML = !d.profile.isProfileComplete
    ? `<p class="empty">Nutrition profile not yet completed.</p>`
    : `<div class="section-box"><div class="section-box-body">
        <div class="info-row"><span class="info-key">Dietary preference</span><span class="info-val">${DIET_LABELS[d.profile.dietaryPreference] ?? d.profile.dietaryPreference}</span></div>
        <div class="info-row"><span class="info-key">Activity level</span><span class="info-val">${ACTIVITY_LABELS[d.profile.activityLevel] ?? d.profile.activityLevel}</span></div>
        <div class="info-row"><span class="info-key">Meals per day</span><span class="info-val">${d.profile.mealsPerDay}</span></div>
        <div class="info-row"><span class="info-key">Wellness goals</span><span class="info-val">${d.profile.goals.map(g => GOAL_LABELS[g] ?? g).join(", ") || "—"}</span></div>
        <div class="info-row"><span class="info-key">Allergens / restrictions</span><span class="info-val">${d.profile.allergens || "None"}</span></div>
      </div></div>`;

  // ── Daily plan
  const planHTML = !d.dailyPlan
    ? `<p class="empty">No daily plan generated yet. Go to the Daily Plan tab and generate one before printing.</p>`
    : `<div class="plan-box">${d.dailyPlan.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

  // ── Recommendations
  const recsHTML = !d.recommendations
    ? `<p class="empty">No recommendations generated yet. Go to the Recommendations tab and generate them before printing.</p>`
    : `<div class="recs-box">${d.recommendations.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

  // ── Today's conversation
  const msgsHTML = todayMsgs.length === 0
    ? `<p class="empty">No chat messages recorded today.</p>`
    : `<div class="msgs">${todayMsgs.map((m) => `
        <div class="${m.role === "user" ? "msg-user" : "msg-agent"}">
          <p class="msg-role">${m.role === "user" ? "You" : "Nutri Agent"}</p>
          <p class="msg-text">${m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          <p class="msg-time">${new Date(m.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>`).join("")}</div>`;

  const body = `
    <div class="doc-header">
      <div><h1>BeatAhead Nutrition Report</h1>
        <p style="color:#64748b;font-size:13px;margin-top:4px">${dateLabel}</p></div>
      <div class="doc-header-right"><p>Generated</p><p style="color:#475569">${gen}</p></div>
    </div>
    ${wellnessHTML}
    <h2>Nutrition Profile</h2>${profileHTML}
    <h2>Daily Nutrition Plan</h2>${planHTML}
    <h2>Wellness Recommendations</h2>${recsHTML}
    <h2>Today's Chat (${todayMsgs.length} message${todayMsgs.length !== 1 ? "s" : ""})</h2>${msgsHTML}
    <div class="disclaimer">⚠️ This report is for personal wellness tracking only. Wellness indicator data comes from a research prototype and is not clinically validated. Not a substitute for medical or dietary advice.</div>
    <div class="footer">BeatAhead ISI Platform · ${gen}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BeatAhead Nutrition Report</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NutriReport() {
  const { profile, messages } = useNutri();
  const { currentSample, currentScore } = useSimulation();

  const [dailyPlan, setDailyPlan] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayISO = new Date().toISOString().split("T")[0];
  const todayMsgs = messages.filter(
    (m) => new Date(m.timestamp).toISOString().split("T")[0] === todayISO
  );

  async function fetchFromAPI(intent: "daily_plan" | "recommendations", prompt: string): Promise<string> {
    const res = await fetch("/api/nutri-agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        isiContext: {
          score: currentScore.score,
          trend: currentScore.trend,
          baseline: currentScore.baseline,
          label: currentScore.label,
          heartRate: currentSample.heartRate,
          hrv: currentSample.hrv,
          spo2: currentSample.spo2,
          scenario: "report",
          signalQuality: currentSample.signalQuality.overall,
        },
        userProfile: profile,
        intent,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: string })?.error ?? `Request failed (${res.status})`);
    }
    const data = await res.json() as { responseText?: string };
    return data.responseText ?? "No response received.";
  }

  async function generatePlan() {
    setLoadingPlan(true);
    setError(null);
    try {
      const text = await fetchFromAPI("daily_plan", "Generate a daily meal plan based on my profile.");
      setDailyPlan(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate plan.");
    } finally {
      setLoadingPlan(false);
    }
  }

  async function generateRecs() {
    setLoadingRecs(true);
    setError(null);
    try {
      const text = await fetchFromAPI("recommendations", "Generate 5 personalised wellness nutrition tips based on my profile.");
      setRecommendations(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate recommendations.");
    } finally {
      setLoadingRecs(false);
    }
  }

  function handlePrint() {
    const data: NutriReportData = {
      profile,
      messages,
      dailyPlan,
      recommendations,
      isi: {
        score: currentScore.score,
        label: currentScore.label,
        trend: currentScore.trend,
        hrv: currentSample.hrv,
        heartRate: currentSample.heartRate,
        spo2: currentSample.spo2,
        signalQuality: currentSample.signalQuality.overall,
      },
    };
    printViaIframe(buildNutriReport(data));
  }

  const busy = loadingPlan || loadingRecs;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          <CardTitle className="text-base">Print Nutrition Report</CardTitle>
        </div>
        <CardDescription>
          Includes wellness stats, nutrition profile, daily plan, recommendations and today&apos;s chat.
          Generate the plan and recommendations below before printing.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Generate actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Daily plan */}
          <div className={`rounded-xl border p-3.5 space-y-2 transition-colors ${dailyPlan ? "border-emerald-200 bg-emerald-50/40" : "border-navy-200 bg-white"}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-navy-700">Daily Plan</p>
              {dailyPlan && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5">Ready</span>}
            </div>
            <p className="text-[11px] text-navy-500 leading-relaxed">AI-generated meal plan based on your profile.</p>
            <Button
              size="sm"
              variant={dailyPlan ? "outline" : "default"}
              onClick={generatePlan}
              disabled={busy}
              className="w-full gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3 w-3 ${loadingPlan ? "animate-spin" : ""}`} />
              {loadingPlan ? "Generating…" : dailyPlan ? "Regenerate" : "Generate Plan"}
            </Button>
          </div>

          {/* Recommendations */}
          <div className={`rounded-xl border p-3.5 space-y-2 transition-colors ${recommendations ? "border-amber-200 bg-amber-50/40" : "border-navy-200 bg-white"}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-navy-700">Recommendations</p>
              {recommendations && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">Ready</span>}
            </div>
            <p className="text-[11px] text-navy-500 leading-relaxed">5 personalised wellness nutrition tips.</p>
            <Button
              size="sm"
              variant={recommendations ? "outline" : "default"}
              onClick={generateRecs}
              disabled={busy}
              className="w-full gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3 w-3 ${loadingRecs ? "animate-spin" : ""}`} />
              {loadingRecs ? "Generating…" : recommendations ? "Regenerate" : "Generate Tips"}
            </Button>
          </div>
        </div>

        {/* Report preview summary */}
        <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-4 space-y-2">
          <p className="text-xs font-bold text-navy-700 uppercase tracking-wide">Report includes</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-navy-600">
            {[
              `ISI ${currentScore.score.toFixed(1)} — ${currentScore.label}`,
              `HR ${Math.round(currentSample.heartRate)} bpm · HRV ${Math.round(currentSample.hrv)} ms`,
              `SpO₂ ${currentSample.spo2.toFixed(1)}%`,
              `Profile: ${profile.isProfileComplete ? "Complete" : "Incomplete"}`,
              `Daily plan: ${dailyPlan ? "✓ Ready" : "Not generated"}`,
              `Recommendations: ${recommendations ? "✓ Ready" : "Not generated"}`,
              `Chat today: ${todayMsgs.length} message${todayMsgs.length !== 1 ? "s" : ""}`,
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5 bg-white border border-navy-100 rounded-lg px-2.5 py-1.5 leading-snug">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />{item}
              </span>
            ))}
          </div>
        </div>

        {/* Print button */}
        <Button
          onClick={handlePrint}
          className="w-full gap-2 font-bold text-sm py-3 bg-emerald-700 hover:bg-emerald-800"
          size="default"
          disabled={busy}
        >
          <Printer className="h-4 w-4" />
          Print Full Nutrition Report
        </Button>
      </CardContent>
    </Card>
  );
}
