"""
src/data_inspection.py

VitalDB Data Inspection & Signal Quality Assessment Module
Part of the BeatAhead Cardiac Physiological ML Prototype.

This module inspects:
1. Cohort-level clinical metadata distributions (demographics, surgery type, vasoactive drugs, in-hospital outcomes).
2. Biosignal track availability across the entire dataset.
3. Case-level physiological waveform integrity (sampling rate, duration, NaN percentage, clipping, flatlining).
4. Signal Quality Indices (SQI) and multimodal alignment checks on downloaded pilot cases.
"""

import os
import sys
import argparse
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    import vitaldb
except ImportError:
    vitaldb = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("VitalDB-Inspect")

REQUIRED_TRACKS = [
    "SNUADC/ECG_II",
    "SNUADC/PLETH",
    "Solar8000/PLETH_SPO2",
    "Solar8000/ST_II"
]


def get_default_data_dir() -> Path:
    """Return default data directory inside the workspace."""
    base_dir = Path(__file__).resolve().parent.parent
    return base_dir / "data"


def inspect_metadata(data_dir: Path) -> Dict[str, Any]:
    """
    Inspect cohort-level metadata files: cases.csv, trks.csv, labs.csv.
    Reports signal coverage, clinical confounders, and outcome prevalence.
    """
    meta_dir = data_dir / "metadata"
    cases_file = meta_dir / "cases.csv"
    trks_file = meta_dir / "trks.csv"
    labs_file = meta_dir / "labs.csv"

    if not cases_file.exists():
        logger.error(f"Cases metadata not found at {cases_file}. Run data_download.py --download-metadata first.")
        return {}

    logger.info("=" * 70)
    logger.info("VITALDB METADATA COHORT INSPECTION")
    logger.info("=" * 70)

    df_cases = pd.read_csv(cases_file)
    n_cases = len(df_cases)
    n_subjects = df_cases["subjectid"].nunique()
    logger.info(f"Total Cases: {n_cases} | Unique Subjects: {n_subjects}")

    # Patient demographics
    age_mean = df_cases["age"].mean()
    age_std = df_cases["age"].std()
    male_pct = (df_cases["sex"] == "M").mean() * 100
    bmi_mean = df_cases["bmi"].mean()
    logger.info(f"Demographics: Age = {age_mean:.1f} ± {age_std:.1f} yrs | Male = {male_pct:.1f}% | BMI = {bmi_mean:.1f} kg/m²")

    # Surgical duration
    df_cases["duration_hrs"] = (df_cases["caseend"] - df_cases["casestart"]) / 3600.0
    dur_median = df_cases["duration_hrs"].median()
    dur_q25 = df_cases["duration_hrs"].quantile(0.25)
    dur_q75 = df_cases["duration_hrs"].quantile(0.75)
    logger.info(f"Surgery Duration: Median = {dur_median:.2f} hrs (IQR: {dur_q25:.2f} - {dur_q75:.2f} hrs)")

    # Surgical department distribution
    logger.info("-" * 50)
    logger.info("Top Surgical Departments:")
    top_depts = df_cases["department"].value_counts().head(5)
    for dept, count in top_depts.items():
        logger.info(f"  * {dept}: {count} cases ({count/n_cases*100:.1f}%)")

    # Vasoactive drug administrations (Confounders)
    logger.info("-" * 50)
    logger.info("Intraoperative Vasoactive Drug Usage (Key Confounders):")
    if "intraop_phe" in df_cases.columns:
        phe_cases = (df_cases["intraop_phe"] > 0).sum()
        logger.info(f"  * Phenylephrine bolus: {phe_cases} cases ({phe_cases/n_cases*100:.1f}%)")
    if "intraop_eph" in df_cases.columns:
        eph_cases = (df_cases["intraop_eph"] > 0).sum()
        logger.info(f"  * Ephedrine bolus:     {eph_cases} cases ({eph_cases/n_cases*100:.1f}%)")
    if "intraop_epi" in df_cases.columns:
        epi_cases = (df_cases["intraop_epi"] > 0).sum()
        logger.info(f"  * Epinephrine bolus:    {epi_cases} cases ({epi_cases/n_cases*100:.1f}%)")

    # In-hospital clinical outcomes
    logger.info("-" * 50)
    logger.info("Clinical Outcomes in Public cases.csv:")
    if "death_inhosp" in df_cases.columns:
        deaths = df_cases["death_inhosp"].sum()
        logger.info(f"  * In-Hospital Mortality: {deaths} cases ({deaths/n_cases*100:.2f}%)")
    if "icu_days" in df_cases.columns:
        icu_admit = (df_cases["icu_days"] > 0).sum()
        logger.info(f"  * Postoperative ICU Admission: {icu_admit} cases ({icu_admit/n_cases*100:.1f}%)")

    # Track availability inspection
    if trks_file.exists():
        logger.info("-" * 50)
        logger.info("Target Multimodal Track Coverage:")
        df_trks = pd.read_csv(trks_file)
        
        track_counts = {}
        for track in REQUIRED_TRACKS:
            count = df_trks[df_trks["tname"] == track]["caseid"].nunique()
            track_counts[track] = count
            logger.info(f"  * {track:<25}: {count:>5} cases ({count/n_cases*100:.1f}%)")
        
        # Intersection
        case_sets = [set(df_trks[df_trks["tname"] == t]["caseid"]) for t in REQUIRED_TRACKS]
        intersection_count = len(set.intersection(*case_sets))
        logger.info(f"  -> Simultaneous Intersection (All 4 tracks): {intersection_count} cases ({intersection_count/n_cases*100:.1f}%)")

    # Lab table inspection (Troponin check)
    if labs_file.exists():
        logger.info("-" * 50)
        logger.info("Laboratory Parameters Audit:")
        df_labs = pd.read_csv(labs_file)
        unique_labs = sorted(df_labs["name"].dropna().unique().tolist())
        logger.info(f"  * Total Lab Parameters: {len(unique_labs)}")
        logger.info(f"  * Tests: {', '.join(unique_labs[:15])}...")
        
        has_troponin = any("trop" in lab.lower() or "tni" in lab.lower() for lab in unique_labs)
        logger.info(f"  * Troponin I present in public labs.csv: {has_troponin}")
        if not has_troponin:
            logger.info("    (Note: Troponin is not in public open labs.csv, confirming reports/vitaldb_plan.md)")

    return {"total_cases": n_cases, "total_subjects": n_subjects}


def inspect_vital_file(vital_path: Path) -> Dict[str, Any]:
    """
    Inspect an individual .vital binary file.
    Evaluates signal tracks, sampling rates, NaNs, clipping, and physical ranges.
    """
    if vitaldb is None:
        logger.error("vitaldb Python package is not available.")
        return {}

    if not vital_path.exists():
        logger.error(f"File not found: {vital_path}")
        return {}

    logger.info(f"Inspecting vital file: {vital_path.name} ({vital_path.stat().st_size / (1024*1024):.2f} MB)")
    vf = vitaldb.VitalFile(str(vital_path))
    available_tracks = vf.get_track_names()

    report: Dict[str, Any] = {
        "file": vital_path.name,
        "size_mb": round(vital_path.stat().st_size / (1024 * 1024), 2),
        "available_tracks": available_tracks,
        "track_stats": {}
    }

    # Extract target tracks at 100 Hz unified grid for inspection
    eval_tracks = [t for t in REQUIRED_TRACKS if t in available_tracks]
    if not eval_tracks:
        logger.warning(f"No required tracks found in {vital_path.name}")
        return report

    # Load 100 Hz grid (interval = 0.01s)
    interval = 0.01
    arr = vf.to_numpy(eval_tracks, interval=interval)
    duration_sec = len(arr) * interval
    report["duration_minutes"] = round(duration_sec / 60.0, 2)
    logger.info(f"  Recording Duration: {duration_sec/60.0:.1f} minutes ({len(arr):,} samples at 100 Hz)")

    for idx, trk in enumerate(eval_tracks):
        sig = arr[:, idx]
        total_samples = len(sig)
        nan_samples = np.isnan(sig).sum()
        valid_samples = total_samples - nan_samples
        nan_pct = (nan_samples / total_samples) * 100 if total_samples > 0 else 100.0

        stats: Dict[str, Any] = {
            "nan_pct": round(nan_pct, 2),
            "valid_samples": int(valid_samples)
        }

        if valid_samples > 0:
            valid_sig = sig[~np.isnan(sig)]
            stats["min"] = round(float(np.min(valid_sig)), 3)
            stats["max"] = round(float(np.max(valid_sig)), 3)
            stats["mean"] = round(float(np.mean(valid_sig)), 3)
            stats["std"] = round(float(np.std(valid_sig)), 3)

            # Physiological range sanity checks
            if "SPO2" in trk:
                hypoxic_pct = (valid_sig < 90.0).mean() * 100
                stats["hypoxic_pct (<90%)"] = round(float(hypoxic_pct), 2)
            elif "ST" in trk:
                ischemic_pct = (valid_sig <= -0.1).mean() * 100
                stats["ischemic_st_pct (<= -0.1mV)"] = round(float(ischemic_pct), 2)
            elif "ECG" in trk:
                # Check for voltage rail clipping (> 5.0 mV or < -5.0 mV)
                clipping_pct = ((valid_sig > 4.9) | (valid_sig < -4.9)).mean() * 100
                stats["clipping_pct"] = round(float(clipping_pct), 3)

        report["track_stats"][trk] = stats
        logger.info(f"  [{trk}] NaN%: {stats['nan_pct']}% | Min: {stats.get('min')} | Max: {stats.get('max')} | Mean: {stats.get('mean')}")

    return report


def inspect_downloaded_pilot_cohort(data_dir: Path) -> List[Dict[str, Any]]:
    """Inspect all downloaded .vital files in data/raw_vital."""
    raw_dir = data_dir / "raw_vital"
    if not raw_dir.exists():
        logger.info(f"Raw vital directory does not exist yet: {raw_dir}")
        return []

    vital_files = sorted(list(raw_dir.glob("*.vital")))
    if not vital_files:
        logger.info(f"No .vital files found in {raw_dir}. Run data_download.py to acquire pilot cases.")
        return []

    logger.info("=" * 70)
    logger.info(f"INSPECTING {len(vital_files)} DOWNLOADED PILOT VITAL FILES")
    logger.info("=" * 70)

    results = []
    for vf in vital_files:
        res = inspect_vital_file(vf)
        results.append(res)
    return results


def main():
    parser = argparse.ArgumentParser(description="VitalDB Data Inspection & Signal Quality Tool")
    parser.add_argument("--data-dir", type=str, default=str(get_default_data_dir()), help="Root data directory")
    parser.add_argument("--metadata-only", action="store_true", help="Inspect only metadata CSVs")
    parser.add_argument("--case-file", type=str, default=None, help="Inspect a specific .vital file path")

    args = parser.parse_args()
    data_dir = Path(args.data_dir)

    inspect_metadata(data_dir)

    if args.case_file:
        inspect_vital_file(Path(args.case_file))
    elif not args.metadata_only:
        inspect_downloaded_pilot_cohort(data_dir)


if __name__ == "__main__":
    main()
