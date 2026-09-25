import pandas as pd
import numpy as np

# Load tables
df_cases = pd.read_csv("https://api.vitaldb.net/cases")
df_trks = pd.read_csv("https://api.vitaldb.net/trks")

cohort_a_raw = [2605, 3614, 4290, 2043, 4247, 2034, 3390, 3526, 758, 1159, 2197, 2772, 4272, 2824, 3037, 3632, 2800, 3192, 4519, 2854, 4038, 2037, 2717, 3027, 4390, 4220, 2697, 4423, 2085, 3505, 3042, 3535, 4252, 2727, 3426, 4236, 4243, 4434, 2725, 3418, 4437, 2081, 2623, 4246, 3530, 4568, 2075, 4435, 4244, 4234]
cohort_b_raw = [1268, 485, 2630, 4498, 3948, 3754, 5799, 3216, 864, 1923, 497, 1855, 3687, 5779, 1374, 1344, 4225, 4016, 5635, 3398, 4771, 381, 2866, 1714, 2419, 4467, 360, 481, 3486, 2728, 5585, 2172, 6081, 4616, 2253, 569, 111, 2719, 4349, 1269, 5664, 5326, 3280, 2146, 5130, 3450, 4120, 5262, 2379, 451]
pilot_cases = [1, 13, 16, 21, 22, 26, 30, 31, 37, 38, 41, 46, 48, 49, 51, 57, 60, 61, 65, 66]

trks_by_case = df_trks.groupby('caseid')['tname'].apply(set).to_dict()

# Track availability function
def check_tracks(cid):
    trks = trks_by_case.get(cid, set())
    return {
        'ecg_ii': 'SNUADC/ECG_II' in trks,
        'pleth': 'SNUADC/PLETH' in trks,
        'spo2': 'Solar8000/PLETH_SPO2' in trks,
        'st_ii': 'Solar8000/ST_II' in trks,
        'ecg_v5': 'SNUADC/ECG_V5' in trks,
        'st_v5': 'Solar8000/ST_V5' in trks,
        'all_req': ('SNUADC/ECG_II' in trks and 'SNUADC/PLETH' in trks and 
                    'Solar8000/PLETH_SPO2' in trks and 'Solar8000/ST_II' in trks)
    }

# Find replacement candidates for Cohort A:
# Criteria for Cohort A replacements:
# - All 4 required tracks: ECG_II, PLETH, SpO2, ST_II
# - ECG_V5 present
# - Not in pilot, not in Cohort A, not in Cohort B
# - Enriched cardiovascular risk (Age >= 65, preop_htn=1 or preop_dm=1 or CAD/CABG)
# - Duration between 2 and 6 hours
excluded_cids = set(cohort_a_raw) | set(cohort_b_raw) | set(pilot_cases)

cand_a = []
for idx, r in df_cases.iterrows():
    cid = int(r['caseid'])
    if cid in excluded_cids:
        continue
    tinfo = check_tracks(cid)
    if not (tinfo['all_req'] and tinfo['ecg_v5']):
        continue
    dur_h = r['caseend'] / 3600.0 if pd.notnull(r['caseend']) else 0
    if dur_h < 2.0 or dur_h > 6.0:
        continue
    age = r['age'] if pd.notnull(r['age']) else 0
    htn = r['preop_htn'] if pd.notnull(r['preop_htn']) else 0
    dm = r['preop_dm'] if pd.notnull(r['preop_dm']) else 0
    op = str(r['opname']).lower()
    dx = str(r['dx']).lower()
    cad = ('cad' in op or 'cad' in dx or 'coronary' in op or 'coronary' in dx or 'angina' in dx)
    
    if (age >= 65 and (htn == 1 or dm == 1)) or cad:
        cand_a.append({
            'caseid': cid,
            'age': age,
            'htn': htn,
            'dm': dm,
            'cad': cad,
            'dur_h': round(dur_h, 2),
            'dept': r['department'],
            'opname': r['opname'],
            'dx': r['dx']
        })

df_cand_a = pd.DataFrame(cand_a)
print(f"\nAvailable qualified replacements for Cohort A: {len(df_cand_a)}")
print("Top 10 candidates for Cohort A replacement:")
print(df_cand_a.head(10)[['caseid', 'age', 'htn', 'dm', 'cad', 'dur_h', 'dept']])

# Find replacement candidates for Cohort B:
# Criteria for Cohort B replacements:
# - All 4 required tracks: ECG_II, PLETH, SpO2, ST_II
# - Not in pilot, not in Cohort A, not in Cohort B, not in cand_a selected
# - Duration between 1.5 and 5.0 hours
# - Broad surgical department representation (General, Thoracic, Urology, Gynecology)
# - Selected purely on surgery/demographics, completely blind to ST deviation values
cand_b = []
for idx, r in df_cases.iterrows():
    cid = int(r['caseid'])
    if cid in excluded_cids:
        continue
    tinfo = check_tracks(cid)
    if not tinfo['all_req']:
        continue
    dur_h = r['caseend'] / 3600.0 if pd.notnull(r['caseend']) else 0
    if dur_h < 1.5 or dur_h > 5.0:
        continue
    dept = r['department']
    cand_b.append({
        'caseid': cid,
        'age': r['age'],
        'htn': r['preop_htn'],
        'dm': r['preop_dm'],
        'dur_h': round(dur_h, 2),
        'dept': dept,
        'opname': r['opname'],
        'has_ecg_v5': tinfo['ecg_v5']
    })
df_cand_b = pd.DataFrame(cand_b)
print(f"\nAvailable qualified replacements for Cohort B: {len(df_cand_b)}")
print("Candidate breakdown by department in pool B:")
print(df_cand_b['dept'].value_counts())

# Save candidate pools
df_cand_a.to_csv('scratch/replacements_pool_a.csv', index=False)
df_cand_b.to_csv('scratch/replacements_pool_b.csv', index=False)
