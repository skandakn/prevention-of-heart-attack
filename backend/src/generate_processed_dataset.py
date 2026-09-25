"""
src/generate_processed_dataset.py

Generates and caches the complete window-level dataset across all 100 verified
VitalDB surgical cases (50 Cohort A, 50 Cohort B) with parallel processing.

Outputs:
- data/processed/vitaldb_100_windows.csv.gz
- data/processed/vitaldb_100_windows.pkl.gz
"""

import os
import sys
import time
import concurrent.futures
import numpy as np
import pandas as pd
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.process_100_cohort import process_single_case

DATA_RAW_DIR = BASE_DIR / "data" / "raw" / "vitaldb_100"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
SCRATCH_DIR = BASE_DIR / "scratch"
REPORTS_DIR = BASE_DIR / "reports"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def generate_all_windows(max_workers: int = 12):
    print("=" * 80, flush=True)
    print("BEATAHEAD 100-CASE WINDOW DATASET EXTRACTION & CACHING", flush=True)
    print("=" * 80, flush=True)

    # 1. Load verified case lists
    df_a = pd.read_csv(SCRATCH_DIR / "cohort_a_final_verified.csv")
    df_b = pd.read_csv(SCRATCH_DIR / "cohort_b_final_verified.csv")
    cases = [(int(cid), "A") for cid in df_a["caseid"].tolist()] + [(int(cid), "B") for cid in df_b["caseid"].tolist()]

    print(f"Total target cases: {len(cases)} ({len(df_a)} Cohort A, {len(df_b)} Cohort B)", flush=True)
    print(f"Parallel workers: {max_workers}", flush=True)

    t0 = time.time()
    all_windows = []
    all_audits = []
    all_episodes = []

    def _worker(case_tuple):
        cid, cohort = case_tuple
        try:
            t_start = time.time()
            audit, wins, eps = process_single_case(cid, cohort)
            dt = time.time() - t_start
            return cid, cohort, audit, wins, eps, dt, None
        except Exception as e:
            return cid, cohort, None, None, None, 0, str(e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_worker, c) for c in cases]
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            cid, cohort, audit, wins, eps, dt, err = future.result()
            if err:
                print(f"[{i:3d}/100] ERROR in Case {cid}: {err}")
                continue
            all_audits.append(audit)
            all_windows.extend(wins)
            for ep in eps:
                ep["caseid"] = cid
                ep["cohort"] = cohort
                all_episodes.append(ep)
            n_pos = sum(1 for w in wins if w.get("target_label") == 1)
            print(f"[{i:3d}/100] Case {cid:4d} (Cohort {cohort}) done in {dt:.1f}s | Windows: {len(wins):3d} | Pos (y=1): {n_pos}", flush=True)

    df_windows = pd.DataFrame(all_windows)
    df_audit = pd.DataFrame(all_audits)
    df_episodes = pd.DataFrame(all_episodes)

    # Verification checks
    total_time = time.time() - t0
    print("\n" + "=" * 80, flush=True)
    print(f"EXTRACTION FINISHED in {total_time:.1f}s ({total_time/60:.2f} min)", flush=True)
    print(f"Total extracted windows: {len(df_windows)}", flush=True)
    print(f"Total unique cases in windows: {df_windows['caseid'].nunique()}", flush=True)
    print(f"Usable windows (SQI PASS): {(df_windows['sqi_status'] == 'PASS').sum()}", flush=True)
    print(f"Valid Early Warning (y=1): {(df_windows['target_label'] == 1).sum()}", flush=True)
    print(f"Confirmed Clean Neg (y=0): {(df_windows['target_label'] == 0).sum()}", flush=True)
    print(f"Excluded windows (y=-1):   {(df_windows['target_label'] == -1).sum()}", flush=True)
    print(f"Total sustained episodes:  {len(df_episodes)}", flush=True)
    print("=" * 80, flush=True)

    # Save to disk
    csv_gz_path = PROCESSED_DIR / "vitaldb_100_windows.csv.gz"
    pkl_gz_path = PROCESSED_DIR / "vitaldb_100_windows.pkl.gz"

    print(f"Saving to {csv_gz_path}...", flush=True)
    df_windows.to_csv(csv_gz_path, index=False, compression="gzip")

    print(f"Saving to {pkl_gz_path}...", flush=True)
    df_windows.to_pickle(pkl_gz_path, compression="gzip")

    print(f"Saved successfully. CSV.GZ size: {csv_gz_path.stat().st_size / (1024*1024):.2f} MB", flush=True)
    return df_windows


if __name__ == "__main__":
    generate_all_windows(max_workers=12)
