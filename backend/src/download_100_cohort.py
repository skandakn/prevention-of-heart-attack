"""
src/download_100_cohort.py

Downloads the final verified 100-case VitalDB cohort (50 Cohort A, 50 Cohort B).
Enforces:
- Exact verified case lists from reports/pre_download_validation.md
- Zero duplicates, zero A/B overlap, zero overlap with the 20 pilot cases
- Storage safety reporting before each batch (< 5 GB limit, 25 GB project budget)
- Integrity check on each downloaded .vital file with vitaldb.VitalFile
"""

import os
import sys
import time
import shutil
import logging
import requests
import pandas as pd
from pathlib import Path
from typing import List, Dict, Tuple

try:
    import vitaldb
except ImportError:
    vitaldb = None

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("Download-100")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "raw" / "vitaldb_100"
PILOT_DIR = BASE_DIR / "data" / "raw" / "vitaldb_pilot"
SCRATCH_DIR = BASE_DIR / "scratch"

API_URL = "https://api.vitaldb.net"
DATASET_VERSION = "1.0.1"
PROJECT_BUDGET_GB = 25.0
SAFETY_CEILING_GB = 5.0

PILOT_CASES = [
    1, 13, 16, 21, 22, 26, 30, 31, 37, 38,
    41, 46, 48, 49, 51, 57, 60, 61, 65, 66
]

MANDATORY_TRACKS = [
    "SNUADC/ECG_II",
    "SNUADC/PLETH",
    "Solar8000/PLETH_SPO2",
    "Solar8000/ST_II"
]
OPTIONAL_TRACKS = [
    "SNUADC/ECG_V5",
    "Solar8000/ST_V5"
]


def load_and_verify_cohort_lists() -> Tuple[List[int], List[int]]:
    """Load final verified cohorts and verify all integrity constraints."""
    csv_a = SCRATCH_DIR / "cohort_a_final_verified.csv"
    csv_b = SCRATCH_DIR / "cohort_b_final_verified.csv"

    if not csv_a.exists() or not csv_b.exists():
        raise FileNotFoundError(f"Cohort CSVs missing in {SCRATCH_DIR}")

    df_a = pd.read_csv(csv_a)
    df_b = pd.read_csv(csv_b)

    cases_a = df_a["caseid"].tolist()
    cases_b = df_b["caseid"].tolist()

    print("=" * 80)
    print("STEP 1: VERIFYING 100-CASE COHORT SPECIFICATION")
    print("=" * 80)
    print(f"Cohort A Case IDs ({len(cases_a)} cases):")
    print(cases_a)
    print(f"\nCohort B Case IDs ({len(cases_b)} cases):")
    print(cases_b)
    print("=" * 80)

    # Verification checks
    assert len(cases_a) == 50, f"Cohort A count expected 50, got {len(cases_a)}"
    assert len(cases_b) == 50, f"Cohort B count expected 50, got {len(cases_b)}"
    assert len(set(cases_a)) == 50, f"Cohort A contains {50 - len(set(cases_a))} duplicates!"
    assert len(set(cases_b)) == 50, f"Cohort B contains {50 - len(set(cases_b))} duplicates!"

    overlap_ab = set(cases_a).intersection(set(cases_b))
    assert len(overlap_ab) == 0, f"Overlap between Cohort A and B: {overlap_ab}"

    overlap_pilot_a = set(cases_a).intersection(set(PILOT_CASES))
    assert len(overlap_pilot_a) == 0, f"Overlap between Pilot and Cohort A: {overlap_pilot_a}"

    overlap_pilot_b = set(cases_b).intersection(set(PILOT_CASES))
    assert len(overlap_pilot_b) == 0, f"Overlap between Pilot and Cohort B: {overlap_pilot_b}"

    print("VERIFICATION SUCCESS:")
    print("  [OK] Exactly 50 Cohort A cases")
    print("  [OK] Exactly 50 Cohort B cases")
    print("  [OK] Zero internal duplicates in Cohort A or B")
    print("  [OK] Zero overlap between Cohort A and Cohort B")
    print("  [OK] Zero overlap with the 20 pilot cases")
    print("=" * 80)

    return cases_a, cases_b


def get_current_storage_stats() -> Tuple[int, float, float]:
    """Calculate downloaded file count, cumulative size in MB/GB, and remaining budget."""
    files = list(DATA_DIR.glob("*.vital"))
    n_files = len(files)
    total_bytes = sum(f.stat().st_size for f in files)
    total_gb = total_bytes / (1024 ** 3)
    remaining_budget_gb = PROJECT_BUDGET_GB - total_gb
    return n_files, total_gb, remaining_budget_gb


def download_case(caseid: int, max_retries: int = 5) -> Tuple[bool, str]:
    """Download a single .vital file with streaming and verification."""
    dest = DATA_DIR / f"{caseid}.vital"
    temp_dest = DATA_DIR / f"{caseid}.vital.tmp"
    url = f"{API_URL}/{DATASET_VERSION}/{caseid}.vital"

    if dest.exists() and dest.stat().st_size > 500000:
        # Check if valid
        try:
            vf = vitaldb.VitalFile(str(dest), header_only=True)
            trks = vf.get_track_names()
            missing_mandatory = [t for t in MANDATORY_TRACKS if t not in trks]
            if not missing_mandatory:
                return True, f"Existing file verified ({dest.stat().st_size / (1024*1024):.2f} MB)"
            else:
                logger.warning(f"Existing Case {caseid} missing mandatory tracks: {missing_mandatory}. Re-downloading.")
        except Exception as e:
            logger.warning(f"Existing Case {caseid} corrupted ({e}). Re-downloading.")

    for attempt in range(1, max_retries + 1):
        try:
            with requests.get(url, stream=True, timeout=90) as r:
                r.raise_for_status()
                with open(temp_dest, "wb") as f:
                    for chunk in r.iter_content(chunk_size=131072):
                        if chunk:
                            f.write(chunk)
            
            # Verify downloaded file
            vf = vitaldb.VitalFile(str(temp_dest), header_only=True)
            trks = vf.get_track_names()
            missing = [t for t in MANDATORY_TRACKS if t not in trks]
            if missing:
                raise ValueError(f"Downloaded file missing mandatory tracks: {missing}")

            if temp_dest.stat().st_size < 500000:
                raise ValueError(f"Downloaded file suspiciously small: {temp_dest.stat().st_size} bytes")

            if dest.exists():
                dest.unlink()
            temp_dest.replace(dest)
            mb = dest.stat().st_size / (1024 * 1024)
            return True, f"Downloaded & verified ({mb:.2f} MB)"
        except Exception as e:
            if temp_dest.exists():
                temp_dest.unlink()
            if attempt == max_retries:
                return False, f"FAILED after {max_retries} attempts: {e}"
            time.sleep(attempt * 2)
    return False, "Unknown error"


import concurrent.futures

def download_100_cohort(batch_size: int = 10, max_workers: int = 5):
    """Execute the batched download of the 100-case cohort with storage safety."""
    cases_a, cases_b = load_and_verify_cohort_lists()

    # Combine with cohort tag
    all_cases = [(cid, "A") for cid in cases_a] + [(cid, "B") for cid in cases_b]

    total_cases = len(all_cases)
    batches = [all_cases[i:i + batch_size] for i in range(0, total_cases, batch_size)]

    print(f"\nTotal cases to acquire: {total_cases} in {len(batches)} batches of {batch_size}")

    for b_idx, batch in enumerate(batches, 1):
        n_files, total_gb, rem_budget = get_current_storage_stats()
        print("\n" + "-" * 75)
        print(f"STORAGE SAFETY CHECK BEFORE BATCH {b_idx}/{len(batches)}:")
        print(f"  Existing downloaded files : {n_files}")
        print(f"  Cumulative raw storage    : {total_gb * 1024:.2f} MB ({total_gb:.3f} GB)")
        print(f"  Remaining project budget  : {rem_budget:.3f} GB / {PROJECT_BUDGET_GB:.1f} GB")
        print("-" * 75)

        if total_gb > SAFETY_CEILING_GB:
            print(f"CRITICAL HALT: Storage exceeded safety ceiling ({total_gb:.2f} GB > {SAFETY_CEILING_GB:.1f} GB)!")
            sys.exit(1)

        # Download batch with parallel workers
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_case = {executor.submit(download_case, cid): (cid, cohort) for cid, cohort in batch}
            for future in concurrent.futures.as_completed(future_to_case):
                cid, cohort = future_to_case[future]
                try:
                    success, msg = future.result()
                    status_tag = "SUCCESS" if success else "FAILED"
                    print(f"  [{status_tag}] Case {cid:4d} (Cohort {cohort}): {msg}")
                    if not success:
                        print(f"FATAL ERROR: Failed to acquire Case {cid} (Cohort {cohort})!")
                        sys.exit(1)
                except Exception as exc:
                    print(f"FATAL ERROR on Case {cid}: {exc}")
                    sys.exit(1)

    # Final summary
    n_files, total_gb, rem_budget = get_current_storage_stats()
    print("\n" + "=" * 80)
    print("ALL 100 CASES ACQUIRED AND VERIFIED SUCCESSFULLY")
    print(f"  Total files in data/raw/vitaldb_100 : {n_files}")
    print(f"  Total raw storage consumed         : {total_gb * 1024:.2f} MB ({total_gb:.3f} GB)")
    print(f"  Remaining free project budget      : {rem_budget:.3f} GB / {PROJECT_BUDGET_GB:.1f} GB")
    print("=" * 80)


if __name__ == "__main__":
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    download_100_cohort(batch_size=10)
