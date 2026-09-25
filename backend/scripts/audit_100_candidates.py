import pandas as pd
import numpy as np
import vitaldb

# 1. Fetch case-level metadata and track list from VitalDB API
print("Fetching case metadata from VitalDB...")
df_cases = pd.read_csv("https://api.vitaldb.net/cases")
print(f"Total cases fetched: {len(df_cases)}")

print("Fetching track list from VitalDB...")
df_trks = pd.read_csv("https://api.vitaldb.net/trks")
print(f"Total tracks fetched: {len(df_trks)}")

cohort_a_raw = [2605, 3614, 4290, 2043, 4247, 2034, 3390, 3526, 758, 1159, 2197, 2772, 4272, 2824, 3037, 3632, 2800, 3192, 4519, 2854, 4038, 2037, 2717, 3027, 4390, 4220, 2697, 4423, 2085, 3505, 3042, 3535, 4252, 2727, 3426, 4236, 4243, 4434, 2725, 3418, 4437, 2081, 2623, 4246, 3530, 4568, 2075, 4435, 4244, 4234]
cohort_b_raw = [1268, 485, 2630, 4498, 3948, 3754, 5799, 3216, 864, 1923, 497, 1855, 3687, 5779, 1374, 1344, 4225, 4016, 5635, 3398, 4771, 381, 2866, 1714, 2419, 4467, 360, 481, 3486, 2728, 5585, 2172, 6081, 4616, 2253, 569, 111, 2719, 4349, 1269, 5664, 5326, 3280, 2146, 5130, 3450, 4120, 5262, 2379, 451]

# Check duplicates and lengths
print(f"Cohort A raw count: {len(cohort_a_raw)}, unique: {len(set(cohort_a_raw))}")
print(f"Cohort B raw count: {len(cohort_b_raw)}, unique: {len(set(cohort_b_raw))}")
overlap = set(cohort_a_raw).intersection(set(cohort_b_raw))
print(f"Overlap between A and B: {overlap}")

# Pilot cases
pilot_cases = [1, 13, 16, 21, 22, 26, 30, 31, 37, 38, 41, 46, 48, 49, 51, 57, 60, 61, 65, 66]
print(f"Overlap with Pilot - A: {set(cohort_a_raw).intersection(set(pilot_cases))}")
print(f"Overlap with Pilot - B: {set(cohort_b_raw).intersection(set(pilot_cases))}")

# Check tracks for each case
# We need:
# ECG_II: 'SNUADC/ECG_II'
# PLETH: 'SNUADC/PLETH'
# SpO2: 'Solar8000/PLETH_SPO2'
# ST_II: 'Solar8000/ST_II'
# ECG_V5: 'SNUADC/ECG_V5'
# ST_V5: 'Solar8000/ST_V5'

# Build a fast lookup of tracks per caseid
trks_by_case = df_trks.groupby('caseid')['tname'].apply(set).to_dict()

def audit_cohort(case_list, cohort_name):
    rows = []
    for cid in case_list:
        c_trks = trks_by_case.get(cid, set())
        has_ecg_ii = 'SNUADC/ECG_II' in c_trks
        has_pleth = 'SNUADC/PLETH' in c_trks
        has_spo2 = 'Solar8000/PLETH_SPO2' in c_trks
        has_st_ii = 'Solar8000/ST_II' in c_trks
        has_ecg_v5 = 'SNUADC/ECG_V5' in c_trks
        has_st_v5 = 'Solar8000/ST_V5' in c_trks
        
        all_required = has_ecg_ii and has_pleth and has_spo2 and has_st_ii
        
        c_meta = df_cases[df_cases['caseid'] == cid]
        if len(c_meta) > 0:
            m = c_meta.iloc[0]
            dur_sec = m.get('caseend', np.nan)
            dur_hrs = round(dur_sec / 3600.0, 2) if pd.notnull(dur_sec) else np.nan
            dept = m.get('department', 'Unknown')
            age = m.get('age', np.nan)
            htn = m.get('preop_htn', np.nan)
            dm = m.get('preop_dm', np.nan)
            opname = str(m.get('opname', ''))
            dx = str(m.get('dx', ''))
            # Check CAD / CABG
            cad_cabg = ('cad' in opname.lower() or 'cad' in dx.lower() or 
                        'cabg' in opname.lower() or 'cabg' in dx.lower() or
                        'coronary' in opname.lower() or 'coronary' in dx.lower() or
                        'angina' in dx.lower() or 'infarction' in dx.lower())
        else:
            dur_hrs = np.nan
            dept = 'Not found'
            age = np.nan
            htn = np.nan
            dm = np.nan
            cad_cabg = False
            opname = ''
            dx = ''
            
        rows.append({
            'cohort': cohort_name,
            'caseid': cid,
            'all_required': all_required,
            'has_ecg_ii': has_ecg_ii,
            'has_pleth': has_pleth,
            'has_spo2': has_spo2,
            'has_st_ii': has_st_ii,
            'has_ecg_v5': has_ecg_v5,
            'has_st_v5': has_st_v5,
            'duration_hrs': dur_hrs,
            'department': dept,
            'age': age,
            'preop_htn': htn,
            'preop_dm': dm,
            'cad_cabg': cad_cabg,
            'opname': opname,
            'dx': dx
        })
    return pd.DataFrame(rows)

df_audit_a = audit_cohort(cohort_a_raw, 'Cohort A')
df_audit_b = audit_cohort(cohort_b_raw, 'Cohort B')

print("\n--- Cohort A Track Audit ---")
print(f"All required available: {df_audit_a['all_required'].sum()} / {len(df_audit_a)}")
missing_a = df_audit_a[~df_audit_a['all_required']]
print(f"Missing cases in A ({len(missing_a)}):")
for _, r in missing_a.iterrows():
    print(f"  Case {r['caseid']}: ECG_II={r['has_ecg_ii']}, PLETH={r['has_pleth']}, SpO2={r['has_spo2']}, ST_II={r['has_st_ii']}")

print("\n--- Cohort B Track Audit ---")
print(f"All required available: {df_audit_b['all_required'].sum()} / {len(df_audit_b)}")
missing_b = df_audit_b[~df_audit_b['all_required']]
print(f"Missing cases in B ({len(missing_b)}):")
for _, r in missing_b.iterrows():
    print(f"  Case {r['caseid']}: ECG_II={r['has_ecg_ii']}, PLETH={r['has_pleth']}, SpO2={r['has_spo2']}, ST_II={r['has_st_ii']}")

# Save raw audit
df_all_audit = pd.concat([df_audit_a, df_audit_b])
df_all_audit.to_csv('scratch/raw_candidate_100_audit.csv', index=False)
