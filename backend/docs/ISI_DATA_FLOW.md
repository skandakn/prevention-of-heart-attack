# BeatAhead ISI End-to-End Data Flow Architecture
**Document ID:** BEATAHEAD-ISI-DATA-FLOW-V1.0  
**Status:** SPECIFICATION ONLY  
**Date:** 2026-09-22  

---

## 1. High-Level Flow Pipeline

The end-to-end data pipeline routes raw continuous physiological streams into standardized features, executes inference against the frozen machine learning model, applies personal baseline and signal quality gating, calculates the composite Ischemic Stress Index (ISI), and renders contextual visualizations across user interface surfaces.

```
+-------------------------------------------------------------------------------------------------------------+
|                                        BEATAHEAD END-TO-END DATA FLOW                                       |
+-------------------------------------------------------------------------------------------------------------+

 [ 1. RAW SIGNALS ]
     |-- ECG Lead II (500 Hz)
     |-- Photoplethysmogram (PPG, 100 Hz)
     |-- Pulse Oximeter (SpO2, 1 Hz)
     +-- Accelerometer / IMU (50 Hz)
            |
            v
 [ 2. PREPROCESSING & WINDOWING ]
     |-- Bandpass Filtering & Baseline Wander Removal (0.5 - 40 Hz)
     |-- Peak Detection & Pulse Waveform Segmentation
     |-- Moving Buffer: 300s Observation Window (T_obs = 300s)
     +-- Synchrony Alignment: R-Peak to PPG Foot Pulse Arrival Time (PAT)
            |
            v
 [ 3. FEATURE EXTRACTION ]
     |-- 26 Matrix A Multimodal Features
     |   * 8 ECG Features (HR mean/std, SDNN, RMSSD, pNN50, R-amp, QRS width, ECG SQI)
     |   * 4 PAT Features (median, IQR, valid fraction, valid flag)
     |   * 4 PPG Features (pulse amp, perfusion index, crest time, PPG SQI)
     |   * 4 SpO2 Features (mean, min, std, desat count)
     |   * 6 ST Deviation Features (mean, median, min, std, baseline delta, slope)
     +-- Quality Indicators (ECG SQI, PPG SQI, PAT Valid, Motion Intensity)
            |
            +---------------------------------------+
            |                                       |
            v                                       v
 [ 4. FROZEN ML INFERENCE ]             [ 5. QUALITY & BASELINE ENGINE ]
     * Frozen XGBoost Matrix A              * Signal Quality Gating (Q_overall)
     * Models Dir: models/                  * Personal Baseline Tracker (EMA alpha=0.02)
     * Output:                              * Feature Baseline Deviations (Delta HR, Delta SDNN, Delta PAT)
       - p_model in [0, 1]                  * Short-Term Trend Velocity (5-min slope)
       - Threshold tau = 0.156742           +-- IMU Motion Gating & Lockout
       - Binary Alert State (0 or 1)                |
            |                                       |
            v                                       v
     [ 6. MODEL EVIDENCE TRANSFORM ]                |
       * Piecewise Sigmoidal Scaling                |
       * Maps tau (0.156742) -> 0.50                |
       * Yields E_model in [0, 1]                   |
            |                                       |
            +-------------------+-------------------+
                                |
                                v
 [ 7. ISI COMPOSITE FUSION ENGINE ]
     * Multi-Factor Weighted Aggregation:
       - Model Evidence: E_model * 0.45
       - Autonomic Deviation: D_auto * 0.30
       - Perfusion / Oxygenation Strain: D_perf * 0.25
       - Trend Momentum Modifier: M_trend (+/- 0.15)
     * Personal Resting Anchor: ISI_base (40)
     * Strict Mathematical Range Clamping: 0 <= ISI <= 100
     * Confidence Scoring: Confidence = Q_overall * (1 - Motion)
            |
            v
 [ 8. PRODUCT STATE MACHINE CONTROLLER ]
     * Evaluates Quality, Baseline Progress, Model Alert, and ISI Level
     * Transitions between 5 Discrete States:
       - 1. Insufficient Signal Quality
       - 2. Baseline Establishing
       - 3. Normal / Stable
       - 4. Elevated Model Evidence
       - 5. Elevated ISI Trend
            |
            v
 [ 9. USER INTERFACE RENDERING ]
     |-- Live Monitor (/monitor): Real-time Circular Gauge + 120s Rolling Trend Chart
     |-- AI Insights (/insights): Research Model Signal Card + Feature Contribution Breakdown
     |-- Trends (/trends): 24h / 7d / 30d Historical Longitudinal Progression
     |-- Dashboard (/dashboard): Executive Overview & Daily Risk Trend Banner
     +-- System Header & Badges: "RESEARCH MODEL — SIMULATED INPUT" vs "LIVE PHYSIOLOGICAL INPUT"
```

---

## 2. Detailed Pipeline Stages & Transformations

```mermaid
flowchart TD
    subgraph S1["Stage 1: Multi-Sensor Ingestion"]
        A1["ECG Lead II (500Hz)"]
        A2["PPG Optical (100Hz)"]
        A3["Pulse Oximeter SpO2 (1Hz)"]
        A4["IMU Accelerometer (50Hz)"]
    end

    subgraph S2["Stage 2: 300s Window Preprocessing"]
        B1["QRS Peak & R-Wave Detector"]
        B2["PPG Foot & Systolic Peak Detector"]
        B3["PAT Delay Synchronizer"]
        B4["Lead II ST Segment Sampler"]
    end

    subgraph S3["Stage 3: Feature Extraction (Schema v1.0.0)"]
        C1["Matrix A Vector (26 Features)"]
        C2["Signal Quality Indices (ECG/PPG SQI, Motion)"]
    end

    subgraph S4["Stage 4: Frozen ML Model"]
        D1["Frozen XGBoost Model Artifact"]
        D2["Model Probability p_model"]
        D3["Threshold Comparator (tau = 0.156742)"]
        D4["Binary Alert State: 0 or 1"]
        D5["Normalized Evidence E_model"]
    end

    subgraph S5["Stage 5: Quality & Baseline Gating"]
        E1["Personal Baseline Memory (EMA)"]
        E2["Baseline Deviation Engine"]
        E3["Signal Quality Gate (Q_overall >= 0.35)"]
        E4["Trend Velocity Engine (5-min slope)"]
    end

    subgraph S6["Stage 6: ISI Fusion Engine"]
        F1["Multi-Source Aggregator"]
        F2["Range Clamper (0 <= ISI <= 100)"]
        F3["Confidence Estimator"]
    end

    subgraph S7["Stage 7: State Machine Controller"]
        G1{"Quality Check"}
        G2{"Baseline Check"}
        G3{"Model Alert?"}
        G4{"ISI >= 61?"}
        
        ST1["State 1: Insufficient Signal Quality"]
        ST2["State 2: Baseline Establishing"]
        ST3["State 3: Normal / Stable"]
        ST4["State 4: Elevated Model Evidence"]
        ST5["State 5: Elevated ISI Trend"]
    end

    subgraph S8["Stage 8: UI Surfaces"]
        H1["Live Monitor Gauge (/monitor)"]
        H2["AI Insights (/insights)"]
        H3["Historical Trends (/trends)"]
        H4["Dashboard Banner (/dashboard)"]
    end

    %% Routing
    A1 --> B1
    A2 --> B2
    A1 & A2 --> B3
    A1 --> B4
    A3 --> C1
    A4 --> C2

    B1 & B2 & B3 & B4 --> C1
    B1 & B2 & A4 --> C2

    C1 --> D1
    D1 --> D2 --> D3 --> D4
    D2 --> D5

    C1 & C2 --> E1
    E1 --> E2
    C2 --> E3
    F2 --> E4

    D5 & E2 & E4 --> F1
    F1 --> F2
    E3 & C2 --> F3

    E3 -->|Failed| ST1
    E3 -->|Passed| G1
    G1 --> G2
    G2 -->|Pending <600s| ST2
    G2 -->|Ready| G3
    G3 -->|Yes p>=tau| ST4
    G3 -->|No p<tau| G4
    G4 -->|Yes ISI>=61| ST5
    G4 -->|No ISI<61| ST3

    F2 & F3 & ST1 & ST2 & ST3 & ST4 & ST5 --> H1
    D2 & D4 & D5 & F1 --> H2
    F2 --> H3
    ST3 & ST4 & ST5 --> H4
```

---

## 3. Data Transformations & Type Mappings

### Transformation A: Raw Waveforms $\rightarrow$ Feature Vector
- **Input**: 150,000 raw ECG samples, 30,000 PPG samples, 300 SpO2 samples, 15,000 IMU samples.
- **Output**: 1 record of 26 floating-point numbers conforming to `feature_schema.json`.
- **Validation**: Strict boundary checks (e.g., $HR \in [20, 300]$, $QRS \in [30, 300]$, $ST \in [-15, 15]$).

### Transformation B: Feature Vector $\rightarrow$ Model Evidence
- **Input**: 26 Matrix A features.
- **Engine**: Frozen XGBoost binary classifier loaded in memory.
- **Output**:
  - $p_{\text{model}} \in [0.0, 1.0]$
  - $\text{ALERT} \in \{0, 1\}$ (where $\text{ALERT} = 1 \iff p_{\text{model}} \ge 0.156742$)
  - $E_{\text{model}} \in [0.0, 1.0]$ via piecewise sigmoid:
    $$E_{\text{model}}(p) = \begin{cases} 
    0.50 \cdot (p / 0.156742)^{1.4} & p < 0.156742 \\
    0.50 + 0.50 \cdot (1 - \exp(-4.0 \cdot \frac{p - 0.156742}{1 - 0.156742})) & p \ge 0.156742
    \end{cases}$$

### Transformation C: Deviations & Evidence $\rightarrow$ ISI Product Score
- **Inputs**: $E_{\text{model}}$, $\Delta HR$, $\Delta SDNN$, $\Delta SpO2$, $\Delta PAT$, Trend Velocity, $ISI_{\text{base}} = 40$.
- **Calculation**:
  $$\text{ISI}_{\text{raw}} = 40 + [0.45(E_{\text{model}} - 0.20) + 0.30 D_{\text{auto}} + 0.25 D_{\text{perf}} + M_{\text{trend}}] \times 60.0$$
- **Output**: Bounded integer:
  $$\text{ISI} \in [0, 100]$$

### Transformation D: Product Score $\rightarrow$ UI State & Copy
- **Inputs**: $\text{ISI}$, $\text{ALERT}$, $Q_{\text{overall}}$, State.
- **Visual Mapping**:
  - `0 - 30`: `"Lower observed trend"` (Green `#10B981`)
  - `31 - 60`: `"Intermediate observed trend"` (Amber `#F59E0B`)
  - `61 - 100`: `"Higher observed trend"` (Red `#DC2626`)
- **Copy Restrictions**: Strictly non-diagnostic; observational phrasing only.

---

## 4. Latency, Buffering & Cadence Budget

| Pipeline Step | Processing Cadence | Latency Budget | Buffer Window | Fault Action |
| :--- | :--- | :--- | :--- | :--- |
| **Sensor Sampling** | Continuous ($50–500\text{ Hz}$) | $< 5\text{ ms}$ | 1-second ring buffer | Reconnect socket |
| **QRS & Beat Extraction** | Real-time per beat (~$1\text{ Hz}$) | $< 10\text{ ms}$ | 10-second beat cache | Hold last rate |
| **Matrix A Windowing** | Rolling every 1–5 seconds | $< 25\text{ ms}$ | 300-second FIFO buffer | Zero pad / drop window |
| **ML Inference (Daemon)** | On window completion | $< 15\text{ ms}$ | N/A | Trigger CLI fallback |
| **ML Inference (CLI Fallback)** | On daemon timeout | $< 450\text{ ms}$ | N/A | Return cached state |
| **Baseline Update** | Every 60 seconds (stable only) | $< 2\text{ ms}$ | 600-second initial baseline | Suppress update |
| **UI Gauge Refresh** | 1000 ms cadence | $< 16\text{ ms}$ (60 fps) | 120-second display history | Retain display state |
