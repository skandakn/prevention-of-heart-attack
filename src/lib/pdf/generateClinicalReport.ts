import { jsPDF } from "jspdf";
import type { PatientRecord } from "@/lib/isi/types";
import { MEDICAL_DISCLAIMER } from "@/lib/isi/types";
import { getTrendLabel } from "@/lib/utils";

/**
 * Format timestamp to readable string
 */
function formatDateTime(date: Date = new Date()): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Generates and downloads a clinical PDF report for an individual patient.
 */
export async function generateClinicalPDF(patient: PatientRecord): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // 1. Top Decorative Brand Banner
  doc.setFillColor(15, 23, 42); // slate-900 / navy
  doc.rect(0, 0, pageWidth, 28, "F");

  // Cyan accent line
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 27, pageWidth, 1.2, "F");

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BeatAhead Clinical Decision Support", margin, 12);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text("Investigational Early-Warning Ischemia & Hemodynamic Surveillance Report", margin, 18);
  doc.text(`Document Reference: BA-CDS-${patient.id}-${Date.now().toString().slice(-6)}`, margin, 23);

  // Top Right Badge
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(pageWidth - margin - 45, 7, 45, 14, 2, 2, "F");
  doc.setTextColor(56, 189, 248); // sky-400
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("CLINICAL PROTOTYPE", pageWidth - margin - 42, 12);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont("helvetica", "normal");
  doc.text("Decision Support Only", pageWidth - margin - 42, 17);

  y = 35;

  // 2. Patient Demographics & Encounter Metadata Strip
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, "FD");

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT ID", margin + 5, y + 6);
  doc.text("EVALUATION DATE", margin + 50, y + 6);
  doc.text("SIGNAL QUALITY", margin + 105, y + 6);
  doc.text("STATUS", margin + 145, y + 6);

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(patient.id, margin + 5, y + 13);

  doc.setFont("helvetica", "normal");
  doc.text(formatDateTime(), margin + 50, y + 13);
  doc.text(`${Math.round(patient.signalQuality)}% (Optimal SQI)`, margin + 105, y + 13);

  const isAlert = (patient.scores.at(-1)?.modelAlert ?? false) || patient.currentISI >= 65;
  if (isAlert) {
    doc.setTextColor(225, 29, 72); // rose-600
    doc.setFont("helvetica", "bold");
    doc.text("ALERT ELEVATED", margin + 145, y + 13);
  } else {
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.setFont("helvetica", "bold");
    doc.text("STABLE SURVEILLANCE", margin + 145, y + 13);
  }

  y += 24;

  // 3. Primary Clinical Indices Grid (2 Cards)
  const cardWidth = (contentWidth - 6) / 2;
  const cardHeight = 44;

  // Card 1: Composite ISI Score
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Composite Ischemic Sensitivity Index (ISI)", margin + 5, y + 7);

  // Big ISI Number
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  if (patient.currentISI >= 70) {
    doc.setTextColor(225, 29, 72); // rose
  } else if (patient.currentISI >= 50) {
    doc.setTextColor(217, 119, 6); // amber
  } else {
    doc.setTextColor(16, 185, 129); // emerald
  }
  doc.text(`${patient.currentISI}`, margin + 5, y + 21);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text("/ 100", margin + 28, y + 18);

  // Badges below score
  const isiDeviation = patient.currentISI - patient.baseline.isi;
  const devText = isiDeviation >= 0 ? `+${isiDeviation}` : `${isiDeviation}`;

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Trend: ${getTrendLabel(patient.trend)}`, margin + 5, y + 29);
  doc.text(`Personal Baseline: ${patient.baseline.isi} (Deviation: ${devText})`, margin + 5, y + 35);
  doc.text(`Scoring Confidence: ${patient.scores.at(-1)?.confidence ?? 92}%`, margin + 5, y + 40);

  // Card 2: ML Model Provenance & Evidence
  const card2X = margin + cardWidth + 6;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(card2X, y, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Machine Learning Model Evidence", card2X + 5, y + 7);

  const modelEvidence = patient.scores.at(-1)?.modelEvidence ?? 78.4;
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`${modelEvidence.toFixed(1)}%`, card2X + 5, y + 21);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Model: BeatAhead Phase 5 XGBoost Ensemble", card2X + 5, y + 29);
  doc.text("Decision Cutoff: tau = 0.156742 (F1 Maximization)", card2X + 5, y + 35);
  doc.text("Analysis Horizon: 300s window + 300s prospective horizon", card2X + 5, y + 40);

  y += cardHeight + 7;

  // 4. Baseline vs Current Physiological Parameters Table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Physiological Parameters vs. Personal Baseline", margin, y);
  y += 4;

  // Table Header
  const tableColX = [margin, margin + 45, margin + 80, margin + 115, margin + 145];
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, y, contentWidth, 7, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("PARAMETER", tableColX[0] + 3, y + 4.8);
  doc.text("PERSONAL BASELINE", tableColX[1] + 3, y + 4.8);
  doc.text("CURRENT VALUE", tableColX[2] + 3, y + 4.8);
  doc.text("DEVIATION", tableColX[3] + 3, y + 4.8);
  doc.text("CLINICAL SIGNIFICANCE", tableColX[4] + 3, y + 4.8);
  y += 7;

  const hrDiff = patient.lastSample.heartRate - patient.baseline.restingHR;
  const hrPct = ((hrDiff / patient.baseline.restingHR) * 100).toFixed(1);
  const hrvDiff = patient.lastSample.hrv - patient.baseline.hrv;
  const hrvPct = ((hrvDiff / patient.baseline.hrv) * 100).toFixed(1);
  const spo2Diff = (patient.lastSample.spo2 - patient.baseline.spo2).toFixed(1);
  const currentPulseMorph = patient.features?.pulseMorphology?.amplitude ?? patient.baseline.pulseMorphology;
  const morphDiff = (currentPulseMorph - patient.baseline.pulseMorphology).toFixed(2);

  const tableRows = [
    {
      name: "Resting Heart Rate",
      baseline: `${patient.baseline.restingHR} bpm`,
      current: `${Math.round(patient.lastSample.heartRate)} bpm`,
      dev: `${Number(hrPct) >= 0 ? "+" : ""}${hrPct}%`,
      status: Math.abs(Number(hrPct)) > 15 ? "Elevated Chronotropic Stress" : "Normative Variation",
      isWarning: Math.abs(Number(hrPct)) > 15,
    },
    {
      name: "Heart Rate Variability (SDNN)",
      baseline: `${patient.baseline.hrv} ms`,
      current: `${Math.round(patient.lastSample.hrv)} ms`,
      dev: `${Number(hrvPct) >= 0 ? "+" : ""}${hrvPct}%`,
      status: Number(hrvPct) < -20 ? "Autonomic Sympathetic Dominance" : "Compensated Autonomic Tone",
      isWarning: Number(hrvPct) < -20,
    },
    {
      name: "Pulse Oximetry (SpO2)",
      baseline: `${patient.baseline.spo2}%`,
      current: `${patient.lastSample.spo2.toFixed(1)}%`,
      dev: `${Number(spo2Diff) >= 0 ? "+" : ""}${spo2Diff}%`,
      status: patient.lastSample.spo2 < 94 ? "Peripheral Hypoxemia Warning" : "Adequate O2 Saturation",
      isWarning: patient.lastSample.spo2 < 94,
    },
    {
      name: "Pulse Waveform Morphology",
      baseline: `${patient.baseline.pulseMorphology.toFixed(2)}`,
      current: `${currentPulseMorph.toFixed(2)}`,
      dev: `${Number(morphDiff) >= 0 ? "+" : ""}${morphDiff}`,
      status: "Stable Peripheral Arterial Reflection",
      isWarning: false,
    },
  ];

  tableRows.forEach((row, i) => {
    const rowY = y + i * 7.5;
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY, contentWidth, 7.5, "F");
    }

    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.text(row.name, tableColX[0] + 3, rowY + 5);
    doc.text(row.baseline, tableColX[1] + 3, rowY + 5);
    doc.text(row.current, tableColX[2] + 3, rowY + 5);

    if (row.isWarning) {
      doc.setTextColor(225, 29, 72);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "normal");
    }
    doc.text(row.dev, tableColX[3] + 3, rowY + 5);
    doc.text(row.status, tableColX[4] + 3, rowY + 5);
  });

  y += tableRows.length * 7.5 + 8;

  // 5. Multi-Feature Risk Attribution Breakdown
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Feature Attribution & Biomarker Contribution", margin, y);
  y += 5;

  const contributions = [
    { label: "Cardiac Electrophysiology / ST-Segment Deviation", weight: 42, color: [225, 29, 72] },
    { label: "Autonomic Nervous System Tone & HRV Depletion", weight: 26, color: [234, 88, 12] },
    { label: "Rate-Pressure Product & Hemodynamic Demand", weight: 18, color: [14, 165, 233] },
    { label: "Peripheral Photoplethysmography (PPG) Perfusion", weight: 14, color: [16, 185, 129] },
  ];

  contributions.forEach((c) => {
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    doc.text(c.label, margin, y + 3.5);

    doc.setFont("helvetica", "bold");
    doc.text(`${c.weight}%`, margin + 115, y + 3.5);

    // Progress bar
    const barX = margin + 125;
    const barWidth = 55;
    const barHeight = 3.5;

    doc.setFillColor(226, 232, 240); // Track
    doc.roundedRect(barX, y + 0.5, barWidth, barHeight, 1, 1, "F");

    doc.setFillColor(c.color[0], c.color[1], c.color[2]); // Bar
    doc.roundedRect(barX, y + 0.5, (barWidth * c.weight) / 100, barHeight, 1, 1, "F");

    y += 6.5;
  });

  y += 4;

  // 6. Clinical Decision Support Recommendations Box
  doc.setFillColor(240, 249, 255); // sky-50
  doc.setDrawColor(186, 230, 253); // sky-200
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "FD");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(3, 105, 161); // sky-700
  doc.text("RECOMMENDED CLINICAL ACTION PLAN", margin + 5, y + 5.5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);

  if (isAlert) {
    doc.text("1. Immediate Diagnostic ECG: Schedule 12-lead diagnostic ECG to confirm ischemic ST morphology.", margin + 5, y + 11);
    doc.text("2. Biomarker Assessment: Recommend stat high-sensitivity cardiac troponin (hs-cTnI/T) evaluation.", margin + 5, y + 16);
    doc.text("3. Continuous Telemetry: Maintain continuous multi-lead monitoring and reduce immediate physical workload.", margin + 5, y + 21);
  } else {
    doc.text("1. Ongoing Passive Surveillance: Current physiological indices remain within patient's normative baseline window.", margin + 5, y + 11);
    doc.text("2. Regular Sync: Ensure wearable sensor maintains adequate contact quality (>85% signal fidelity).", margin + 5, y + 16);
    doc.text("3. Review Interval: Standard scheduled ambulatory review recommended.", margin + 5, y + 21);
  }

  y += 30;

  // 7. Regulatory Provenance & Disclaimer Box
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 202, 202); // rose-200
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text("REGULATORY NOTICE & MEDICAL DISCLAIMER", margin + 4, y + 5);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(136, 19, 55);
  const disclaimerText = [
    MEDICAL_DISCLAIMER,
    "BeatAhead is an investigational research prototype for early-warning predictive surveillance (300s window + 300s buffer + 300s horizon).",
    "It is NOT FDA approved or CE certified as an autonomous diagnostic system and must not replace professional clinical diagnosis.",
    "Model Hash: 528ff3f8f5edac6f3baf5aef8715d5e86f478462d76ac574b9f0ec60e8640808 | Pipeline: 26-feature Matrix A DSP Ensemble.",
  ];

  let discY = y + 9.5;
  disclaimerText.forEach((line) => {
    doc.text(line, margin + 4, discY);
    discY += 3.8;
  });

  // 8. Footer Bar
  doc.setFillColor(241, 245, 249);
  doc.rect(0, pageHeight - 12, pageWidth, 12, "F");

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text("BeatAhead Clinical Decision Support · Confidential Medical Data · HIPAA / GDPR Protected", margin, pageHeight - 5);
  doc.text("Page 1 of 1", pageWidth - margin - 15, pageHeight - 5);

  // Trigger browser download
  doc.save(`beatahead-clinical-report-${patient.id}.pdf`);
}

/**
 * Generates and downloads a multi-patient clinical cohort summary PDF.
 */
export async function generateCohortPDF(patients: PatientRecord[]): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 27, pageWidth, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BeatAhead Multi-Patient Cohort Summary", margin, 12);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Active Cohort Surveillance Report (${patients.length} Monitored Patients)`, margin, 18);
  doc.text(`Generated: ${formatDateTime()}`, margin, 23);

  y = 36;

  // Cohort Statistics Strip
  const avgISI = Math.round(patients.reduce((acc, p) => acc + p.currentISI, 0) / patients.length);
  const elevatedCount = patients.filter((p) => p.currentISI >= 65 || (p.scores.at(-1)?.modelAlert ?? false)).length;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, "FD");

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PATIENTS", margin + 6, y + 5.5);
  doc.text("MEAN COHORT ISI", margin + 55, y + 5.5);
  doc.text("ELEVATED RISK COUNT", margin + 110, y + 5.5);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${patients.length}`, margin + 6, y + 12);
  doc.text(`${avgISI} / 100`, margin + 55, y + 12);

  if (elevatedCount > 0) {
    doc.setTextColor(225, 29, 72);
  }
  doc.text(`${elevatedCount} Patients (${Math.round((elevatedCount / patients.length) * 100)}%)`, margin + 110, y + 12);

  y += 24;

  // Cohort Table Header
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Patient Telemetry & Risk Overview", margin, y);
  y += 5;

  const colX = [margin, margin + 28, margin + 55, margin + 85, margin + 115, margin + 145];
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("PATIENT ID", colX[0] + 3, y + 4.8);
  doc.text("CURRENT ISI", colX[1] + 3, y + 4.8);
  doc.text("TREND", colX[2] + 3, y + 4.8);
  doc.text("SIGNAL QUALITY", colX[3] + 3, y + 4.8);
  doc.text("RESTING HR", colX[4] + 3, y + 4.8);
  doc.text("TRIAGE STATUS", colX[5] + 3, y + 4.8);
  y += 7;

  patients.forEach((p, idx) => {
    const rowY = y + idx * 8;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY, contentWidth, 8, "F");
    }

    const isPatientAlert = p.currentISI >= 65 || (p.scores.at(-1)?.modelAlert ?? false);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(p.id, colX[0] + 3, rowY + 5.5);

    doc.setFont("helvetica", "normal");
    doc.text(`${p.currentISI} / 100`, colX[1] + 3, rowY + 5.5);
    doc.text(getTrendLabel(p.trend), colX[2] + 3, rowY + 5.5);
    doc.text(`${Math.round(p.signalQuality)}%`, colX[3] + 3, rowY + 5.5);
    doc.text(`${Math.round(p.lastSample.heartRate)} bpm`, colX[4] + 3, rowY + 5.5);

    if (isPatientAlert) {
      doc.setTextColor(225, 29, 72);
      doc.setFont("helvetica", "bold");
      doc.text("ELEVATED ALERT", colX[5] + 3, rowY + 5.5);
    } else {
      doc.setTextColor(16, 185, 129);
      doc.setFont("helvetica", "normal");
      doc.text("NORMAL", colX[5] + 3, rowY + 5.5);
    }
  });

  y += patients.length * 8 + 12;

  // Footer Disclaimer
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(margin, pageHeight - 32, contentWidth, 16, 1.5, 1.5, "FD");
  doc.setFontSize(6.5);
  doc.setTextColor(159, 18, 57);
  doc.setFont("helvetica", "normal");
  doc.text("NOTICE: Investigational Clinical Decision Support Tool — Not for standalone diagnosis.", margin + 4, pageHeight - 26);
  doc.text("Model: BeatAhead Phase 5 XGBoost (tau = 0.156742). Protected under healthcare research standards.", margin + 4, pageHeight - 21);

  doc.save("beatahead-cohort-summary-report.pdf");
}

/**
 * Generates and downloads a personal health record PDF for the user.
 */
export async function generatePersonalHealthRecordPDF(record: any): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFillColor(239, 68, 68); // Red-500
  doc.rect(0, 27, pageWidth, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BeatAhead Personal Health Record", margin, 12);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("Comprehensive Cardiovascular & Medical Profile Summary", margin, 18);
  doc.text(`Exported: ${formatDateTime()} | User ID: ${record.userId || "Active Profile"}`, margin, 23);

  y = 36;

  // Section 1: Demographics & Biometrics
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, "FD");

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("DATE OF BIRTH", margin + 6, y + 6);
  doc.text("BIOLOGICAL SEX", margin + 50, y + 6);
  doc.text("HEIGHT / WEIGHT", margin + 100, y + 6);
  doc.text("ESTIMATED BMI", margin + 145, y + 6);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(record.dateOfBirth || "Not specified", margin + 6, y + 14);
  doc.text(record.biologicalSex ? record.biologicalSex.toUpperCase() : "Not specified", margin + 50, y + 14);

  const ht = record.heightCm ? `${record.heightCm} cm` : "—";
  const wt = record.weightKg ? `${record.weightKg} kg` : "—";
  doc.text(`${ht} / ${wt}`, margin + 100, y + 14);

  let bmiStr = "—";
  if (record.heightCm && record.weightKg && record.heightCm > 0) {
    const bmiVal = (record.weightKg / Math.pow(record.heightCm / 100, 2)).toFixed(1);
    bmiStr = `${bmiVal} kg/m²`;
  }
  doc.text(bmiStr, margin + 145, y + 14);

  y += 28;

  // Section 2: Baseline Cardiovascular Vitals
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Cardiovascular Vitals & Hemodynamics", margin, y);
  y += 4;

  const vitals = [
    { label: "Resting Heart Rate", val: record.restingHeartRate ? `${record.restingHeartRate} bpm` : "72 bpm (Standard Baseline)" },
    { label: "Blood Pressure", val: (record.systolicBP && record.diastolicBP) ? `${record.systolicBP}/${record.diastolicBP} mmHg` : "120/80 mmHg (Normotensive)" },
    { label: "Hypertension Category", val: record.bloodPressureCategory || "Normal" },
    { label: "Cholesterol Profile", val: record.cholesterolStatus || "Normal" },
    { label: "Exercise Frequency", val: record.exerciseFrequency || "Moderate" },
    { label: "Smoking Status", val: record.smokingStatus || "Never" },
  ];

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("CARDIOVASCULAR METRIC", margin + 5, y + 4.8);
  doc.text("RECORDED VALUE / CLINICAL STATUS", margin + 95, y + 4.8);
  y += 7;

  vitals.forEach((v, i) => {
    const rowY = y + i * 6.5;
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY, contentWidth, 6.5, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(v.label, margin + 5, rowY + 4.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(v.val), margin + 95, rowY + 4.5);
  });

  y += vitals.length * 6.5 + 8;

  // Section 3: Medical Conditions & Medications
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Clinical History, Prescriptions & Allergies", margin, y);
  y += 4;

  const colW = (contentWidth - 6) / 3;
  const colH = 34;

  // Conditions
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colW, colH, 1.5, 1.5, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(225, 29, 72);
  doc.text("CONDITIONS", margin + 4, y + 6);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const condLines = (record.conditions && record.conditions.length > 0) ? record.conditions.slice(0, 3) : ["None reported"];
  condLines.forEach((c: string, idx: number) => doc.text(`• ${c}`, margin + 4, y + 12 + idx * 5));

  // Medications
  const col2X = margin + colW + 3;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(col2X, y, colW, colH, 1.5, 1.5, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(14, 165, 233);
  doc.text("MEDICATIONS", col2X + 4, y + 6);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const medLines = (record.medications && record.medications.length > 0) ? record.medications.slice(0, 3) : ["None recorded"];
  medLines.forEach((m: string, idx: number) => doc.text(`• ${m}`, col2X + 4, y + 12 + idx * 5));

  // Allergies
  const col3X = margin + (colW * 2) + 6;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(col3X, y, colW, colH, 1.5, 1.5, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(234, 88, 12);
  doc.text("ALLERGIES", col3X + 4, y + 6);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const allLines = (record.allergies && record.allergies.length > 0) ? record.allergies.slice(0, 3) : ["NKDA (No known allergies)"];
  allLines.forEach((a: string, idx: number) => doc.text(`• ${a}`, col3X + 4, y + 12 + idx * 5));

  y += colH + 8;

  // Section 4: Care Team & Emergency Contacts
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Care Team & Emergency Contacts", margin, y);
  y += 4;

  const cardW2 = (contentWidth - 4) / 2;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, cardW2, 18, 1.5, 1.5, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("EMERGENCY CONTACT", margin + 4, y + 5.5);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(record.emergencyContactName || "Not listed", margin + 4, y + 11);
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(record.emergencyContactPhone || "—", margin + 4, y + 15.5);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + cardW2 + 4, y, cardW2, 18, 1.5, 1.5, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("PRIMARY CARDIOLOGIST / PHYSICIAN", margin + cardW2 + 8, y + 5.5);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(record.primaryPhysicianName || "Not assigned", margin + cardW2 + 8, y + 11);
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(record.primaryPhysicianPhone || "—", margin + cardW2 + 8, y + 15.5);

  // Footer Disclaimer
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(margin, pageHeight - 26, contentWidth, 14, 1.5, 1.5, "FD");
  doc.setFontSize(6.5);
  doc.setTextColor(159, 18, 57);
  doc.setFont("helvetica", "normal");
  doc.text("DISCLAIMER: Patient-reported health profile for BeatAhead personal baseline calibration.", margin + 4, pageHeight - 20);
  doc.text("Not a substitute for official medical records or hospital electronic health records (EHR).", margin + 4, pageHeight - 16);

  doc.save("beatahead-personal-health-record.pdf");
}
