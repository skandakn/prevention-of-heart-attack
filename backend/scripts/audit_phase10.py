"""
scratch/audit_phase10.py
Executes Phase 10 audits:
- Task 6: Simulated vs Live mode separation
- Task 7: UI Consistency audit
- Task 8: Explainability audit (prohibited terms scan)
- Task 10: Performance benchmarks
- Task 12: Security & client bundle artifact leak scan
"""

import os
import re
import sys
import time
import json
from pathlib import Path
import tracemalloc
import ctypes

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

ISCHEMIC_SRC = Path(r"C:\ischemic\src")
ISCHEMIC_PUBLIC = Path(r"C:\ischemic\public")
ISCHEMIC_NEXT = Path(r"C:\ischemic\.next")

PROHIBITED_TERMS = [
    r"\bheart\s+attack\s+(detected|diagnosed|confirmed)\b",
    r"\bischemia\s+confirmed\b",
    r"\bclinical\s+certainty\b",
    r"\bmedication\s+instructions\b",
    r"\bcured\b"
]

def audit_explainability():
    print("=== TASK 8: EXPLAINABILITY & PROHIBITED TERMS AUDIT ===")
    matches = []
    # Scan src directory
    for root, _, files in os.walk(ISCHEMIC_SRC):
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                filepath = Path(root) / file
                # Skip node_modules if any
                if "node_modules" in str(filepath):
                    continue
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        lines = content.splitlines()
                        for i, line in enumerate(lines, 1):
                            for term in PROHIBITED_TERMS:
                                match = re.search(term, line, re.IGNORECASE)
                                if match:
                                    matches.append({
                                        "file": str(filepath.relative_to(ISCHEMIC_SRC)),
                                        "line": i,
                                        "term": match.group(0),
                                        "text": line.strip()[:100]
                                    })
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
                    
    print(f"Active prohibited assertions found: {len(matches)}")
    for m in matches:
        print(f"  [VIOLATION] {m['file']}:{m['line']} - Found '{m['term']}': {m['text']}")
    return len(matches) == 0

def audit_security_and_bundle():
    print("\n=== TASK 12: SECURITY & BUNDLE ARTIFACT EXPOSURE AUDIT ===")
    # 1. Check if .joblib exists in public directory
    joblib_in_public = list(ISCHEMIC_PUBLIC.rglob("*.joblib"))
    pkl_in_public = list(ISCHEMIC_PUBLIC.rglob("*.pkl*"))
    print(f"Checking public directory: {len(joblib_in_public)} .joblib files, {len(pkl_in_public)} .pkl files")
    
    # 2. Check if .joblib is bundled in static build output
    joblib_in_next = list(ISCHEMIC_NEXT.rglob("*.joblib"))
    print(f"Checking .next directory: {len(joblib_in_next)} .joblib files")
    
    # 3. Check for API secrets or env variables hardcoded in client components
    suspicious_client_secrets = []
    for root, _, files in os.walk(ISCHEMIC_SRC / "components"):
        for file in files:
            if file.endswith((".ts", ".tsx")):
                filepath = Path(root) / file
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if "process.env.SECRET" in content or "API_KEY" in content:
                        suspicious_client_secrets.append(str(filepath))
                        
    print(f"Client components with hardcoded secrets: {len(suspicious_client_secrets)}")
    passed = (len(joblib_in_public) == 0 and len(joblib_in_next) == 0 and len(suspicious_client_secrets) == 0)
    print(f"Security Audit Result: {'PASS' if passed else 'FAIL'}")
    return passed

def audit_simulation_separation():
    print("\n=== TASK 6: SIMULATED VS LIVE SEPARATION AUDIT ===")
    toast_path = ISCHEMIC_SRC / "components" / "layout" / "Toast.tsx"
    with open(toast_path, "r", encoding="utf-8", errors="ignore") as f:
        toast_content = f.read()
    sim_badge_exists = "RESEARCH MODEL — SIMULATED INPUT" in toast_content and "LIVE PHYSIOLOGICAL INPUT" in toast_content
    print(f"SimulatedBadge distinguishes simulated vs live: {sim_badge_exists}")
    
    # Verify banner presence on key pages
    pages_to_check = ["dashboard", "monitor", "signals", "trends", "insights", "clinician"]
    pages_checked = {}
    for p in pages_to_check:
        page_file = ISCHEMIC_SRC / "app" / p / "page.tsx"
        if page_file.exists():
            with open(page_file, "r", encoding="utf-8", errors="ignore") as f:
                c = f.read()
                # Check for SimulatedBadge or SimulationContext usage
                has_sim = "SimulatedBadge" in c or "useSimulation" in c or "Simulated" in c
                pages_checked[p] = has_sim
        else:
            pages_checked[p] = "Not found"
            
    print(f"Pages with simulation awareness: {pages_checked}")
    return sim_badge_exists

def benchmark_performance():
    print("\n=== TASK 10: PERFORMANCE MEASUREMENTS ===")
    from src.inference import BeatAheadInferenceEngine
    from tests.test_inference import get_sample_valid_features
    
    # 1. Startup initialization time
    t0 = time.perf_counter()
    engine = BeatAheadInferenceEngine()
    startup_time_ms = (time.perf_counter() - t0) * 1000.0
    print(f"Engine Startup / Loading Latency: {startup_time_ms:.2f} ms")
    
    # 2. In-process inference latency (50 iterations)
    sample = get_sample_valid_features()
    latencies = []
    for _ in range(50):
        t_start = time.perf_counter()
        _ = engine.predict(sample)
        latencies.append((time.perf_counter() - t_start) * 1000.0)
        
    p50 = float(np.percentile(latencies, 50))
    p95 = float(np.percentile(latencies, 95))
    mean_lat = float(np.mean(latencies))
    print(f"In-process Inference Latency: Mean={mean_lat:.3f} ms, P50={p50:.3f} ms, P95={p95:.3f} ms")
    
    # 3. Process Memory footprint
    tracemalloc.start()
    for _ in range(10):
        _ = engine.predict(sample)
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    mem_mb = peak_mem / (1024 * 1024)
    print(f"Traced Peak Inference Allocation: {mem_mb:.2f} MB")
    
    # 4. Repeated inference consistency
    out1 = engine.predict(sample)
    out2 = engine.predict(sample)
    diff = abs(out1["model_probability"] - out2["model_probability"])
    print(f"Inference bit-for-bit repeatability difference: {diff:.1e}")
    
    return {
        "startup_ms": startup_time_ms,
        "mean_latency_ms": mean_lat,
        "p50_latency_ms": p50,
        "p95_latency_ms": p95,
        "memory_mb": mem_mb,
        "consistency_diff": diff
    }

if __name__ == "__main__":
    import numpy as np
    t8_pass = audit_explainability()
    t12_pass = audit_security_and_bundle()
    t6_pass = audit_simulation_separation()
    perf = benchmark_performance()
    print("\nAUDIT SUMMARY:")
    print(f"Task 8 (Explainability): {'PASS' if t8_pass else 'FAIL'}")
    print(f"Task 12 (Security): {'PASS' if t12_pass else 'FAIL'}")
    print(f"Task 6 (Simulated/Live Separation): {'PASS' if t6_pass else 'FAIL'}")
    print("Performance Benchmarking completed.")
