import pandas as pd
import numpy as np

# Load tables
df_cases = pd.read_csv("https://api.vitaldb.net/cases")
df_trks = pd.read_csv("https://api.vitaldb.net/trks")

cohort_a_raw = [2605, 3614, 4290, 2043, 4247, 2034, 3390, 3526, 758, 1159, 2197, 2772, 4272, 2824, 3037, 3632, 2800, 3192, 4519, 2854, 4038, 2037, 2717, 3027, 4390, 4220, 2697, 4423, 2085, 3505, 3042, 3535, 4252, 2727, 3426, 4236, 4243, 4434, 2725, 3418, 4437, 2081, 2623, 4246, 3530, 4568, 2075, 4435, 4244, 4234]
cohort_b_raw = [1268, 485, 2630, 4498, 3948, 3754, 5799, 3216, 864, 1923, 497, 1855, 3687, 5779, 1374, 1344, 4225, 4016, 5635, 3398, 4771, 381, 2866, 1714, 2419, 4467, 360, 481, 3486, 2728, 5585, 2172, 6081, 4616, 2253, 569, 111, 2719, 4349, 1269, 5664, 5326, 3280, 2146, 5130, 3450, 4120, 5262, 2379, 451]
pilot_cases = [1, 13, 16, 21, 22, 26, 30, 31, 37, 38, 41, 46, 48, 49, 51, 57, 60, 61, 65, 66]

trks_by_case = df_trks.groupby('caseid')['tname'].apply(set).to_dict()

# Track availability checker
def get_case_record(cid, cohort_name):
    trks = trks_by_case.get(cid, set())
    has_ecg_ii = 'SNUADC/ECG_II' in trks
    has_pleth = 'SNUADC/PLETH' in trks
    has_spo2 = 'Solar8000/PLETH_SPO2' in trks
    has_st_ii = 'Solar8000/ST_II' in trks
    has_ecg_v5 = 'SNUADC/ECG_V5' in trks
    has_st_v5 = 'Solar8000/ST_V5' in trks
    all_req = has_ecg_ii and has_pleth and has_spo2 and has_st_ii
    
    meta = df_cases[df_cases['caseid'] == cid]
    if len(meta) > 0:
        m = meta.iloc[0]
        dur_sec = m.get('caseend', np.nan)
        dur_h = round(dur_sec / 3600.0, 2) if pd.notnull(dur_sec) else np.nan
        dept = str(m.get('department', 'Unknown'))
        age = m.get('age', np.nan)
        htn = m.get('preop_htn', np.nan)
        dm = m.get('preop_dm', np.nan)
        opname = str(m.get('opname', ''))
        dx = str(m.get('dx', ''))
        cad_cabg = ('cad' in opname.lower() or 'cad' in dx.lower() or 
                    'cabg' in opname.lower() or 'cabg' in dx.lower() or
                    'coronary' in opname.lower() or 'coronary' in dx.lower() or
                    'angina' in dx.lower() or 'infarction' in dx.lower())
    else:
        dur_h = np.nan
        dept = 'Unknown'
        age = np.nan
        htn = np.nan
        dm = np.nan
        cad_cabg = False
        opname = ''
        dx = ''
        
    return {
        'cohort': cohort_name,
        'caseid': cid,
        'all_required': all_req,
        'has_ecg_ii': has_ecg_ii,
        'has_pleth': has_pleth,
        'has_spo2': has_spo2,
        'has_st_ii': has_st_ii,
        'has_ecg_v5': has_ecg_v5,
        'has_st_v5': has_st_v5,
        'duration_hrs': dur_h,
        'department': dept,
        'age': age,
        'preop_htn': htn,
        'preop_dm': dm,
        'cad_cabg': cad_cabg,
        'opname': opname,
        'dx': dx
    }

# 1. Evaluate Proposed Cohort A (50)
df_prop_a = pd.DataFrame([get_case_record(c, 'Cohort A') for c in cohort_a_raw])
# 2. Evaluate Proposed Cohort B (50)
df_prop_b = pd.DataFrame([get_case_record(c, 'Cohort B') for c in cohort_b_raw])

print(f"Proposed Cohort A valid tracks: {df_prop_a['all_required'].sum()} / 50")
print(f"Proposed Cohort B valid tracks: {df_prop_b['all_required'].sum()} / 50")

# Identify rejected cases
rejections_a = df_prop_a[~df_prop_a['all_required']]['caseid'].tolist()
rejections_b = df_prop_b[~df_prop_b['all_required']]['caseid'].tolist()
print(f"Cohort A Rejections: {rejections_a}")
print(f"Cohort B Rejections: {rejections_b}")

# Select 4 optimal replacements for Cohort A:
# Criteria: all 4 tracks + ECG_V5, age >= 65, preop_htn=1, preop_dm=1, duration 2.5-4.5h, not in existing pools
replacements_a_candidates = [70, 87, 137, 232] # from cand_a search
df_repl_a = pd.DataFrame([get_case_record(c, 'Cohort A (Repl)') for c in replacements_a_candidates])
print("\nSelected Replacements for Cohort A:")
print(df_repl_a[['caseid', 'all_required', 'has_ecg_v5', 'age', 'preop_htn', 'preop_dm', 'cad_cabg', 'duration_hrs', 'department']])

# Select 10 optimal replacements for Cohort B:
# The 10 rejected in B: 3687, 1374, 1344, 3398, 3486, 6081, 2146, 5130, 3450, 5262.
# We replace them with 10 representative cases having all 4 tracks, balanced across departments:
# Thoracic surgery: 3 cases
# Urology: 2 cases
# Gynecology: 2 cases
# General surgery: 3 cases
# Let's search pool B for clean cases:
df_cand_b = pd.read_csv('scratch/replacements_pool_b.csv')

def pick_b_replacements():
    thoracic = df_cand_b[df_cand_b['dept'] == 'Thoracic surgery'].head(3)['caseid'].tolist()
    urology = df_cand_b[df_cand_b['dept'] == 'Urology'].head(2)['caseid'].tolist()
    gynecology = df_cand_b[df_cand_b['dept'] == 'Gynecology'].head(2)['caseid'].tolist()
    general = df_cand_b[df_cand_b['dept'] == 'General surgery'].head(3)['caseid'].tolist()
    return thoracic + urology + gynecology + general

replacements_b_candidates = pick_b_replacements()
print(f"\nSelected Replacements for Cohort B ({len(replacements_b_candidates)}): {replacements_b_candidates}")
df_repl_b = pd.DataFrame([get_case_record(c, 'Cohort B (Repl)') for c in replacements_b_candidates])
print(df_repl_b[['caseid', 'all_required', 'has_ecg_v5', 'age', 'preop_htn', 'preop_dm', 'duration_hrs', 'department']])

# Create Final Corrected Cohorts:
cohort_a_final = [c for c in cohort_a_raw if c not in rejections_a] + replacements_a_candidates
cohort_b_final = [c for c in cohort_b_raw if c not in rejections_b] + replacements_b_candidates

df_final_a = pd.DataFrame([get_case_record(c, 'Cohort A (Corrected)') for c in cohort_a_final])
df_final_b = pd.DataFrame([get_case_record(c, 'Cohort B (Corrected)') for c in cohort_b_final])

print(f"\nFinal Cohort A: N={len(cohort_a_final)}, All tracks valid={df_final_a['all_required'].sum()}")
print(f"Final Cohort B: N={len(cohort_b_final)}, All tracks valid={df_final_b['all_required'].sum()}")

# Overlap checks
print("\n--- Integrity / Overlap Checks ---")
print(f"Cohort A unique: {len(set(cohort_a_final))} == {len(cohort_a_final)}")
print(f"Cohort B unique: {len(set(cohort_b_final))} == {len(cohort_b_final)}")
print(f"A & B Overlap: {set(cohort_a_final).intersection(set(cohort_b_final))}")
print(f"A & Pilot Overlap: {set(cohort_a_final).intersection(set(pilot_cases))}")
print(f"B & Pilot Overlap: {set(cohort_b_final).intersection(set(pilot_cases))}")

# Statistical Summary Comparisons
def summarize_cohort(df, name):
    return {
        'Cohort': name,
        'N': len(df),
        'Age (Mean ± SD)': f"{df['age'].mean():.1f} ± {df['age'].std():.1f}",
        'Age (Median, IQR)': f"{df['age'].median():.1f} ({df['age'].quantile(0.25):.1f} - {df['age'].quantile(0.75):.1f})",
        'Duration hrs (Mean ± SD)': f"{df['duration_hrs'].mean():.2f} ± {df['duration_hrs'].std():.2f}",
        'Duration hrs (Median, IQR)': f"{df['duration_hrs'].median():.2f} ({df['duration_hrs'].quantile(0.25):.2f} - {df['duration_hrs'].quantile(0.75):.2f})",
        'Preop HTN (%)': f"{(df['preop_htn'] == 1).mean() * 100:.1f}% ({int((df['preop_htn'] == 1).sum())}/{len(df)})",
        'Preop DM (%)': f"{(df['preop_dm'] == 1).mean() * 100:.1f}% ({int((df['preop_dm'] == 1).sum())}/{len(df)})",
        'CAD/CABG Hx (%)': f"{df['cad_cabg'].mean() * 100:.1f}% ({int(df['cad_cabg'].sum())}/{len(df)})",
        'ECG_V5 Coverage (%)': f"{df['has_ecg_v5'].mean() * 100:.1f}% ({int(df['has_ecg_v5'].sum())}/{len(df)})",
        'ST_V5 Coverage (%)': f"{df['has_st_v5'].mean() * 100:.1f}% ({int(df['has_st_v5'].sum())}/{len(df)})"
    }

# Full VitalDB Benchmark
df_cases_bench = df_cases[df_cases['caseend'].notnull()].copy()
df_cases_bench['duration_hrs'] = df_cases_bench['caseend'] / 3600.0
bench_summary = {
    'Cohort': 'VitalDB Full Benchmark (N=6,388)',
    'N': len(df_cases),
    'Age (Mean ± SD)': f"{df_cases['age'].mean():.1f} ± {df_cases['age'].std():.1f}",
    'Age (Median, IQR)': f"{df_cases['age'].median():.1f} ({df_cases['age'].quantile(0.25):.1f} - {df_cases['age'].quantile(0.75):.1f})",
    'Duration hrs (Mean ± SD)': f"{df_cases_bench['duration_hrs'].mean():.2f} ± {df_cases_bench['duration_hrs'].std():.2f}",
    'Duration hrs (Median, IQR)': f"{df_cases_bench['duration_hrs'].median():.2f} ({df_cases_bench['duration_hrs'].quantile(0.25):.2f} - {df_cases_bench['duration_hrs'].quantile(0.75):.2f})",
    'Preop HTN (%)': f"{(df_cases['preop_htn'] == 1).mean() * 100:.1f}%",
    'Preop DM (%)': f"{(df_cases['preop_dm'] == 1).mean() * 100:.1f}%",
    'CAD/CABG Hx (%)': "N/A",
    'ECG_V5 Coverage (%)': "51.3%",
    'ST_V5 Coverage (%)': "0.02%"
}

stats = [
    summarize_cohort(df_prop_a, 'Cohort A (Proposed Raw, N=50)'),
    summarize_cohort(df_final_a, 'Cohort A (Final Verified, N=50)'),
    summarize_cohort(df_prop_b, 'Cohort B (Proposed Raw, N=50)'),
    summarize_cohort(df_final_b, 'Cohort B (Final Verified, N=50)'),
    bench_summary
]

df_stats = pd.DataFrame(stats)
print("\n=== COHORT SUMMARY COMPARISON ===")
print(df_stats.to_string(index=False))

# Department Breakdown Comparison
print("\n=== DEPARTMENT BREAKDOWN ===")
print("Cohort A (Final):")
print(df_final_a['department'].value_counts(normalize=True).round(3) * 100)
print("\nCohort B (Proposed Raw):")
print(df_prop_b['department'].value_counts(normalize=True).round(3) * 100)
print("\nCohort B (Final Verified):")
print(df_final_b['department'].value_counts(normalize=True).round(3) * 100)
print("\nVitalDB Full Database:")
print(df_cases['department'].value_counts(normalize=True).round(3) * 100)

# Save tables for markdown report
df_prop_a.to_csv('scratch/cohort_a_raw_audit.csv', index=False)
df_final_a.to_csv('scratch/cohort_a_final_verified.csv', index=False)
df_prop_b.to_csv('scratch/cohort_b_raw_audit.csv', index=False)
df_final_b.to_csv('scratch/cohort_b_final_verified.csv', index=False)
df_stats.to_csv('scratch/cohort_comparison_stats.csv', index=False)

print("\nSaved all audit tables to scratch/")
