"""
scratch/build_deployment_artifacts.py

Serializes the frozen Phase 5 deployment model artifact, creates feature_schema.json,
generates model_metadata.json, and writes MODEL_MANIFEST.json with SHA-256 hashes.
"""

import os
import sys
import json
import time
import hashlib
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.impute import SimpleImputer
import xgboost as xgb

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.train_and_evaluate_models import (
    FEATURES_MATRIX_A,
    create_subject_level_partitions,
    get_models
)

MODELS_DIR = BASE_DIR / "models"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# 1. Load data and extract exact 80-case Dev partition
df = pd.read_pickle(PROCESSED_DIR / "vitaldb_100_windows.pkl.gz", compression="gzip")
df_clean = df[(df["sqi_status"] == "PASS") & (df["target_label"].isin([0, 1]))].copy()
df_dev, df_test, dev_cases, test_cases = create_subject_level_partitions(df_clean, seed=42)

X_dev = df_dev[FEATURES_MATRIX_A].copy()
y_dev = df_dev["target_label"].values

imputer = SimpleImputer(strategy="median")
X_dev_imp = imputer.fit_transform(X_dev)

pos_ratio = (y_dev == 0).sum() / max((y_dev == 1).sum(), 1)
model = get_models(pos_ratio, random_state=42)["XGBoost"]
model.fit(X_dev_imp, y_dev)

# Frozen threshold from Phase 5 benchmark
FROZEN_DECISION_THRESHOLD = 0.15674158930778503

# 2. Package model artifact
artifact = {
    "model_name": "beatahead_phase5_model",
    "version": "1.0.0",
    "algorithm": "XGBClassifier",
    "feature_matrix": "Matrix_A_Multimodal_ST",
    "feature_names": FEATURES_MATRIX_A,
    "feature_count": len(FEATURES_MATRIX_A),
    "imputer": imputer,
    "model": model,
    "frozen_decision_threshold": FROZEN_DECISION_THRESHOLD,
    "training_cases": sorted(dev_cases),
    "training_case_count": len(dev_cases),
    "training_windows_count": len(df_dev),
    "positive_training_windows": int((y_dev == 1).sum()),
    "training_date": "2026-09-22",
    "python_version": sys.version.split()[0],
    "xgboost_version": xgb.__version__,
    "target_definition": "max_consecutive_duration(ST_II <= -1.0 mm) >= 60s in T_target with 5-min lead time"
}

model_path = MODELS_DIR / "beatahead_phase5_model.joblib"
joblib.dump(artifact, model_path, compress=3)
print(f"Saved model artifact: {model_path} ({model_path.stat().st_size / 1024:.1f} KB)")

# 3. Create feature_schema.json
feature_descriptions = {
    "ecg_hr_mean": {"type": "float", "modality": "ECG", "unit": "bpm", "bounds": [20.0, 300.0], "description": "Mean heart rate over 5-min observation window"},
    "ecg_hr_std": {"type": "float", "modality": "ECG", "unit": "bpm", "bounds": [0.0, 150.0], "description": "Standard deviation of heart rate (autonomic tone)"},
    "ecg_rr_sdnn": {"type": "float", "modality": "ECG", "unit": "ms", "bounds": [0.0, 1000.0], "description": "SDNN: Standard deviation of normal-to-normal RR intervals"},
    "ecg_rr_rmssd": {"type": "float", "modality": "ECG", "unit": "ms", "bounds": [0.0, 1000.0], "description": "RMSSD: Root mean square of successive RR interval differences"},
    "ecg_pnn50": {"type": "float", "modality": "ECG", "unit": "%", "bounds": [0.0, 100.0], "description": "Percentage of adjacent RR intervals differing by > 50 ms"},
    "ecg_r_amp_mv": {"type": "float", "modality": "ECG", "unit": "mV", "bounds": [-2.0, 15.0], "description": "Median R-wave peak amplitude above isoelectric baseline"},
    "ecg_qrs_width_ms": {"type": "float", "modality": "ECG", "unit": "ms", "bounds": [30.0, 300.0], "description": "Estimated QRS complex duration"},
    "ecg_sqi": {"type": "float", "modality": "ECG", "unit": "ratio", "bounds": [0.0, 1.0], "description": "ECG signal quality index (clean QRS fraction)"},
    "pat_median_ms": {"type": "float", "modality": "ECG+PPG", "unit": "ms", "bounds": [50.0, 600.0], "description": "Median Pulse Arrival Time (QRS peak to PPG foot delay)"},
    "pat_iqr_ms": {"type": "float", "modality": "ECG+PPG", "unit": "ms", "bounds": [0.0, 500.0], "description": "Interquartile range of PAT (vascular compliance stability)"},
    "pat_valid_fraction": {"type": "float", "modality": "ECG+PPG", "unit": "ratio", "bounds": [0.0, 1.0], "description": "Fraction of cardiac cycles with plausible PAT (100-450 ms)"},
    "pat_valid": {"type": "int", "modality": "ECG+PPG", "unit": "binary", "bounds": [0, 1], "description": "Binary flag indicating >= 30% plausible PAT beats"},
    "ppg_pulse_amp": {"type": "float", "modality": "PPG", "unit": "a.u.", "bounds": [0.0, 50000.0], "description": "Median peak-to-trough photoplethysmogram pulse amplitude"},
    "ppg_perfusion_index": {"type": "float", "modality": "PPG", "unit": "%", "bounds": [0.0, 10000.0], "description": "Photoplethysmogram Perfusion Index (AC/DC ratio)"},
    "ppg_crest_time_ms": {"type": "float", "modality": "PPG", "unit": "ms", "bounds": [20.0, 500.0], "description": "PPG pulse foot to systolic peak crest time"},
    "ppg_sqi": {"type": "float", "modality": "PPG", "unit": "ratio", "bounds": [0.0, 1.0], "description": "PPG signal quality index (clipping and saturation detection)"},
    "spo2_mean": {"type": "float", "modality": "SpO2", "unit": "%", "bounds": [40.0, 100.0], "description": "Mean pulse oximeter oxygen saturation over 5-min window"},
    "spo2_min": {"type": "float", "modality": "SpO2", "unit": "%", "bounds": [30.0, 100.0], "description": "Nadir oxygen saturation during 5-min window"},
    "spo2_std": {"type": "float", "modality": "SpO2", "unit": "%", "bounds": [0.0, 40.0], "description": "Standard deviation of pulse oximeter saturation trend"},
    "spo2_desat_count": {"type": "int", "modality": "SpO2", "unit": "seconds", "bounds": [0, 300], "description": "Total duration of desaturation (SpO2 <= 90%) in seconds"},
    "st_obs_mean": {"type": "float", "modality": "ST_II", "unit": "mm", "bounds": [-15.0, 15.0], "description": "Mean ST segment level in Lead II over observation window"},
    "st_obs_median": {"type": "float", "modality": "ST_II", "unit": "mm", "bounds": [-15.0, 15.0], "description": "Median ST segment level in Lead II over observation window"},
    "st_obs_min": {"type": "float", "modality": "ST_II", "unit": "mm", "bounds": [-15.0, 15.0], "description": "Minimum ST segment level in Lead II over observation window"},
    "st_obs_std": {"type": "float", "modality": "ST_II", "unit": "mm", "bounds": [0.0, 15.0], "description": "Standard deviation of ST segment level in Lead II"},
    "st_delta_baseline": {"type": "float", "modality": "ST_II", "unit": "mm", "bounds": [-15.0, 15.0], "description": "ST median shift relative to initial 10-minute surgical baseline"},
    "st_slope_mm_min": {"type": "float", "modality": "ST_II", "unit": "mm/min", "bounds": [-20.0, 20.0], "description": "Linear regression slope of ST deviation over observation window"}
}

schema_payload = {
    "schema_name": "BeatAhead_Matrix_A_Feature_Schema",
    "schema_version": "1.0.0",
    "feature_count": len(FEATURES_MATRIX_A),
    "feature_order": FEATURES_MATRIX_A,
    "features": {f: feature_descriptions[f] for f in FEATURES_MATRIX_A}
}

schema_path = MODELS_DIR / "feature_schema.json"
with open(schema_path, "w", encoding="utf-8") as f:
    json.dump(schema_payload, f, indent=2)
print(f"Saved feature schema: {schema_path}")

# 4. Create model_metadata.json
metadata_payload = {
    "model_name": "beatahead_phase5_model",
    "model_version": "1.0.0",
    "algorithm": "XGBClassifier (Extreme Gradient Boosting)",
    "framework": "xgboost",
    "framework_version": xgb.__version__,
    "training_date": "2026-09-22",
    "training_dataset_version": "VitalDB 100-Case Final Verified Dataset (v1.0)",
    "cohort_scope": {
        "total_cases_audited": 100,
        "cohort_a_high_risk": 50,
        "cohort_b_representative_surgical": 50,
        "development_cases": 80,
        "locked_test_cases": 20,
        "development_cases_used_in_training": sorted(dev_cases),
        "total_training_windows": len(df_dev),
        "positive_training_windows": int((y_dev == 1).sum()),
        "negative_training_windows": int((y_dev == 0).sum()),
        "training_prevalence": float((y_dev == 1).sum() / len(df_dev))
    },
    "feature_matrix": "Matrix A (Full Multimodal + Pre-Event ST)",
    "feature_count": 26,
    "feature_order": FEATURES_MATRIX_A,
    "preprocessing": {
        "imputation": "SimpleImputer(strategy='median')",
        "imputation_fitted_on": "Development Set (80 cases) exclusively"
    },
    "hyperparameters": {
        "n_estimators": 150,
        "max_depth": 4,
        "learning_rate": 0.03,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "scale_pos_weight": float(pos_ratio),
        "eval_metric": "logloss",
        "random_state": 42
    },
    "calibration_and_decision_threshold": {
        "deployment_decision_threshold": FROZEN_DECISION_THRESHOLD,
        "threshold_calibration_strategy": "Out-of-fold cross-validation F1-score maximization (argmax(F1))",
        "threshold_calibrated_on": "Development Set (80 cases) 5-fold cross-validation exclusively",
        "raw_model_probability_interpretation": "Continuous probability of impending sustained ischemia within target horizon",
        "binary_decision_rule": f"alert = 1 if model_probability >= {FROZEN_DECISION_THRESHOLD} else 0"
    },
    "intended_prediction_target": {
        "target_description": "Impending sustained myocardial ischemia (>= 60s contiguous at ST_II <= -1.0 mm)",
        "observation_window_seconds": 300,
        "prediction_gap_lead_time_seconds": 300,
        "target_horizon_seconds": 300,
        "sliding_stride_seconds": 60,
        "lead_time_guarantee": "Strict 5-minute lead time preceding the target evaluation horizon"
    },
    "benchmark_performance_metrics": {
        "development_5fold_cv": {
            "pooled_oof_pr_auc": 0.3247,
            "mean_fold_pr_auc": 0.4812,
            "std_fold_pr_auc": 0.3834,
            "pooled_oof_roc_auc": 0.8896,
            "pooled_oof_brier": 0.0045
        },
        "locked_test_set_benchmark_20_cases": {
            "test_pr_auc": 0.0043,
            "test_roc_auc": 0.4967,
            "test_brier": 0.0056,
            "window_specificity": 0.9971,
            "false_alarms_per_surgical_hour": 0.1733
        }
    },
    "software_environment": {
        "python": sys.version.split()[0],
        "xgboost": xgb.__version__,
        "scikit_learn": "1.9.1",
        "joblib": "1.6.0",
        "numpy": np.__version__,
        "pandas": pd.__version__
    },
    "limitations_and_warnings": [
        "Research Prototype: This model is a retrospective investigative prototype and is NOT clinically approved for diagnostic or patient monitoring use.",
        "Electrophysiological Dependency: Model performance heavily relies on pre-event ST micro-drifts (Matrix A). Non-ST vascular/autonomic features (Matrix B) alone fail to provide reliable prospective warning (AUROC ~0.53).",
        "Onset Phenotype Sensitivity: Insidious pre-event ST sagging is readily detected 5-10 minutes prior, but sudden-onset unheralded ischemic collapse (normal ST until abrupt plunge) cannot be detected 5 minutes in advance without generating high false alarms.",
        "Lead II Specificity: Model was trained on Lead II. Anterior or lateral ischemic events manifesting exclusively in precordial leads (e.g. V5) without inferior expression may be missed."
    ]
}

metadata_path = MODELS_DIR / "model_metadata.json"
with open(metadata_path, "w", encoding="utf-8") as f:
    json.dump(metadata_payload, f, indent=2)
print(f"Saved model metadata: {metadata_path}")

# 5. Create MODEL_MANIFEST.json with SHA-256 hashes
def compute_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

manifest = {
    "manifest_version": "1.0.0",
    "created_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    "artifacts": {
        "beatahead_phase5_model.joblib": {
            "path": "models/beatahead_phase5_model.joblib",
            "size_bytes": model_path.stat().st_size,
            "sha256": compute_sha256(model_path)
        },
        "feature_schema.json": {
            "path": "models/feature_schema.json",
            "size_bytes": schema_path.stat().st_size,
            "sha256": compute_sha256(schema_path)
        },
        "model_metadata.json": {
            "path": "models/model_metadata.json",
            "size_bytes": metadata_path.stat().st_size,
            "sha256": compute_sha256(metadata_path)
        }
    }
}

manifest_path = MODELS_DIR / "MODEL_MANIFEST.json"
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
print(f"Saved model manifest: {manifest_path}")
print("\nSerialization and artifact packaging complete.")
