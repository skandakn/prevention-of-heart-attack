import os
import glob
import pandas as pd
import numpy as np

# Check pilot files
pilot_files = glob.glob('data/raw/vitaldb_pilot/*.vital')
sizes = [os.path.getsize(f) for f in pilot_files]
print(f"Pilot files: {len(sizes)}")
print(f"Total pilot size: {sum(sizes) / (1024*1024):.2f} MB")
print(f"Average pilot file size: {np.mean(sizes) / (1024*1024):.2f} MB (min: {min(sizes)/(1024*1024):.2f}, max: {max(sizes)/(1024*1024):.2f})")

# Load final cohorts
df_final_a = pd.read_csv('scratch/cohort_a_final_verified.csv')
df_final_b = pd.read_csv('scratch/cohort_b_final_verified.csv')

# Calculate duration totals
total_hours_a = df_final_a['duration_hrs'].sum()
total_hours_b = df_final_b['duration_hrs'].sum()
total_hours_100 = total_hours_a + total_hours_b

print(f"Cohort A total surgical duration: {total_hours_a:.2f} hours (mean {df_final_a['duration_hrs'].mean():.2f}h)")
print(f"Cohort B total surgical duration: {total_hours_b:.2f} hours (mean {df_final_b['duration_hrs'].mean():.2f}h)")
print(f"Combined 100 cases total surgical duration: {total_hours_100:.2f} hours (mean {total_hours_100/100:.2f}h)")

# In the pilot:
# Total duration of pilot: 20 cases had mean duration ~3.2 hours = 64 hours total.
# Pilot file size total = 245 MB.
# Rate: 245 MB / 64 hours = ~3.83 MB per surgical hour for full .vital file (compressed format).
# If uncompressed / loaded in memory or downloaded:
# 100 cases with mean duration 2.93 hours = 293 hours.
# Expected raw .vital download size: 293 hours * 3.83 MB/hr = ~1,122 MB (~1.12 GB).
# Conservative estimate with variance: 1.5 - 2.0 GB.
# Comparison to user working budget of 25 GB:
# 1.12 GB is ONLY ~4.5% of the 25 GB budget!
print(f"Expected 100-case raw .vital download size: ~{total_hours_100 * 3.83 / 1024:.2f} GB (Conservative max: ~2.0 GB)")
print(f"Budget headroom: {25.0 - (total_hours_100 * 3.83 / 1024):.2f} GB remaining out of 25 GB (>90% headroom).")
