"""
src/train_and_evaluate_models.py

BeatAhead Phase 5 Machine Learning Modeling & Matrix Ablation Benchmark.
Enforces:
1. Strict Subject-Level Isolation: 80 Dev cases (5-Fold StratifiedGroupKFold) vs 20 Locked Test cases.
2. Dual Matrix Comparison: Model Matrix A (Multimodal + Pre-event ST, 26 features) vs Model Matrix B (Pure Non-ST, 20 features).
3. Evaluates 3 Algorithms: Logistic Regression (Balanced), Random Forest (Balanced Subsample), XGBoost (scale_pos_weight).
4. Out-of-fold cross-validation calibration, locked test evaluation, SHAP explainability, and publication-quality figures.
"""

import os
import sys
import time
import json
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Tuple, Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    precision_recall_curve,
    roc_curve,
    auc,
    average_precision_score,
    roc_auc_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
    classification_report
)
from sklearn.model_selection import StratifiedGroupKFold
import xgboost as xgb
import shap

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
REPORTS_DIR = BASE_DIR / "reports"
FIG_DIR = REPORTS_DIR / "figures" / "phase5_modeling"
SCRATCH_DIR = BASE_DIR / "scratch"

FIG_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------------------
# Feature Matrix Definitions
# ------------------------------------------------------------------------------
FEATURES_MATRIX_A = [
    'ecg_hr_mean', 'ecg_hr_std', 'ecg_rr_sdnn', 'ecg_rr_rmssd', 'ecg_pnn50',
    'ecg_r_amp_mv', 'ecg_qrs_width_ms', 'ecg_sqi',
    'pat_median_ms', 'pat_iqr_ms', 'pat_valid_fraction', 'pat_valid',
    'ppg_pulse_amp', 'ppg_perfusion_index', 'ppg_crest_time_ms', 'ppg_sqi',
    'spo2_mean', 'spo2_min', 'spo2_std', 'spo2_desat_count',
    'st_obs_mean', 'st_obs_median', 'st_obs_min', 'st_obs_std',
    'st_delta_baseline', 'st_slope_mm_min'
]

FEATURES_MATRIX_B = [
    'ecg_hr_mean', 'ecg_hr_std', 'ecg_rr_sdnn', 'ecg_rr_rmssd', 'ecg_pnn50',
    'ecg_r_amp_mv', 'ecg_qrs_width_ms', 'ecg_sqi',
    'pat_median_ms', 'pat_iqr_ms', 'pat_valid_fraction', 'pat_valid',
    'ppg_pulse_amp', 'ppg_perfusion_index', 'ppg_crest_time_ms', 'ppg_sqi',
    'spo2_mean', 'spo2_min', 'spo2_std', 'spo2_desat_count'
]


def load_dataset():
    """Loads and filters the cached window dataset."""
    pkl_path = PROCESSED_DIR / "vitaldb_100_windows.pkl.gz"
    csv_path = PROCESSED_DIR / "vitaldb_100_windows.csv.gz"

    if pkl_path.exists():
        print(f"Loading window dataset from {pkl_path}...")
        df = pd.read_pickle(pkl_path, compression="gzip")
    elif csv_path.exists():
        print(f"Loading window dataset from {csv_path}...")
        df = pd.read_csv(csv_path, compression="gzip")
    else:
        raise FileNotFoundError("Processed window dataset not found in data/processed/")

    print(f"Loaded raw window dataset: {len(df)} rows, {df['caseid'].nunique()} cases.")

    # Filter: Use only usable windows (SQI PASS) and valid labels (0 or 1)
    df_clean = df[(df["sqi_status"] == "PASS") & (df["target_label"].isin([0, 1]))].copy()
    df_clean["target_label"] = df_clean["target_label"].astype(int)

    pos_count = (df_clean["target_label"] == 1).sum()
    neg_count = (df_clean["target_label"] == 0).sum()
    pos_cases = df_clean[df_clean["target_label"] == 1]["caseid"].unique()

    print(f"Filtered clean dataset: {len(df_clean)} windows across {df_clean['caseid'].nunique()} cases.")
    print(f"Class counts: Positive (y=1) = {pos_count}, Negative (y=0) = {neg_count} (Prevalence: {pos_count/len(df_clean)*100:.2f}%)")
    print(f"Positive cases ({len(pos_cases)}): {sorted(pos_cases.tolist())}")

    return df_clean


def create_subject_level_partitions(df_clean: pd.DataFrame, seed: int = 42):
    """
    Creates a strict two-tier subject-level split across all 100 verified cases:
    - 80 Dev cases (40 Cohort A, 40 Cohort B; 6 positive cases)
    - 20 Locked Test cases (10 Cohort A, 10 Cohort B; 2 positive cases)
    """
    print("\n" + "=" * 80)
    print("CREATING TWO-TIER SUBJECT-LEVEL SPLIT (ZERO DATA LEAKAGE)")
    print("=" * 80)

    # Load official 100 verified case IDs
    df_a = pd.read_csv(SCRATCH_DIR / "cohort_a_final_verified.csv")
    df_b = pd.read_csv(SCRATCH_DIR / "cohort_b_final_verified.csv")
    cids_a = df_a["caseid"].tolist()
    cids_b = df_b["caseid"].tolist()

    # Identify positive cases from valid early-warning labels (y=1)
    pos_cases_set = set(df_clean[df_clean["target_label"] == 1]["caseid"].unique())

    pos_a = [c for c in cids_a if c in pos_cases_set]
    neg_a = [c for c in cids_a if c not in pos_cases_set]

    pos_b = [c for c in cids_b if c in pos_cases_set]
    neg_b = [c for c in cids_b if c not in pos_cases_set]

    rng = np.random.RandomState(seed)

    # Test set: Exactly 1 positive from A, 1 positive from B; 9 neg from A, 9 neg from B
    shuffled_pos_a = rng.permutation(pos_a)
    shuffled_neg_a = rng.permutation(neg_a)
    shuffled_pos_b = rng.permutation(pos_b)
    shuffled_neg_b = rng.permutation(neg_b)

    test_pos_a = shuffled_pos_a[:1].tolist()
    dev_pos_a = shuffled_pos_a[1:].tolist()

    test_neg_a = shuffled_neg_a[:9].tolist()
    dev_neg_a = shuffled_neg_a[9:].tolist()

    test_pos_b = shuffled_pos_b[:1].tolist()
    dev_pos_b = shuffled_pos_b[1:].tolist()

    test_neg_b = shuffled_neg_b[:9].tolist()
    dev_neg_b = shuffled_neg_b[9:].tolist()

    test_cases = sorted(test_pos_a + test_neg_a + test_pos_b + test_neg_b)
    dev_cases = sorted(dev_pos_a + dev_neg_a + dev_pos_b + dev_neg_b)

    # Assert mutual exclusivity and completeness
    assert len(set(dev_cases).intersection(set(test_cases))) == 0, "Leakage: Dev and Test overlap!"
    assert len(dev_cases) + len(test_cases) == 100, f"Expected 100 cases, got {len(dev_cases) + len(test_cases)}"
    assert len(test_cases) == 20, f"Expected 20 test cases, got {len(test_cases)}"
    assert len(dev_cases) == 80, f"Expected 80 dev cases, got {len(dev_cases)}"

    df_dev = df_clean[df_clean["caseid"].isin(dev_cases)].copy().reset_index(drop=True)
    df_test = df_clean[df_clean["caseid"].isin(test_cases)].copy().reset_index(drop=True)

    print(f"Dev Set:  {len(dev_cases)} cases ({len(df_dev)} windows, {(df_dev['target_label']==1).sum()} pos, {(df_dev['target_label']==0).sum()} neg)")
    print(f"          Positive Dev Cases: {sorted(list(dev_pos_a) + list(dev_pos_b))}")
    print(f"Test Set: {len(test_cases)} cases ({len(df_test)} windows, {(df_test['target_label']==1).sum()} pos, {(df_test['target_label']==0).sum()} neg)")
    print(f"          Positive Test Cases: {sorted(list(test_pos_a) + list(test_pos_b))}")

    return df_dev, df_test, dev_cases, test_cases


def get_models(pos_weight: float, random_state: int = 42) -> Dict[str, Any]:
    """Returns initialized classifier instances."""
    models = {
        "LogisticRegression": LogisticRegression(
            penalty="l2",
            C=0.1,
            class_weight="balanced",
            solver="liblinear",
            max_iter=1000,
            random_state=random_state
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=200,
            max_depth=5,
            min_samples_leaf=10,
            class_weight="balanced_subsample",
            random_state=random_state,
            n_jobs=-1
        ),
        "XGBoost": xgb.XGBClassifier(
            n_estimators=150,
            max_depth=4,
            learning_rate=0.03,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=pos_weight,
            eval_metric="logloss",
            random_state=random_state,
            n_jobs=-1
        )
    }
    return models


def evaluate_cross_validation(df_dev: pd.DataFrame, feature_cols: List[str], matrix_name: str, n_splits: int = 5):
    """
    Executes 5-Fold StratifiedGroupKFold on Dev Set.
    Returns out-of-fold predictions, fold metrics, and fitted models.
    """
    print(f"\n" + "-" * 80)
    print(f"RUNNING 5-FOLD STRATIFIED GROUP CV FOR {matrix_name} ({len(feature_cols)} features)")
    print("-" * 80)

    X = df_dev[feature_cols].copy()
    y = df_dev["target_label"].values
    groups = df_dev["caseid"].values

    # Determine stratified group indicator (has positive label)
    case_has_pos = df_dev.groupby("caseid")["target_label"].transform(lambda x: int((x == 1).sum() > 0)).values

    sgkf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=42)

    neg_pos_ratio = (y == 0).sum() / max((y == 1).sum(), 1)
    base_models = get_models(pos_weight=neg_pos_ratio)

    results = {m_name: {
        "fold_pr_auc": [],
        "fold_roc_auc": [],
        "fold_brier": [],
        "oof_preds": np.zeros(len(df_dev)),
        "models": []
    } for m_name in base_models.keys()}

    for fold, (train_idx, val_idx) in enumerate(sgkf.split(X, case_has_pos, groups=groups), 1):
        train_cases = set(groups[train_idx])
        val_cases = set(groups[val_idx])
        assert len(train_cases.intersection(val_cases)) == 0, f"Leakage in fold {fold}!"

        X_train_raw, y_train = X.iloc[train_idx], y[train_idx]
        X_val_raw, y_val = X.iloc[val_idx], y[val_idx]

        val_pos = int((y_val == 1).sum())
        val_neg = int((y_val == 0).sum())
        val_pos_cids = sorted(list(df_dev.iloc[val_idx][df_dev.iloc[val_idx]["target_label"] == 1]["caseid"].unique()))

        # Preprocessing: Impute NaNs with median computed strictly on train fold
        imputer = SimpleImputer(strategy="median")
        X_train_imp = imputer.fit_transform(X_train_raw)
        X_val_imp = imputer.transform(X_val_raw)

        # Standard scaler for Logistic Regression
        scaler = StandardScaler()
        X_train_sc = scaler.fit_transform(X_train_imp)
        X_val_sc = scaler.transform(X_val_imp)

        fold_pos_ratio = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
        models_fold = get_models(pos_weight=fold_pos_ratio, random_state=42 + fold)

        for m_name, model in models_fold.items():
            if m_name == "LogisticRegression":
                model.fit(X_train_sc, y_train)
                p_val = model.predict_proba(X_val_sc)[:, 1]
            else:
                model.fit(X_train_imp, y_train)
                p_val = model.predict_proba(X_val_imp)[:, 1]

            results[m_name]["oof_preds"][val_idx] = p_val
            results[m_name]["models"].append((model, imputer, scaler if m_name == "LogisticRegression" else None))

            pr_auc = average_precision_score(y_val, p_val) if val_pos > 0 else np.nan
            roc = roc_auc_score(y_val, p_val) if val_pos > 0 else np.nan
            brier = brier_score_loss(y_val, p_val)

            results[m_name]["fold_pr_auc"].append(pr_auc)
            results[m_name]["fold_roc_auc"].append(roc)
            results[m_name]["fold_brier"].append(brier)

        print(f"  Fold {fold}: Val Cases={len(val_cases)} (Pos Cases={val_pos_cids}), Pos Windows={val_pos}, Neg Windows={val_neg} | "
              f"XGB PR-AUC: {results['XGBoost']['fold_pr_auc'][-1]:.4f} | RF PR-AUC: {results['RandomForest']['fold_pr_auc'][-1]:.4f} | LR PR-AUC: {results['LogisticRegression']['fold_pr_auc'][-1]:.4f}")

    # Summary across folds
    print(f"\n{matrix_name} 5-Fold Cross-Validation Summary:")
    summary_list = []
    for m_name in base_models.keys():
        oof_p = results[m_name]["oof_preds"]
        oof_pr_auc = average_precision_score(y, oof_p)
        oof_roc_auc = roc_auc_score(y, oof_p)
        oof_brier = brier_score_loss(y, oof_p)

        mean_pr = np.nanmean(results[m_name]["fold_pr_auc"])
        std_pr = np.nanstd(results[m_name]["fold_pr_auc"])
        mean_roc = np.nanmean(results[m_name]["fold_roc_auc"])
        std_roc = np.nanstd(results[m_name]["fold_roc_auc"])

        print(f"  * {m_name:18s} | Pooled OOF PR-AUC: {oof_pr_auc:.4f} | Fold PR-AUC: {mean_pr:.4f} +/- {std_pr:.4f} | Pooled ROC-AUC: {oof_roc_auc:.4f} | Brier: {oof_brier:.4f}")
        summary_list.append({
            "matrix": matrix_name,
            "model": m_name,
            "pooled_oof_pr_auc": oof_pr_auc,
            "mean_fold_pr_auc": mean_pr,
            "std_fold_pr_auc": std_pr,
            "pooled_oof_roc_auc": oof_roc_auc,
            "mean_fold_roc_auc": mean_roc,
            "std_fold_roc_auc": std_roc,
            "pooled_oof_brier": oof_brier
        })

    return results, pd.DataFrame(summary_list)


def calibrate_thresholds(y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, Any]:
    """Finds optimal decision thresholds on out-of-fold predictions."""
    prec, rec, thresholds = precision_recall_curve(y_true, y_prob)

    f1_scores = 2 * (prec * rec) / np.maximum(prec + rec, 1e-8)
    best_f1_idx = np.argmax(f1_scores)
    thresh_best_f1 = thresholds[min(best_f1_idx, len(thresholds)-1)] if len(thresholds) > 0 else 0.5
    best_f1 = f1_scores[best_f1_idx]

    # Target 80% recall
    valid_rec_indices = np.where(rec >= 0.80)[0]
    if len(valid_rec_indices) > 0:
        idx_sens80 = valid_rec_indices[np.argmax(prec[valid_rec_indices])]
        thresh_sens80 = thresholds[min(idx_sens80, len(thresholds)-1)]
    else:
        thresh_sens80 = thresh_best_f1

    return {
        "thresh_max_f1": float(thresh_best_f1),
        "max_f1": float(best_f1),
        "thresh_sens80": float(thresh_sens80),
        "precision_at_max_f1": float(prec[best_f1_idx]),
        "recall_at_max_f1": float(rec[best_f1_idx])
    }


def train_and_evaluate_test_set(df_dev: pd.DataFrame, df_test: pd.DataFrame, feature_cols: List[str], matrix_name: str, cv_results: Dict[str, Any]):
    """
    Retrains models on the full 80-case Dev set and evaluates on the 20-case Locked Test Set.
    """
    print(f"\n" + "=" * 80)
    print(f"LOCKED TEST SET BENCHMARK EVALUATION ({matrix_name})")
    print("=" * 80)

    X_dev = df_dev[feature_cols].copy()
    y_dev = df_dev["target_label"].values

    X_test = df_test[feature_cols].copy()
    y_test = df_test["target_label"].values

    # Imputer & Scaler fit strictly on Dev set
    imputer = SimpleImputer(strategy="median")
    X_dev_imp = imputer.fit_transform(X_dev)
    X_test_imp = imputer.transform(X_test)

    scaler = StandardScaler()
    X_dev_sc = scaler.fit_transform(X_dev_imp)
    X_test_sc = scaler.transform(X_test_imp)

    pos_ratio_dev = (y_dev == 0).sum() / max((y_dev == 1).sum(), 1)
    models = get_models(pos_weight=pos_ratio_dev, random_state=42)

    test_metrics = []
    test_predictions = {}

    for m_name, model in models.items():
        if m_name == "LogisticRegression":
            model.fit(X_dev_sc, y_dev)
            p_test = model.predict_proba(X_test_sc)[:, 1]
        else:
            model.fit(X_dev_imp, y_dev)
            p_test = model.predict_proba(X_test_imp)[:, 1]

        test_predictions[m_name] = p_test

        pr_auc = average_precision_score(y_test, p_test)
        roc = roc_auc_score(y_test, p_test)
        brier = brier_score_loss(y_test, p_test)

        # Use thresholds calibrated on Dev out-of-fold predictions
        oof_probs = cv_results[m_name]["oof_preds"]
        thresh_info = calibrate_thresholds(y_dev, oof_probs)
        thresh = thresh_info["thresh_max_f1"]

        y_pred = (p_test >= thresh).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()
        sens = tp / max(tp + fn, 1)
        spec = tn / max(tn + fp, 1)
        prec = tp / max(tp + fp, 1)
        f1 = f1_score(y_test, y_pred, zero_division=0)

        # Patient-level alerting analysis
        df_test_eval = df_test.copy()
        df_test_eval["pred_prob"] = p_test
        df_test_eval["alert"] = y_pred

        pos_cids = df_test[df_test["target_label"] == 1]["caseid"].unique()
        pos_detected = 0
        for cid in pos_cids:
            sub = df_test_eval[(df_test_eval["caseid"] == cid) & (df_test_eval["target_label"] == 1)]
            if sub["alert"].sum() > 0:
                pos_detected += 1
        case_sensitivity = pos_detected / len(pos_cids)

        # False alarm rate per surgical hour in negative cases
        neg_cids = df_test[df_test["target_label"] == 0]["caseid"].unique()
        df_neg = df_test_eval[df_test_eval["caseid"].isin(neg_cids)]
        total_neg_hours = len(df_neg) * (60.0 / 3600.0)  # 60s stride per window
        total_false_alarms = df_neg["alert"].sum()
        far_per_hour = total_false_alarms / max(total_neg_hours, 1e-4)

        print(f"  Model: {m_name:18s} | Test PR-AUC: {pr_auc:.4f} | Test ROC-AUC: {roc:.4f} | Brier: {brier:.4f}")
        print(f"       Window: Sens={sens*100:.1f}%, Spec={spec*100:.1f}%, Prec={prec*100:.1f}%, F1={f1:.4f} (Thresh={thresh:.4f})")
        print(f"       Patient: Sensitivity={pos_detected}/{len(pos_cids)} ({case_sensitivity*100:.0f}%), False Alarms/Hour={far_per_hour:.2f}")

        test_metrics.append({
            "matrix": matrix_name,
            "model": m_name,
            "test_pr_auc": pr_auc,
            "test_roc_auc": roc,
            "test_brier": brier,
            "calibrated_threshold": thresh,
            "test_window_sensitivity": sens,
            "test_window_specificity": spec,
            "test_window_precision": prec,
            "test_window_f1": f1,
            "test_patient_sensitivity": case_sensitivity,
            "false_alarms_per_hour": far_per_hour
        })

    return pd.DataFrame(test_metrics), test_predictions, models, imputer, scaler


def run_shap_analysis(model_xgb_a, model_xgb_b, df_dev: pd.DataFrame, imputer_a, imputer_b):
    """Calculates and plots SHAP feature attributions for Matrix A and Matrix B."""
    print("\n" + "-" * 80)
    print("CALCULATING SHAP FEATURE IMPORTANCE & EXPLAINABILITY")
    print("-" * 80)

    X_a = df_dev[FEATURES_MATRIX_A].copy()
    X_a_imp = pd.DataFrame(imputer_a.transform(X_a), columns=FEATURES_MATRIX_A)

    X_b = df_dev[FEATURES_MATRIX_B].copy()
    X_b_imp = pd.DataFrame(imputer_b.transform(X_b), columns=FEATURES_MATRIX_B)

    explainer_a = shap.TreeExplainer(model_xgb_a)
    shap_vals_a = explainer_a.shap_values(X_a_imp)

    explainer_b = shap.TreeExplainer(model_xgb_b)
    shap_vals_b = explainer_b.shap_values(X_b_imp)

    # Plot Matrix A SHAP summary
    plt.figure(figsize=(10, 8), dpi=300)
    shap.summary_plot(shap_vals_a, X_a_imp, plot_type="bar", show=False, max_display=15)
    plt.title("Model Matrix A (Multimodal + Pre-event ST) - Top SHAP Feature Importance", fontsize=12, pad=15)
    plt.tight_layout()
    p_a = FIG_DIR / "shap_importance_matrix_a.png"
    plt.savefig(p_a, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"Saved: {p_a}")

    # Plot Matrix B SHAP summary
    plt.figure(figsize=(10, 8), dpi=300)
    shap.summary_plot(shap_vals_b, X_b_imp, plot_type="bar", show=False, max_display=15)
    plt.title("Model Matrix B (Pure Non-ST Autonomic / Vascular) - Top SHAP Feature Importance", fontsize=12, pad=15)
    plt.tight_layout()
    p_b = FIG_DIR / "shap_importance_matrix_b.png"
    plt.savefig(p_b, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"Saved: {p_b}")

    # Mean absolute SHAP values table
    mean_abs_a = pd.Series(np.abs(shap_vals_a).mean(axis=0), index=FEATURES_MATRIX_A).sort_values(ascending=False)
    mean_abs_b = pd.Series(np.abs(shap_vals_b).mean(axis=0), index=FEATURES_MATRIX_B).sort_values(ascending=False)

    return mean_abs_a, mean_abs_b


def generate_benchmark_figures(df_dev: pd.DataFrame, df_test: pd.DataFrame,
                               cv_a: Dict, cv_b: Dict,
                               test_preds_a: Dict, test_preds_b: Dict):
    """Generates PR curves, ROC curves, and calibration comparisons."""
    print("\n" + "-" * 80)
    print("GENERATING BENCHMARK VISUALIZATIONS & PERFORMANCE CURVES")
    print("-" * 80)

    y_dev = df_dev["target_label"].values
    y_test = df_test["target_label"].values

    colors = {"LogisticRegression": "#1f77b4", "RandomForest": "#2ca02c", "XGBoost": "#d62728"}

    # 1. PR Curves Comparison (Dev Out-of-Fold)
    fig, axes = plt.subplots(1, 2, figsize=(16, 6), dpi=300, sharey=True)

    # Matrix A Dev PR
    for m_name in colors.keys():
        p_oof = cv_a[m_name]["oof_preds"]
        prec, rec, _ = precision_recall_curve(y_dev, p_oof)
        pr_auc = average_precision_score(y_dev, p_oof)
        axes[0].plot(rec, prec, label=f"{m_name} (PR-AUC = {pr_auc:.3f})", color=colors[m_name], lw=2)

    prevalence_dev = (y_dev == 1).sum() / len(y_dev)
    axes[0].axhline(prevalence_dev, color="gray", linestyle="--", label=f"Chance Baseline ({prevalence_dev*100:.2f}%)")
    axes[0].set_title("Matrix A (Full Multimodal + Pre-event ST)\nDev 5-Fold OOF Precision-Recall", fontsize=13)
    axes[0].set_xlabel("Recall (Sensitivity)", fontsize=11)
    axes[0].set_ylabel("Precision (Positive Predictive Value)", fontsize=11)
    axes[0].legend(loc="upper right", frameon=True)
    axes[0].grid(True, alpha=0.3)

    # Matrix B Dev PR
    for m_name in colors.keys():
        p_oof = cv_b[m_name]["oof_preds"]
        prec, rec, _ = precision_recall_curve(y_dev, p_oof)
        pr_auc = average_precision_score(y_dev, p_oof)
        axes[1].plot(rec, prec, label=f"{m_name} (PR-AUC = {pr_auc:.3f})", color=colors[m_name], lw=2)

    axes[1].axhline(prevalence_dev, color="gray", linestyle="--", label=f"Chance Baseline ({prevalence_dev*100:.2f}%)")
    axes[1].set_title("Matrix B (Pure Non-ST Vascular / Autonomic)\nDev 5-Fold OOF Precision-Recall", fontsize=13)
    axes[1].set_xlabel("Recall (Sensitivity)", fontsize=11)
    axes[1].legend(loc="upper right", frameon=True)
    axes[1].grid(True, alpha=0.3)

    p_pr_dev = FIG_DIR / "pr_curves_dev_matrix_a_vs_b.png"
    plt.tight_layout()
    plt.savefig(p_pr_dev, dpi=300)
    plt.close()
    print(f"Saved: {p_pr_dev}")

    # 2. Test Set PR Curves Comparison
    fig, axes = plt.subplots(1, 2, figsize=(16, 6), dpi=300, sharey=True)

    # Matrix A Test PR
    for m_name in colors.keys():
        p_te = test_preds_a[m_name]
        prec, rec, _ = precision_recall_curve(y_test, p_te)
        pr_auc = average_precision_score(y_test, p_te)
        axes[0].plot(rec, prec, label=f"{m_name} (PR-AUC = {pr_auc:.3f})", color=colors[m_name], lw=2)

    prevalence_test = (y_test == 1).sum() / len(y_test)
    axes[0].axhline(prevalence_test, color="gray", linestyle="--", label=f"Chance Baseline ({prevalence_test*100:.2f}%)")
    axes[0].set_title("Matrix A (Full Multimodal + Pre-event ST)\nLocked Test Set Precision-Recall", fontsize=13)
    axes[0].set_xlabel("Recall (Sensitivity)", fontsize=11)
    axes[0].set_ylabel("Precision (Positive Predictive Value)", fontsize=11)
    axes[0].legend(loc="upper right", frameon=True)
    axes[0].grid(True, alpha=0.3)

    # Matrix B Test PR
    for m_name in colors.keys():
        p_te = test_preds_b[m_name]
        prec, rec, _ = precision_recall_curve(y_test, p_te)
        pr_auc = average_precision_score(y_test, p_te)
        axes[1].plot(rec, prec, label=f"{m_name} (PR-AUC = {pr_auc:.3f})", color=colors[m_name], lw=2)

    axes[1].axhline(prevalence_test, color="gray", linestyle="--", label=f"Chance Baseline ({prevalence_test*100:.2f}%)")
    axes[1].set_title("Matrix B (Pure Non-ST Vascular / Autonomic)\nLocked Test Set Precision-Recall", fontsize=13)
    axes[1].set_xlabel("Recall (Sensitivity)", fontsize=11)
    axes[1].legend(loc="upper right", frameon=True)
    axes[1].grid(True, alpha=0.3)

    p_pr_test = FIG_DIR / "pr_curves_test_matrix_a_vs_b.png"
    plt.tight_layout()
    plt.savefig(p_pr_test, dpi=300)
    plt.close()
    print(f"Saved: {p_pr_test}")

    # 3. ROC Curves (Dev OOF)
    fig, axes = plt.subplots(1, 2, figsize=(16, 6), dpi=300)

    for m_name in colors.keys():
        fpr, tpr, _ = roc_curve(y_dev, cv_a[m_name]["oof_preds"])
        roc_val = roc_auc_score(y_dev, cv_a[m_name]["oof_preds"])
        axes[0].plot(fpr, tpr, label=f"{m_name} (AUROC = {roc_val:.3f})", color=colors[m_name], lw=2)
    axes[0].plot([0, 1], [0, 1], "k--", label="Chance (0.50)")
    axes[0].set_title("Matrix A (Full Multimodal) - ROC Curves (Dev OOF)", fontsize=13)
    axes[0].set_xlabel("False Positive Rate", fontsize=11)
    axes[0].set_ylabel("True Positive Rate", fontsize=11)
    axes[0].legend(loc="lower right", frameon=True)
    axes[0].grid(True, alpha=0.3)

    for m_name in colors.keys():
        fpr, tpr, _ = roc_curve(y_dev, cv_b[m_name]["oof_preds"])
        roc_val = roc_auc_score(y_dev, cv_b[m_name]["oof_preds"])
        axes[1].plot(fpr, tpr, label=f"{m_name} (AUROC = {roc_val:.3f})", color=colors[m_name], lw=2)
    axes[1].plot([0, 1], [0, 1], "k--", label="Chance (0.50)")
    axes[1].set_title("Matrix B (Pure Non-ST) - ROC Curves (Dev OOF)", fontsize=13)
    axes[1].set_xlabel("False Positive Rate", fontsize=11)
    axes[1].set_ylabel("True Positive Rate", fontsize=11)
    axes[1].legend(loc="lower right", frameon=True)
    axes[1].grid(True, alpha=0.3)

    p_roc = FIG_DIR / "roc_curves_dev_matrix_a_vs_b.png"
    plt.tight_layout()
    plt.savefig(p_roc, dpi=300)
    plt.close()
    print(f"Saved: {p_roc}")


def main():
    print("=" * 80)
    print("STARTING BEATAHEAD PHASE 5 MACHINE LEARNING MODELING BENCHMARK")
    print("=" * 80)

    # 1. Load Dataset
    df = load_dataset()

    # 2. Subject-Level Split
    df_dev, df_test, dev_cases, test_cases = create_subject_level_partitions(df, seed=42)

    # 3. Cross-Validation on Dev Set (Matrix A)
    cv_res_a, summary_cv_a = evaluate_cross_validation(df_dev, FEATURES_MATRIX_A, "Matrix_A_Multimodal_ST")

    # 4. Cross-Validation on Dev Set (Matrix B)
    cv_res_b, summary_cv_b = evaluate_cross_validation(df_dev, FEATURES_MATRIX_B, "Matrix_B_Pure_Non_ST")

    # 5. Locked Test Set Benchmark (Matrix A)
    test_res_a, test_preds_a, models_a, imp_a, sc_a = train_and_evaluate_test_set(
        df_dev, df_test, FEATURES_MATRIX_A, "Matrix_A_Multimodal_ST", cv_res_a
    )

    # 6. Locked Test Set Benchmark (Matrix B)
    test_res_b, test_preds_b, models_b, imp_b, sc_b = train_and_evaluate_test_set(
        df_dev, df_test, FEATURES_MATRIX_B, "Matrix_B_Pure_Non_ST", cv_res_b
    )

    # Combine benchmark results
    summary_cv = pd.concat([summary_cv_a, summary_cv_b], ignore_index=True)
    summary_test = pd.concat([test_res_a, test_res_b], ignore_index=True)
    merged_results = pd.merge(summary_cv, summary_test, on=["matrix", "model"])

    results_csv = REPORTS_DIR / "phase5_model_benchmark_results.csv"
    merged_results.to_csv(results_csv, index=False)
    print(f"\nSaved benchmark results to {results_csv}")

    # 7. SHAP Analysis on XGBoost models
    mean_shap_a, mean_shap_b = run_shap_analysis(
        models_a["XGBoost"], models_b["XGBoost"], df_dev, imp_a, imp_b
    )

    # 8. Generate Visualizations
    generate_benchmark_figures(df_dev, df_test, cv_res_a, cv_res_b, test_preds_a, test_preds_b)

    print("\n" + "=" * 80)
    print("PHASE 5 MACHINE LEARNING MODELING BENCHMARK COMPLETED SUCCESSFULLY")
    print("=" * 80)


if __name__ == "__main__":
    main()
