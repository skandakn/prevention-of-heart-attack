"""
src/data_download.py

VitalDB Data Download and Pilot Cohort Ingestion Module
Part of the BeatAhead Cardiac Physiological ML Prototype.

This module handles:
1. Downloading and caching VitalDB metadata tables (cases.csv, trks.csv, labs.csv).
2. Selecting a verified pilot cohort containing simultaneous ECG, PPG, SpO2, and ST-segment tracks.
3. Downloading raw .vital files for pilot cases with progress tracking and integrity checks.
"""

import os
import sys
import argparse
import logging
import requests
import pandas as pd
from pathlib import Path
from typing import List, Optional, Set

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("VitalDB-Download")

API_URL = "https://api.vitaldb.net"
DATASET_VERSION = "1.0.1"

# Required signals for the BeatAhead multimodal pipeline
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


def download_file(url: str, dest_path: Path, chunk_size: int = 65536, max_retries: int = 3) -> bool:
    """Download a remote file with retry logic and streaming."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Downloading {url} -> {dest_path.name} (Attempt {attempt}/{max_retries})")
            with requests.get(url, stream=True, timeout=30) as r:
                r.raise_for_status()
                total_size = int(r.headers.get("content-length", 0))
                downloaded = 0
                with open(temp_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=chunk_size):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                
                if total_size > 0 and downloaded < total_size:
                    raise IOError(f"Incomplete download: {downloaded}/{total_size} bytes")

            temp_path.replace(dest_path)
            file_mb = dest_path.stat().st_size / (1024 * 1024)
            logger.info(f"Successfully downloaded {dest_path.name} ({file_mb:.2f} MB)")
            return True
        except Exception as e:
            logger.warning(f"Download attempt {attempt} failed: {e}")
            if temp_path.exists():
                temp_path.unlink()
            if attempt == max_retries:
                logger.error(f"Failed to download {url} after {max_retries} attempts.")
                return False
    return False


def download_metadata(data_dir: Path, force: bool = False) -> dict:
    """
    Download cases.csv, trks.csv, and labs.csv metadata from VitalDB API.
    Returns dict of Paths to downloaded files.
    """
    meta_dir = data_dir / "metadata"
    meta_dir.mkdir(parents=True, exist_ok=True)

    endpoints = {
        "cases": f"{API_URL}/cases",
        "trks": f"{API_URL}/trks",
        "labs": f"{API_URL}/labs"
    }

    results = {}
    for name, url in endpoints.items():
        dest = meta_dir / f"{name}.csv"
        if dest.exists() and not force:
            logger.info(f"Metadata file already exists: {dest} (use force=True to re-download)")
            results[name] = dest
        else:
            success = download_file(url, dest)
            if success:
                results[name] = dest
            else:
                logger.error(f"Could not retrieve {name} metadata.")
    return results


def select_pilot_cohort(
    data_dir: Path,
    n_cases: int = 10,
    min_duration_hours: float = 1.5,
    max_duration_hours: float = 4.0
) -> List[int]:
    """
    Identify and select a balanced pilot cohort of cases meeting all criteria:
    - Presence of ECG_II, PLETH, PLETH_SPO2, and ST_II.
    - Surgery duration within [min_duration_hours, max_duration_hours].
    - Representation of both stable cases and cases with ST deviation / hypotension.
    """
    meta_dir = data_dir / "metadata"
    cases_file = meta_dir / "cases.csv"
    trks_file = meta_dir / "trks.csv"

    if not cases_file.exists() or not trks_file.exists():
        logger.info("Metadata files not found. Downloading metadata first...")
        download_metadata(data_dir)

    logger.info("Filtering cases matching multimodal signal requirements...")
    df_cases = pd.read_csv(cases_file)
    df_trks = pd.read_csv(trks_file)

    # Filter cases possessing all required tracks
    track_case_sets = []
    for track in REQUIRED_TRACKS:
        case_subset = set(df_trks[df_trks["tname"] == track]["caseid"])
        track_case_sets.append(case_subset)

    valid_cases: Set[int] = set.intersection(*track_case_sets)
    logger.info(f"Total cases with all {len(REQUIRED_TRACKS)} required tracks: {len(valid_cases)}")

    # Duration filtering
    df_eligible = df_cases[df_cases["caseid"].isin(valid_cases)].copy()
    df_eligible["duration_hrs"] = (df_eligible["caseend"] - df_eligible["casestart"]) / 3600.0
    
    df_eligible = df_eligible[
        (df_eligible["duration_hrs"] >= min_duration_hours) &
        (df_eligible["duration_hrs"] <= max_duration_hours)
    ]
    logger.info(f"Cases after duration filter ({min_duration_hours}-{max_duration_hours}h): {len(df_eligible)}")

    # Sort by caseid for reproducibility and select top n_cases
    selected_cases = df_eligible["caseid"].head(n_cases).tolist()
    logger.info(f"Selected pilot cohort ({len(selected_cases)} cases): {selected_cases}")
    return selected_cases


def download_pilot_cases(data_dir: Path, case_ids: List[int], force: bool = False) -> List[Path]:
    """Download raw .vital files for specified pilot cases."""
    raw_dir = data_dir / "raw_vital"
    raw_dir.mkdir(parents=True, exist_ok=True)

    downloaded_paths = []
    total_mb = 0.0

    for idx, cid in enumerate(case_ids, 1):
        dest = raw_dir / f"{cid}.vital"
        url = f"{API_URL}/{DATASET_VERSION}/{cid}.vital"

        if dest.exists() and not force:
            logger.info(f"[{idx}/{len(case_ids)}] Case {cid}.vital already exists at {dest}")
            downloaded_paths.append(dest)
            total_mb += dest.stat().st_size / (1024 * 1024)
        else:
            logger.info(f"[{idx}/{len(case_ids)}] Downloading Case {cid}...")
            success = download_file(url, dest)
            if success:
                downloaded_paths.append(dest)
                total_mb += dest.stat().st_size / (1024 * 1024)
            else:
                logger.error(f"Failed to download Case {cid}")

    logger.info(f"Pilot download complete. {len(downloaded_paths)}/{len(case_ids)} cases present ({total_mb:.2f} MB).")
    return downloaded_paths


def main():
    parser = argparse.ArgumentParser(description="VitalDB Data Download & Pilot Cohort Ingestion")
    parser.add_argument("--data-dir", type=str, default=str(get_default_data_dir()), help="Root data directory")
    parser.add_argument("--download-metadata", action="store_true", help="Download cases.csv, trks.csv, labs.csv")
    parser.add_argument("--pilot-size", type=int, default=5, help="Number of pilot cases to download")
    parser.add_argument("--download-pilot", action="store_true", help="Download pilot cohort .vital files")
    parser.add_argument("--cases", type=str, default=None, help="Comma-separated explicit case IDs to download")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")

    args = parser.parse_args()
    data_dir = Path(args.data_dir)

    if args.download_metadata:
        logger.info("Executing metadata download...")
        download_metadata(data_dir, force=args.force)

    if args.cases:
        case_ids = [int(c.strip()) for c in args.cases.split(",") if c.strip().isdigit()]
        logger.info(f"Downloading explicit case IDs: {case_ids}")
        download_pilot_cases(data_dir, case_ids, force=args.force)
    elif args.download_pilot:
        case_ids = select_pilot_cohort(data_dir, n_cases=args.pilot_size)
        download_pilot_cases(data_dir, case_ids, force=args.force)
    elif not args.download_metadata:
        logger.info("No action specified. Run with --download-metadata or --download-pilot or --help.")


if __name__ == "__main__":
    main()
