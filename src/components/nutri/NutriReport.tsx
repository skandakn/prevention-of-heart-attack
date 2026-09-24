"use client";

import { useNutri } from "@/lib/nutri/NutriContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NutriMessage, NutriProfile } from "@/lib/nutri/types";
import { FileText, Printer } from "lucide-react";

// ─── Label helpers ────────────────────────────────────────────────────────────

const DIET_LABELS: Record<string, string> = {
  none: "No preference", omnivore: "Omnivore", vegetarian: "Vegetarian",
  vegan: "Vegan", pescatarian: "Pescatarian", gluten_free: "Gluten-free",
  dairy_free: "Dairy-free", keto: "Keto", paleo: "Paleo",
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

// ─── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: white; color: #1e2a3a; padding: 32px; font-size: 13px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1 { font-size: 22px; font-weight: 800; margin: 0; }
  h2 { font-size: 14px; font-weight: 700; margin: 0 0 10px; }
  p  { margin: 0; }
  .header { border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px;
            display: flex; justify-content: space-between; align-items: flex-start; }
  .header-right { text-align: right; font-size: 11px; color: #94a3b8; }
  .two-col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 28px; }
  .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
  .stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { font-size: 13px; font-weight: 600; color: #1e2a3a; margin-top: 3px; }
  .msgs { display: flex; flex-direction: column; gap: 10px; }
  .msg-user { background: #1e2a3a; color: white; padding: 10px 14px; border-radius: 10px;
              margin-left: auto; max-width: 88%; }
  .msg-agent { background: #f0fdf4; border: 1px solid #bbf7d0; color: #1e2a3a;
               padding: 10px 14px; border-radius: 10px; max-width: 88%; }
  .msg-role { font-size: 10px; font-weight: 700; text-transform: uppercase;
              letter-spacing: 0.05em; margin-bottom: 4px; }
  .msg-user .msg-role { color: #94a3b8; }
  .msg-agent .msg-role { color: #16a34a; }
  .msg-time { font-size: 10px; opacity: 0.6; margin-top: 6px; }
  .msg-text { white-space: pre-wrap; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0;
            font-size: 10px; color: #94a3b8; text-align: center; }
  .empty { font-style: italic; color: #94a3b8; font-size: 13px; }
`;

// ─── iframe print helper ──────────────────────────────────────────────────────

function printViaIframe(html: string) {
  const existing = document.getElementById("beatahead-print-iframe");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "beatahead-print-iframe";
  iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 250);
  };
}

// ─── Build HTML ───────────────────────────────────────────────────────────────

function buildNutriReportHTML(messages: NutriMessage[], profile: NutriProfile): string {
  const now = new Date();
  const generatedAt = now.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const todayISO = now.toISOString().split("T")[0];
  const todayMessages = messages.filter(
    (m) => new Date(m.timestamp).toISOString().split("T")[0] === todayISO
  );

  const profileHTML = !profile.isProfileComplete
    ? `<p class="empty">Profile not yet completed.</p>`
    : `<div class="two-col">
        ${[
          { label: "Dietary Preference", value: DIET_LABELS[profile.dietaryPreference] ?? profile.dietaryPreference },
          { label: "Activity Level", value: ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel },
          { label: "Meals Per Day", value: String(profile.mealsPerDay) },
          { label: "Goals", value: profile.goals.map((g) => GOAL_LABELS[g] ?? g).join(", ") || "—" },
          { label: "Allergens / Restrictions", value: profile.allergens || "None" },
        ].map(({ label, value }) => `
          <div class="stat-box">
            <p class="stat-label">${label}</p>
            <p class="stat-value">${value}</p>
          </div>`).join("")}
      </div>`;

  const msgsHTML = todayMessages.length === 0
    ? `<p class="empty">No messages recorded today.</p>`
    : `<div class="msgs">${todayMessages.map((m) => `
        <div class="${m.role === "user" ? "msg-user" : "msg-agent"}">
          <p class="msg-role">${m.role === "user" ? "You" : "Nutri Agent"}</p>
          <p class="msg-text">${m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          <p class="msg-time">${new Date(m.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>`).join("")}</div>`;

  const body = `
    <div class="header">
      <div>
        <h1>BeatAhead Nutrition Report</h1>
        <p style="margin-top:4px;color:#64748b;font-size:14px">${dateLabel}</p>
      </div>
      <div class="header-right">
        <p>Generated</p>
        <p style="color:#64748b">${generatedAt}</p>
      </div>
    </div>
    <h2>Nutrition Profile</h2>
    ${profileHTML}
    <h2>Today's Conversation <span style="font-size:12px;font-weight:400;color:#94a3b8">(${todayMessages.length} ${todayMessages.length === 1 ? "message" : "messages"})</span></h2>
    ${msgsHTML}
    <div class="footer">BeatAhead Wellness Platform — This report is for personal wellness tracking only and does not constitute medical advice.</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BeatAhead Nutrition Report</title>
<style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
}

// ─── Main exported component ──────────────────────────────────────────────────

export function NutriReport() {
  const { messages, profile } = useNutri();

  const todayISO = new Date().toISOString().split("T")[0];
  const todayMessages = messages.filter(
    (m) => new Date(m.timestamp).toISOString().split("T")[0] === todayISO
  );

  return (
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

        <Button
          onClick={() => printViaIframe(buildNutriReportHTML(messages, profile))}
          className="gap-2 bg-emerald-700 hover:bg-emerald-800"
          size="sm"
        >
          <Printer className="h-4 w-4" /> Print Today&apos;s Report
        </Button>
      </CardContent>
    </Card>
  );
}
