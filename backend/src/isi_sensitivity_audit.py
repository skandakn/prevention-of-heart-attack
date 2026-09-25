"""
src/isi_sensitivity_audit.py

BeatAhead Phase 8.1: ISI Sensitivity & Robustness Audit
Evaluates mathematical properties, parameter perturbations, baseline EMA behavior,
and edge cases of the Phase 8 prototype ISI formula without modifying any model
or website code.
"""

import math
import json
from pathlib import Path
from typing import Dict, Any, Tuple, List
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ---------------------------------------------------------------------------
# Core Constants from Phase 8 Specification
# ---------------------------------------------------------------------------
TAU_FROZEN = 0.156742
GAMMA1_BASE = 1.4
GAMMA2_BASE = 4.0
W_MODEL_BASE = 0.45
W_AUTO_BASE = 0.30
W_PERF_BASE = 0.25
ISI_BASE = 40.0
SCALE_BASE = 60.0
ALPHA_EMA_BASE = 0.02

OUTPUT_DIR = Path("reports/figures/phase8_1")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR = Path("reports")


# ---------------------------------------------------------------------------
# Mathematical Implementation of Phase 8 Specification
# ---------------------------------------------------------------------------
def compute_model_evidence(p: float, tau: float = TAU_FROZEN, gamma1: float = GAMMA1_BASE, gamma2: float = GAMMA2_BASE) -> float:
    """Computes normalized model evidence E_model in [0, 1]."""
    p_clamped = max(0.0, min(1.0, float(p)))
    if p_clamped < tau:
        return 0.50 * math.pow(p_clamped / tau, gamma1)
    else:
        norm_delta = (p_clamped - tau) / (1.0 - tau) if tau < 1.0 else 0.0
        return 0.50 + 0.50 * (1.0 - math.exp(-gamma2 * norm_delta))


def compute_autonomic_factor(hr: float, hr_base: float, sdnn: float, sdnn_base: float) -> float:
    """Computes autonomic shift factor D_auto in [0, 1]."""
    f_hr = max(0.0, min(1.0, (hr - hr_base) / 25.0))
    f_hrv = max(0.0, min(1.0, (sdnn_base - sdnn) / (0.60 * sdnn_base))) if sdnn_base > 0 else 0.0
    return 0.50 * f_hr + 0.50 * f_hrv


def compute_perfusion_factor(spo2: float, spo2_base: float, pat: float, pat_base: float, pat_valid: int) -> float:
    """Computes oxygenation & perfusion factor D_perf in [0, 1]."""
    f_spo2 = max(0.0, min(1.0, (spo2_base - spo2) / 5.0))
    if pat_valid == 1 and pat_base > 0:
        f_pat = max(0.0, min(1.0, (pat_base - pat) / 50.0))
        return 0.60 * f_spo2 + 0.40 * f_pat
    else:
        return f_spo2


def compute_trend_momentum(velocity: float) -> float:
    """Computes trend momentum M_trend in [-0.15, +0.15]."""
    return max(-0.15, min(0.15, velocity / 2.0))


def compute_overall_quality(q_ecg: float, q_ppg: float, v_pat: int, i_motion: float) -> float:
    """Computes overall signal quality Q_overall in [0, 1]."""
    return 0.40 * q_ecg + 0.35 * q_ppg + 0.15 * float(v_pat) + 0.10 * (1.0 - i_motion)


def calculate_isi(
    p_model: float,
    d_auto: float = 0.0,
    d_perf: float = 0.0,
    m_trend: float = 0.0,
    w_model: float = W_MODEL_BASE,
    w_auto: float = W_AUTO_BASE,
    w_perf: float = W_PERF_BASE,
    gamma1: float = GAMMA1_BASE,
    gamma2: float = GAMMA2_BASE,
    isi_base: float = ISI_BASE,
    scale: float = SCALE_BASE
) -> Tuple[int, float, float]:
    """Calculates final bounded ISI score, raw score, and model evidence."""
    e_model = compute_model_evidence(p_model, TAU_FROZEN, gamma1, gamma2)
    inner = w_model * (e_model - 0.20) + w_auto * d_auto + w_perf * d_perf + m_trend
    raw_score = isi_base + inner * scale
    clamped_score = int(round(max(0.0, min(100.0, raw_score))))
    return clamped_score, raw_score, e_model


def determine_state(
    q_overall: float,
    monitoring_time_s: float,
    p_model: float,
    isi_score: int
) -> str:
    """State machine controller from Phase 8 specification."""
    if q_overall < 0.35:
        return "Insufficient Signal Quality"
    if monitoring_time_s < 600.0:
        return "Baseline Establishing"
    if p_model >= TAU_FROZEN:
        return "Elevated Model Evidence"
    if isi_score >= 61:
        return "Elevated ISI Trend"
    return "Normal / Stable"


# ---------------------------------------------------------------------------
# Task 2: Model Evidence Sensitivity Analysis
# ---------------------------------------------------------------------------
def run_task2_model_evidence_sensitivity() -> Dict[str, Any]:
    print("[Task 2] Running model-evidence sensitivity analysis...")
    p_grid = np.linspace(0.0001, 1.0, 1000)
    gamma1_list = [1.2, 1.4, 1.6]
    gamma2_list = [3.0, 4.0, 5.0]

    # Baseline curve
    e_baseline = np.array([compute_model_evidence(p, TAU_FROZEN, GAMMA1_BASE, GAMMA2_BASE) for p in p_grid])

    results = {}
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5))

    # Color map
    styles = {
        (1.4, 4.0): ("#0F172A", 2.8, "-", "Baseline (γ1=1.4, γ2=4.0)"),
        (1.2, 4.0): ("#2563EB", 1.5, "--", "γ1=1.2 (Sub-threshold sensitive)"),
        (1.6, 4.0): ("#0284C7", 1.5, ":", "γ1=1.6 (Sub-threshold conservative)"),
        (1.4, 3.0): ("#D97706", 1.5, "--", "γ2=3.0 (Post-threshold gentle)"),
        (1.4, 5.0): ("#DC2626", 1.5, ":", "γ2=5.0 (Post-threshold aggressive)"),
    }

    # Plot 1: Curves
    for (g1, g2), (col, lw, ls, lbl) in styles.items():
        e_vals = np.array([compute_model_evidence(p, TAU_FROZEN, g1, g2) for p in p_grid])
        isi_contrib = W_MODEL_BASE * (e_vals - 0.20) * SCALE_BASE
        results[f"g1_{g1}_g2_{g2}"] = {
            "max_abs_diff_e": float(np.max(np.abs(e_vals - e_baseline))),
            "mean_abs_diff_e": float(np.mean(np.abs(e_vals - e_baseline))),
            "e_at_threshold": float(compute_model_evidence(TAU_FROZEN, TAU_FROZEN, g1, g2)),
            "e_at_005": float(compute_model_evidence(0.005, TAU_FROZEN, g1, g2)),
            "e_at_030": float(compute_model_evidence(0.30, TAU_FROZEN, g1, g2))
        }
        ax1.plot(p_grid, e_vals, color=col, linewidth=lw, linestyle=ls, label=lbl)
        ax2.plot(p_grid, e_vals - e_baseline, color=col, linewidth=lw, linestyle=ls, label=lbl)

    # Reference lines on ax1
    ax1.axvline(TAU_FROZEN, color="#EF4444", linestyle="-.", alpha=0.7, label=f"Threshold τ = {TAU_FROZEN:.4f}")
    ax1.axhline(0.50, color="#64748B", linestyle="--", alpha=0.5, label="Midpoint E = 0.50")
    ax1.set_title("A. Model Evidence Curve E_model(p)", fontsize=11, fontweight="bold", pad=10)
    ax1.set_xlabel("XGBoost Probability p_model", fontsize=10)
    ax1.set_ylabel("Normalized Evidence E_model [0, 1]", fontsize=10)
    ax1.grid(True, linestyle="--", alpha=0.4)
    ax1.legend(loc="lower right", fontsize=8)
    ax1.set_ylim(-0.02, 1.02)

    # Plot 2: Delta from baseline
    ax2.axvline(TAU_FROZEN, color="#EF4444", linestyle="-.", alpha=0.7)
    ax2.axhline(0.0, color="#0F172A", linestyle="-", linewidth=1.0)
    ax2.set_title("B. Evidence Deviation from Baseline ΔE_model", fontsize=11, fontweight="bold", pad=10)
    ax2.set_xlabel("XGBoost Probability p_model", fontsize=10)
    ax2.set_ylabel("Difference (E_variant - E_baseline)", fontsize=10)
    ax2.grid(True, linestyle="--", alpha=0.4)
    ax2.legend(loc="upper right", fontsize=8)
    ax2.set_ylim(-0.12, 0.12)

    plt.tight_layout()
    plot_path = OUTPUT_DIR / "model_evidence_sensitivity.png"
    plt.savefig(plot_path, dpi=300)
    plt.close()
    print(f"  Saved plot: {plot_path}")

    return results


# ---------------------------------------------------------------------------
# Task 3: Component Weight Sensitivity Analysis
# ---------------------------------------------------------------------------
def run_task3_weight_sensitivity() -> Dict[str, Any]:
    print("[Task 3] Running component-weight sensitivity analysis...")
    p_grid = np.linspace(0.0, 0.6, 200)

    # Triplet sets (w_model, w_auto, w_perf) summing to 1.0
    weight_sets = [
        (0.45, 0.30, 0.25, "Baseline (0.45 / 0.30 / 0.25)", "#0F172A", "-"),
        (0.55, 0.25, 0.20, "Model-Dominant (0.55 / 0.25 / 0.20)", "#2563EB", "--"),
        (0.35, 0.35, 0.30, "Physiology-Dominant (0.35 / 0.35 / 0.30)", "#059669", "-."),
        (0.45, 0.20, 0.35, "Perfusion-Heavy (0.45 / 0.20 / 0.35)", "#D97706", ":"),
        (0.45, 0.40, 0.15, "Autonomic-Heavy (0.45 / 0.40 / 0.15)", "#9333EA", ":"),
    ]

    results = {}
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5))

    # Scenario 1: Isolated Model Drift (d_auto=0, d_perf=0, m_trend=0)
    for w_m, w_a, w_p, lbl, col, ls in weight_sets:
        isi_scores = []
        for p in p_grid:
            score, raw, _ = calculate_isi(p, d_auto=0.0, d_perf=0.0, m_trend=0.0, w_model=w_m, w_auto=w_a, w_perf=w_p)
            isi_scores.append(score)
        ax1.plot(p_grid, isi_scores, color=col, linestyle=ls, linewidth=2.0 if "Baseline" in lbl else 1.4, label=lbl)

    ax1.axvline(TAU_FROZEN, color="#EF4444", linestyle="-.", alpha=0.7, label=f"τ = {TAU_FROZEN:.4f}")
    ax1.axhline(40, color="#64748B", linestyle=":", alpha=0.5, label="Resting Base (40)")
    ax1.axhline(60, color="#F59E0B", linestyle="--", alpha=0.5, label="Risk Threshold (60)")
    ax1.set_title("A. Pure Model Strain (Autonomic & Perfusion Normal)", fontsize=11, fontweight="bold")
    ax1.set_xlabel("p_model", fontsize=10)
    ax1.set_ylabel("ISI Score [0, 100]", fontsize=10)
    ax1.set_ylim(25, 75)
    ax1.grid(True, linestyle="--", alpha=0.4)
    ax1.legend(loc="lower right", fontsize=8)

    # Scenario 2: Combined Multi-Modal Stress (d_auto=0.6, d_perf=0.5, m_trend=0.05)
    for w_m, w_a, w_p, lbl, col, ls in weight_sets:
        isi_scores = []
        for p in p_grid:
            score, raw, _ = calculate_isi(p, d_auto=0.6, d_perf=0.5, m_trend=0.05, w_model=w_m, w_auto=w_a, w_perf=w_p)
            isi_scores.append(score)
        ax2.plot(p_grid, isi_scores, color=col, linestyle=ls, linewidth=2.0 if "Baseline" in lbl else 1.4, label=lbl)

    ax2.axvline(TAU_FROZEN, color="#EF4444", linestyle="-.", alpha=0.7)
    ax2.axhline(60, color="#F59E0B", linestyle="--", alpha=0.5, label="Intermediate Boundary (60)")
    ax2.set_title("B. Multi-Modal Stress (Autonomic=0.6, Perfusion=0.5)", fontsize=11, fontweight="bold")
    ax2.set_xlabel("p_model", fontsize=10)
    ax2.set_ylabel("ISI Score [0, 100]", fontsize=10)
    ax2.set_ylim(40, 100)
    ax2.grid(True, linestyle="--", alpha=0.4)
    ax2.legend(loc="lower right", fontsize=8)

    plt.tight_layout()
    plot_path = OUTPUT_DIR / "component_weight_sensitivity.png"
    plt.savefig(plot_path, dpi=300)
    plt.close()
    print(f"  Saved plot: {plot_path}")

    return results


# ---------------------------------------------------------------------------
# Task 4: Baseline EMA Dynamics & Anti-Drift Analysis
# ---------------------------------------------------------------------------
def run_task4_ema_sensitivity() -> Dict[str, Any]:
    print("[Task 4] Running baseline EMA sensitivity analysis...")
    # Synthetic trajectory: 200 time steps (e.g. minutes)
    # T=0..50: Resting quiet (HR=68 +/- 2)
    # T=51..120: Surgical stress event (HR rises to 88, then returns)
    # T=121..200: Quiet recovery
    np.random.seed(42)
    t = np.arange(200)
    hr_obs = np.full(200, 68.0)
    hr_obs += np.random.normal(0, 1.2, 200)
    # Add stress pulse between t=50 and 120
    stress_pulse = 20.0 * np.exp(-0.5 * ((t - 85) / 15.0) ** 2)
    hr_obs += stress_pulse

    alphas = [0.01, 0.02, 0.05]
    results = {}

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 7.5), sharex=True)

    # Plot Observation
    ax1.plot(t, hr_obs, color="#94A3B8", linewidth=1.0, alpha=0.7, label="Observed Heart Rate (HR_obs)")

    colors = {0.01: "#2563EB", 0.02: "#0F172A", 0.05: "#D97706"}
    styles = {0.01: "--", 0.02: "-", 0.05: "-."}

    for a in alphas:
        # Standard un-gated EMA
        ema = np.zeros(200)
        ema[0] = 68.0
        for i in range(1, 200):
            ema[i] = (1.0 - a) * ema[i - 1] + a * hr_obs[i]
        
        # Gated EMA (Phase 8 Anti-Drift: freeze update when HR > baseline + 8 bpm)
        ema_gated = np.zeros(200)
        ema_gated[0] = 68.0
        for i in range(1, 200):
            if hr_obs[i] > ema_gated[i - 1] + 8.0:
                # Gated: frozen
                ema_gated[i] = ema_gated[i - 1]
            else:
                ema_gated[i] = (1.0 - a) * ema_gated[i - 1] + a * hr_obs[i]

        ax1.plot(t, ema, color=colors[a], linestyle=styles[a], linewidth=1.8 if a == 0.02 else 1.2, label=f"Ungated EMA (α={a})")
        if a == 0.02:
            ax1.plot(t, ema_gated, color="#059669", linewidth=2.2, label="Gated Anti-Drift Baseline (Phase 8 Rule, α=0.02)")

        # Deviations
        dev = ((hr_obs - ema_gated) / ema_gated) * 100.0
        ax2.plot(t, dev, color=colors[a], linestyle=styles[a], linewidth=1.8 if a == 0.02 else 1.2, label=f"Deviation % (α={a})")

    ax1.set_title("A. Baseline Tracking Response to Acute Stress Event", fontsize=11, fontweight="bold")
    ax1.set_ylabel("Heart Rate (bpm)", fontsize=10)
    ax1.grid(True, linestyle="--", alpha=0.4)
    ax1.legend(loc="upper right", fontsize=8)

    ax2.axhline(0, color="#0F172A", linestyle="-", linewidth=0.8)
    ax2.set_title("B. Quantified Baseline Deviation ΔHR (%) Under Gated Architecture", fontsize=11, fontweight="bold")
    ax2.set_xlabel("Time (minutes)", fontsize=10)
    ax2.set_ylabel("Relative Deviation (%)", fontsize=10)
    ax2.grid(True, linestyle="--", alpha=0.4)
    ax2.legend(loc="upper right", fontsize=8)

    plt.tight_layout()
    plot_path = OUTPUT_DIR / "baseline_ema_tracking_analysis.png"
    plt.savefig(plot_path, dpi=300)
    plt.close()
    print(f"  Saved plot: {plot_path}")

    return results


# ---------------------------------------------------------------------------
# Task 5 & 6: Comprehensive Edge Cases & Invariant Verification
# ---------------------------------------------------------------------------
def run_task5_and_6_edge_cases_and_invariants() -> Tuple[List[Dict[str, Any]], Dict[str, bool]]:
    print("[Task 5 & 6] Executing 14 canonical edge cases and mathematical invariant checks...")
    
    cases = [
        {"id": "EC-01", "desc": "p_model = 0.0 (Absolute Minimum)", "p": 0.0, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-02", "desc": "p_model = 0.156742 (Exact Decision Threshold)", "p": TAU_FROZEN, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-03", "desc": "p_model = 0.156741 (Sub-threshold boundary: τ - 1e-6)", "p": TAU_FROZEN - 1e-6, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-04", "desc": "p_model = 0.156743 (Post-threshold boundary: τ + 1e-6)", "p": TAU_FROZEN + 1e-6, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-05", "desc": "p_model = 1.0 (Theoretical Upper Bound)", "p": 1.0, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-06", "desc": "All deviations = 0 (Quiet Normative Baseline)", "p": 0.005, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-07", "desc": "Maximum Allowed Deviations (All factors saturated = 1.0)", "p": 1.0, "d_auto": 1.0, "d_perf": 1.0, "v": 5.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-08", "desc": "Minimum Allowed Deviations (Negative trend, min factors)", "p": 0.0, "d_auto": 0.0, "d_perf": 0.0, "v": -5.0, "q_ecg": 1.0, "q_ppg": 1.0, "v_pat": 1, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-09", "desc": "Missing Optional Input (PAT Invalid, v_pat = 0)", "p": 0.02, "d_auto": 0.2, "d_perf": 0.3, "v": 0.0, "q_ecg": 0.9, "q_ppg": 0.8, "v_pat": 0, "i_motion": 0.1, "t_obs": 1200},
        {"id": "EC-10", "desc": "Poor ECG Signal Quality (Q_ecg = 0.30)", "p": 0.05, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 0.30, "q_ppg": 0.90, "v_pat": 1, "i_motion": 0.1, "t_obs": 1200},
        {"id": "EC-11", "desc": "Simultaneous Poor ECG + PPG (Q_ecg=0.20, Q_ppg=0.20)", "p": 0.10, "d_auto": 0.5, "d_perf": 0.5, "v": 0.0, "q_ecg": 0.20, "q_ppg": 0.20, "v_pat": 0, "i_motion": 0.2, "t_obs": 1200},
        {"id": "EC-12", "desc": "Isolated PAT Invalidation (V_pat = 0)", "p": 0.01, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 0.95, "q_ppg": 0.95, "v_pat": 0, "i_motion": 0.0, "t_obs": 1200},
        {"id": "EC-13", "desc": "High Motion Artifact (I_motion = 0.85)", "p": 0.04, "d_auto": 0.3, "d_perf": 0.2, "v": 0.0, "q_ecg": 0.50, "q_ppg": 0.40, "v_pat": 0, "i_motion": 0.85, "t_obs": 1200},
        {"id": "EC-14", "desc": "All Signals Unavailable (Sensor Disconnected)", "p": 0.0, "d_auto": 0.0, "d_perf": 0.0, "v": 0.0, "q_ecg": 0.0, "q_ppg": 0.0, "v_pat": 0, "i_motion": 1.0, "t_obs": 1200},
    ]

    edge_results = []
    invariants = {
        "all_isi_bounded_0_100": True,
        "monotonically_increasing_evidence": True,
        "exact_threshold_evidence_midpoint": True,
        "zero_quality_triggers_insufficient_state": True,
        "baseline_establishing_holds_before_600s": True,
    }

    # Verify Monotonicity of compute_model_evidence across 10,000 dense points
    p_fine = np.linspace(0.0, 1.0, 10000)
    e_fine = np.array([compute_model_evidence(p) for p in p_fine])
    de = np.diff(e_fine)
    if np.any(de < -1e-9):
        invariants["monotonically_increasing_evidence"] = False

    # Verify continuity and exact midpoint at threshold
    e_thresh = compute_model_evidence(TAU_FROZEN)
    if abs(e_thresh - 0.50) > 1e-6:
        invariants["exact_threshold_evidence_midpoint"] = False

    for c in cases:
        q_overall = compute_overall_quality(c["q_ecg"], c["q_ppg"], c["v_pat"], c["i_motion"])
        m_trend = compute_trend_momentum(c["v"])
        isi, raw, e_mod = calculate_isi(c["p"], c["d_auto"], c["d_perf"], m_trend)
        state = determine_state(q_overall, c["t_obs"], c["p"], isi)

        if isi < 0 or isi > 100:
            invariants["all_isi_bounded_0_100"] = False

        edge_results.append({
            "id": c["id"],
            "desc": c["desc"],
            "p_model": c["p"],
            "e_model": round(e_mod, 4),
            "q_overall": round(q_overall, 3),
            "raw_isi": round(raw, 2),
            "clamped_isi": isi,
            "state": state
        })

    # Test baseline establishing state at t=300s
    state_early = determine_state(0.90, 300.0, 0.01, 40)
    if state_early != "Baseline Establishing":
        invariants["baseline_establishing_holds_before_600s"] = False

    # Test zero quality triggering insufficient signal state
    state_zero_q = determine_state(0.10, 1200.0, 0.01, 40)
    if state_zero_q != "Insufficient Signal Quality":
        invariants["zero_quality_triggers_insufficient_state"] = False

    return edge_results, invariants


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------
def main():
    print("=" * 70)
    print("BeatAhead Phase 8.1 — ISI Sensitivity & Robustness Audit")
    print("=" * 70)

    t2_results = run_task2_model_evidence_sensitivity()
    t3_results = run_task3_weight_sensitivity()
    t4_results = run_task4_ema_sensitivity()
    t5_results, invariants = run_task5_and_6_edge_cases_and_invariants()

    print("\n--- Invariant Verification Summary ---")
    for inv, passed in invariants.items():
        print(f"  [{'PASS' if passed else 'FAIL'}] {inv}")

    # Save summary audit data
    audit_data = {
        "task2_evidence_sensitivity": t2_results,
        "invariants": invariants,
        "edge_cases": t5_results
    }
    audit_json_path = REPORTS_DIR / "phase8_1_audit_data.json"
    with open(audit_json_path, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2)
    print(f"\nSaved structured audit data to: {audit_json_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
