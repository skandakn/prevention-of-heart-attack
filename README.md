<div align="center">

# 🫀 BeatAhead — Ischemic Stress Index (ISI)
### Multi-Modal Physiological AI Early-Warning Platform for Perioperative Myocardial Ischemia & Prevention of Heart Attacks

[![Live Deployed Web App](https://img.shields.io/badge/Live%20Platform-Vercel%20Production-success?style=for-the-badge&logo=vercel&logoColor=white)](https://prevention-of-heart-attack-txdb.vercel.app/)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/skandakn/prevention-of-heart-attack)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.0-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![XGBoost](https://img.shields.io/badge/ML%20Core-XGBoost%20Frozen-FF6600?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://xgboost.readthedocs.io/)
[![ElevenLabs](https://img.shields.io/badge/Voice%20AI-ElevenLabs%20TTS-000000?style=for-the-badge)](https://elevenlabs.io/)
[![Google Gemini](https://img.shields.io/badge/Clinical%20LLM-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

<br />

**[🚀 Live Demo](https://prevention-of-heart-attack-txdb.vercel.app/)** • **[📑 Hackathon Technical PDF](BeatAhead_ML_Model_and_System_Hackathon_Guide.pdf)** • **[🎤 Judge Presentation Speech](BeatAhead_Judge_Presentation_Speech_and_Defense.pdf)** • **[🧬 Methodology](/methodology)**

</div>

---

> [!CAUTION]
> **RESEARCH & INVESTIGATIONAL CLINICAL PROTOTYPE ONLY**:  
> BeatAhead is an experimental research system designed for retrospective benchmarking and non-diagnostic risk screening. It is **NOT** an FDA-cleared or CE-marked medical device and must **NEVER** replace formal 12-lead electrocardiography, clinical stress testing, emergency medical dispatch, or physician judgment.

---

## ⚡ The Clinical Problem & The BeatAhead Solution

Every year, over **200 million major surgical procedures** occur worldwide. **Perioperative myocardial ischemia** is the leading silent predictor of postoperative heart attacks and in-hospital mortality.

```
CONVENTIONAL MONITORING (REACTIVE & DANGEROUS)
Normal Rhythm ────────────────────────────────► ST Crashes past -1.0 mm ──► [ALARM BEEPS]
                                                                            (Tissue Damage Underway!)

BEATAHEAD AI PLATFORM (PREDICTIVE & PROACTIVE)
Normal Rhythm ──► [5-Min Lead Gap] ──► Sub-Visual ST Micro-Drift ──► [EARLY WARNING ALERT]
                  (T_obs = 300s)       (T_gap = 300s)                 5 Minutes in Advance!
```

- **The Limitation of Current Monitors:** Standard bedside monitors only sound an alarm *after* the ST segment depression breaches $\le -1.0\text{ mm}$. By the time the alarm sounds, cardiomyocytes are already hypoxic and vulnerable to necrosis.
- **The BeatAhead Breakthrough:** BeatAhead implements an enforced **5-minute advance warning window** ($T_{\text{obs}}=300\text{s}, T_{\text{gap}}=300\text{s}, T_{\text{target}}=300\text{s}$) with an audited **0.8896 AUROC** and **99.71% specificity**, detecting insidious subendocardial ischemia *before* overt failure occurs.

---

## 📊 Proven Model Performance Benchmarks

Trained and cross-validated on **100 Surgical Patients from the VitalDB Open Clinical Registry**:

| Metric | Benchmark Result | Clinical Significance |
| :--- | :---: | :--- |
| **Development AUROC** | **`0.8896`** | High discrimination between pre-ischemic drift and normal surgical physiology |
| **Precision-Recall AUC (PR-AUC)** | **`0.3247`** | **~75&times; higher** than the 0.0043 natural clinical prevalence baseline |
| **Locked Test Specificity** | **`99.71%`** | Extreme stability; prevents overwhelming surgical staff with false alerts |
| **False Alarm Rate (FAR)** | **`0.173 alarms / hr`** | **Fewer than 1 false alert every 5.77 hours** (solves hospital alarm fatigue) |
| **Advance Predictive Horizon** | **`5 Minutes (300s)`** | Enforced blank buffer ($T_{\text{gap}} = 300\text{s}$) proves zero data leakage |
| **Operating Decision Threshold** | **`τ = 0.156742`** | Mathematically calibrated via $\text{argmax}(F_1)$ on out-of-fold surgical folds |
| **Inference Latency** | **`< 2 ms`** | Real-time CPU edge evaluation on serverless Vercel edge nodes |

---

## 🏗️ End-to-End System Architecture

```
                                  BEATAHEAD ARCHITECTURE
                                  
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 1. PHYSIOLOGICAL MULTI-MODAL SENSING                                   │
  │    • ECG Lead II (500 Hz)          • Finger PPG Plethysmogram (500 Hz) │
  │    • Solar8000 ST_II (1 Hz)        • Pulse Oximetry SpO2 (1 Hz)        │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 2. TEMPORAL SYNCHRONIZATION & SIGNAL QUALITY FILTERING (SQI)           │
  │    • Sub-ms alignment between ECG R-peak & PPG wave foot delay         │
  │    • Pulse Arrival Time (PAT) computation & plausibility check         │
  │    • Quality Gate: Alerts suppressed if SQI < 0.35 (Noisy Electrocautery)│
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 3. 26-FEATURE MATRIX A PHYSIOLOGICAL CANONICAL VECTOR                  │
  │    • Cardiac HRV (8)               • Vascular Hemodynamics / PAT (4)   │
  │    • Perfusion & Pulse (4)         • SpO2 Oxygenation (4)              │
  │    • ST Repolarization Dynamics (6)                                    │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 4. FROZEN XGBOOST MODEL & 3-TIER RESILIENT GATEWAY                     │
  │    POST /api/ml/predict                                                │
  │    ├─ Tier 1: Cloud Run FastAPI Microservice (beatahead_phase5_model)   │
  │    ├─ Tier 2: Local CLI Virtual Environment Daemon                     │
  │    └─ Tier 3: Calibrated In-Process Edge Evaluator (< 2ms on Vercel)   │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 5. ISCHEMIC STRESS INDEX (ISI) ENGINE & GATED ANTI-DRIFT               │
  │    ISI = 40.0 + 60.0 × [ 0.45 E_model + 0.30 D_auto + 0.25 D_perf ]   │
  │    • Gated Anti-Drift Locks Baseline Updates During Acute Elevations    │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 6. REACTIVE CLINICAL SUITE                                             │
  │    • /dashboard (Live Gauge & Metrics)   • /monitor (60 FPS Oscilloscope)│
  │    • /signals (26-Feature Telemetry)     • /insights (SHAP Explainability)│
  │    • /trends (24h/7d/30d Longitudinal)  • /helpline (Voice Triage)     │
  │    • /clinician (Tamper-Evident SHA-256 Audit Records)                 │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 What Does the ISI Score Indicate?

The **Ischemic Stress Index (ISI)** maps patient state into four standardized operational tiers:

```
[  0 ─── 30  ]  🟢 LOW OBSERVED TREND      (Healthy homeostasis, normal resting vitals)
[ 31 ─── 60  ]  🟡 NORMAL SURGICAL BASELINE (ISI ≈ 35-45, routine intraoperative monitoring)
[ 61 ─── 80  ]  🟠 ELEVATED ISCHEMIC ALERT  (5-MIN ADVANCE EARLY WARNING! ST micro-drift & PAT elongation)
[ 81 ─── 100 ]  🔴 CRITICAL CARDIAC ALERT   (Active severe ischemia / ST ≤ -1.0mm, emergency intervention)
```

- **0 – 30 (Low Risk):** Robust heart rate variability ($SDNN > 45\text{ ms}$), stable microvascular perfusion, normal SpO₂ (&ge; 98%).
- **31 – 60 (Intermediate / Normal Baseline):** Represents stable baseline physiology. Calibrated with an anchor baseline of 40.0. No intervention needed.
- **61 – 80 (Elevated Early Warning):** **The Primary Clinical Innovation.** Model probability crosses $\tau = 0.156742$. Detects insidious downward ST micro-drifts and autonomic strain **5 minutes before conventional alarms sound**.
- **81 – 100 (Critical Distress):** Acute ischemia active; sustained ST depression $\le -1.0\text{ mm}$ for $\ge 60$ seconds. Triggers automated clinical escalation.

---

## 🌟 Core Application Modules

| Route | Module Name | Interactive Capabilities |
| :--- | :--- | :--- |
| **`/dashboard`** | **Live Physiological Command Center** | Hero circular ISI gauge, live ML probability card, personal baseline tracker, contribution bars, and interactive scenario switcher. |
| **`/monitor`** | **Real-Time Waveform Viewer** | 60 FPS multi-channel canvas oscilloscope (ECG Lead II, PPG Pulse, SpO₂), live Signal Quality Index (SQI) meters, and advance warning banners. |
| **`/signals`** | **26-Feature Matrix A Vector Grid** | Real-time diagnostic telemetry grid displaying all 26 canonical features, physiological ranges, active values, and modality tags. |
| **`/trends`** | **Long-Term Trend Analytics** | 24-hour, 7-day, and 30-day historical time-series filtering across ISI, HRV, SpO₂, Heart Rate, and Motion Intensity with an Insight Timeline. |
| **`/insights`** | **AI Explainability & SHAP Analytics** | Feature attribution bars ($E_{\text{model}}$, $D_{\text{auto}}$, $D_{\text{perf}}$, Motion Impact) and the frozen XGBoost model card. |
| **`/helpline`** | **24/7 Vocal Cardiac Triage** | Real-time browser voice triage powered by **Groq Whisper STT**, **Gemini 2.5 Flash**, and **ElevenLabs AI voice** with automated clinical finding extraction. |
| **`/clinician`** | **Clinician Decision Support Portal** | Longitudinal patient records, risk progression charts, and one-click JSON clinical audit export embedding model provenance and SHA-256 artifact hashes. |
| **`/health-record`** | **Google Fit Sync Bridge** | Integrates wearable REST APIs (Google Fit) to map resting heart rate and historical baseline health markers directly into dynamic ISI scores. |

---

## 🧬 Input Feature Schema (Matrix A — 26 Features)

All 26 features are derived strictly from the observation window ($T_{\text{obs}} = 300\text{s}$) and validated against biological boundaries:

<details>
<summary><strong>Click to expand the full 26-Feature Physiological Schema</strong></summary>

| # | Feature Name | Modality | Unit | Biological Bounds | Clinical Meaning |
| :-: | :--- | :---: | :---: | :---: | :--- |
| 1 | `ecg_hr_mean` | ECG II | bpm | $[20.0, 300.0]$ | Mean heart rate over 5-minute observation window |
| 2 | `ecg_hr_std` | ECG II | bpm | $[0.0, 150.0]$ | Heart rate standard deviation (autonomic modulation) |
| 3 | `ecg_rr_sdnn` | ECG II | ms | $[0.0, 1000.0]$ | Standard deviation of normal-to-normal RR intervals |
| 4 | `ecg_rr_rmssd` | ECG II | ms | $[0.0, 1000.0]$ | Root mean square of successive RR interval differences (parasympathetic tone) |
| 5 | `ecg_pnn50` | ECG II | % | $[0.0, 100.0]$ | Percentage of adjacent RR intervals differing by $>50\text{ ms}$ |
| 6 | `ecg_r_amp_mv` | ECG II | mV | $[-2.0, 15.0]$ | Median R-wave peak amplitude relative to isoelectric baseline |
| 7 | `ecg_qrs_width_ms` | ECG II | ms | $[30.0, 300.0]$ | QRS complex conduction velocity duration |
| 8 | `ecg_sqi` | ECG II | ratio | $[0.0, 1.0]$ | Electrocardiogram signal-to-noise ratio and kurtosis quality index |
| 9 | `pat_median_ms` | ECG+PPG | ms | $[50.0, 600.0]$ | Median Pulse Arrival Time (QRS peak to PPG foot delay; proxy for arterial tone) |
| 10 | `pat_iqr_ms` | ECG+PPG | ms | $[0.0, 500.0]$ | Interquartile range of PAT (vascular transit stability across beats) |
| 11 | `pat_valid_fraction`| ECG+PPG | ratio | $[0.0, 1.0]$ | Fraction of cardiac cycles with physiologically plausible PAT (100–450 ms) |
| 12 | `pat_valid` | ECG+PPG | binary| $[0, 1]$ | Quality gate flag (&ge; 30% valid cardiac beats) |
| 13 | `ppg_pulse_amp` | PPG | a.u. | $[0.0, 50000.0]$ | Median peak-to-trough photoplethysmogram pulsatile amplitude |
| 14 | `ppg_perfusion_index`| PPG | % | $[0.0, 10000.0]$ | Ratio of pulsatile AC signal to non-pulsatile DC baseline |
| 15 | `ppg_crest_time_ms` | PPG | ms | $[20.0, 500.0]$ | Time from pulse foot to systolic peak (arterial compliance metric) |
| 16 | `ppg_sqi` | PPG | ratio | $[0.0, 1.0]$ | Morphological correlation against clean template PPG waveform |
| 17 | `spo2_mean` | SpO2 | % | $[40.0, 100.0]$ | Mean pulse oximeter oxygen saturation |
| 18 | `spo2_min` | SpO2 | % | $[30.0, 100.0]$ | Nadir oxygen saturation during observation |
| 19 | `spo2_std` | SpO2 | % | $[0.0, 40.0]$ | Oxygen saturation volatility standard deviation |
| 20 | `spo2_desat_count` | SpO2 | sec | $[0, 300]$ | Cumulative duration of arterial desaturation ($\text{SpO2} \le 90\%$) |
| 21 | `st_obs_mean` | ST II | mm | $[-15.0, 15.0]$ | Mean ST segment deviation in Lead II |
| 22 | `st_obs_median` | ST II | mm | $[-15.0, 15.0]$ | Median ST segment level during observation |
| 23 | `st_obs_min` | ST II | mm | $[-15.0, 15.0]$ | Most severe ST segment depression in Lead II |
| 24 | `st_obs_std` | ST II | mm | $[0.0, 15.0]$ | ST segment volatility and instability |
| 25 | `st_delta_baseline`| ST II | mm | $[-15.0, 15.0]$ | ST shift relative to patient's initial 10-minute surgical baseline |
| 26 | `st_slope_mm_min` | ST II | mm/min| $[-20.0, 20.0]$ | Linear regression rate of change of ST segment over time |

</details>

---

## 🛠️ Technology Stack

- **Framework:** Next.js 15.1.0 (App Router)
- **UI & Styling:** React 19, TailwindCSS, Radix UI, Lucide Icons
- **Visualizations:** Recharts, Canvas 2D Oscilloscope (60 FPS)
- **Machine Learning Core:** XGBoost (`XGBClassifier`), Scikit-Learn, Joblib, SHAP (TreeExplainer)
- **Voice & Telephony:** Groq Whisper STT (`whisper-large-v3-turbo`), Google Gemini 2.5 Flash, ElevenLabs Multilingual v2
- **Authentication & Billing:** Clerk Auth Middleware, Razorpay Subscription Gateway
- **External Integrations:** Google Fitness API OAuth2, VitalDB Open Dataset Pipeline

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js &ge; 18.18.0
- npm / yarn / pnpm

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/skandakn/prevention-of-heart-attack.git
cd prevention-of-heart-attack
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Key environment variables:
```env
# Clinical AI & Vocal Triage
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=your_groq_api_key
GROQ_STT_MODEL=whisper-large-v3-turbo
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb

# Machine Learning Service (Optional - In-process fallback is active by default)
ML_SERVICE_URL=http://127.0.0.1:8000
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏆 Hackathon Defense & Documentation Resources

The project includes complete, pre-compiled PDF documentation for judging panels:

- **[Technical Model & Architecture Whitepaper](BeatAhead_ML_Model_and_System_Hackathon_Guide.pdf)**: 14-page clinical engineering manual covering data extraction, SQI filters, temporal tri-window formulation, XGBoost cross-validation, and 17 judge Q&As.
- **[Presenter Speech & Judge Defense Manual](BeatAhead_Judge_Presentation_Speech_and_Defense.pdf)**: 5-page presenter guide containing word-for-word spoken pitch scripts for Overview, Trends, and AI Insights, plus numbers to memorize.

---

## ⚖️ License & Ethical Disclaimer

BeatAhead is developed as an open-access research prototype for hackathon competition and academic demonstration.

```
DISCLAIMER:
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. THIS PLATFORM IS NOT INTENDED FOR DIRECT CLINICAL DIAGNOSIS OR
STANDALONE PATIENT MONITORING. ALWAYS CONSULT QUALIFIED CARDIOLOGISTS OR
CALL EMERGENCY SERVICES (911 / 112 / 108) FOR ACUTE CARDIAC SYMPTOMS.
```
